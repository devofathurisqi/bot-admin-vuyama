const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const logger = require('./utils/logger');
const config = require('./utils/config');
const messageHandler = require('./handlers/messageHandler');
const history = require('./services/history');
const gemini = require('./services/gemini');
const db = require('./utils/db');
const { setBotStatus } = require('./bot_state');
const { emitEvent } = require('./utils/socket');
const fs = require('fs');
const path = require('path');

// Set to track programmatically sent messages to prevent duplicates in CRM live chat
const pendingOutgoingMessages = new Set();

// Set to track in-flight message processing locks per phone number
const inFlightLocks = new Set();

// Initialize WhatsApp client
const client = new Client({
  authStrategy: new LocalAuth({
    clientId: config.whatsappSessionName
  }),
  authTimeoutMs: 90000,
  puppeteer: {
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  }
});

// Realtime Logger Helper to store logs in PostgreSQL and broadcast to clients
const logToDb = async (level, message) => {
  try {
    const timestamp = new Date();
    await db('bot_logs').insert({ level, message, timestamp });
    emitEvent('new_log', { level, message, timestamp });
  } catch (err) {
    logger.error('Error writing bot log to DB:', err);
  }
};

/**
 * Asynchronously generates a custom PDF (comparison, invoice, or reseller welcome guide)
 * using the consolidated documentGenerator service and sends it to the customer.
 */
const asyncGenerateAndSendPdf = async (client, phoneNumber, type, options = {}) => {
  try {
    if (!client.pupBrowser) {
      const errNoPup = `[PDF CS Vuyama] Gagal: Browser Puppeteer tidak aktif pada client.`;
      logger.warn(errNoPup);
      await logToDb('warn', errNoPup);
      return;
    }

    const docGen = require('./services/documentGenerator');
    let pdfPath = null;
    let logMsg = '';

    if (type === 'comparison') {
      const messageText = options.messageText || '';
      const comparisonText = options.comparisonText || '';
      
      const normalized = messageText.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').trim();
      let slug = 'umum';
      if (/paris/i.test(normalized) && /(japan|jadul|legend|klasik|basic|ori)/i.test(normalized)) {
        slug = 'paris_japan_vs_paris_jadul';
      } else if (/(akrilik|acrylic|plat|besi|woven|satin)/i.test(normalized)) {
        slug = 'label_brand_comparison';
      } else if (/(bamboo|airtech)/i.test(normalized)) {
        slug = 'pashmina_bamboo_vs_airtech';
      } else {
        const words = normalized.split(/\s+/).filter(w => w.length > 3 && !['sama', 'atau', 'vs', 'dan', 'beda', 'banding', 'lebih', 'bagus', 'laku', 'mending', 'pilih', 'mana'].includes(w));
        if (words.length >= 2) {
          slug = `${words[0]}_vs_${words[1]}`;
        } else if (words.length === 1) {
          slug = words[0];
        } else {
          slug = `custom_${Date.now()}`;
        }
      }

      logMsg = `[PDF CS Vuyama] Memulai pembuatan PDF perbandingan "${slug}" untuk ${phoneNumber}...`;
      logger.info(logMsg);
      await logToDb('info', logMsg);

      pdfPath = await docGen.generateComparisonPdf(client.pupBrowser, slug, comparisonText);
    } 
    else if (type === 'invoice') {
      const oId = options.orderId;
      const order = oId
        ? await db('orders').where('id', oId).first()
        : await db('orders').where('phone_number', phoneNumber).orderBy('id', 'desc').first();
        
      if (!order) {
        logger.warn(`[PDF CS Vuyama] Gagal: Order tidak ditemukan untuk ${phoneNumber}`);
        return;
      }

      logMsg = `[PDF CS Vuyama] Memulai pembuatan PDF Invoice #${order.id} untuk ${phoneNumber}...`;
      logger.info(logMsg);
      await logToDb('info', logMsg);

      pdfPath = await docGen.generateInvoicePdf(client.pupBrowser, order.id);
    } 
    else if (type === 'welcome_guide') {
      const level = options.resellerLevel || 'Silver';
      logMsg = `[PDF CS Vuyama] Memulai pembuatan PDF Welcome Guide (${level}) untuk ${phoneNumber}...`;
      logger.info(logMsg);
      await logToDb('info', logMsg);

      pdfPath = await docGen.generateWelcomeGuidePdf(client.pupBrowser, phoneNumber, level);
    }

    if (pdfPath && fs.existsSync(pdfPath)) {
      const media = MessageMedia.fromFilePath(pdfPath);
      await client.sendMessage(phoneNumber, media);
      
      const successMsg = `[PDF CS Vuyama] Dokumen PDF ${type} berhasil dikirim ke ${phoneNumber}!`;
      logger.info(successMsg);
      await logToDb('info', successMsg);
    } else {
      logger.warn(`[PDF CS Vuyama] File PDF tidak ditemukan setelah proses render.`);
    }
  } catch (error) {
    const errMsg = `[PDF CS Vuyama] Gagal memproses dokumen PDF ${type} untuk ${phoneNumber}: ${error.message}`;
    logger.error(errMsg, error);
    await logToDb('error', errMsg);
  }
};

// QR Code handler
client.on('qr', (qr) => {
  logger.info('WhatsApp QR code generated. Scan to connect...');
  qrcode.generate(qr, { small: true });
  setBotStatus('scanning', qr);
});

// Ready handler
client.on('ready', () => {
  const msg = `Bot siap! Logged in as ${config.botName}`;
  logger.info(msg);
  logToDb('info', msg);
  setBotStatus('connected');
});

// Authenticated handler
client.on('authenticated', () => {
  const msg = 'WhatsApp Authentication berhasil';
  logger.info(msg);
  logToDb('info', msg);
  setBotStatus('authenticated');
});

// Message received & created handler
client.on('message_create', async (msg) => {
  // Skip if status message
  if (msg.isStatus) return;

  const phoneNumber = msg.fromMe ? msg.to : msg.from;
  const isGroup = msg.isGroupMsg || phoneNumber.includes('@g.us');

  // Skip group messages
  if (isGroup) {
    return;
  }

  // Deduplication lock: prevent double replies for the same user in quick succession
  if (!msg.fromMe) {
    if (inFlightLocks.has(phoneNumber)) {
      logger.info(`Message from ${phoneNumber} is already being processed (in-flight lock). Skipping.`);
      return;
    }
    inFlightLocks.add(phoneNumber);
  }

  try {
    const messageText = msg.body;

    // ==========================================
    // CASE A: OUTGOING MESSAGE BY HUMAN ADMIN FROM PHONE
    // ==========================================
    if (msg.fromMe) {
      // Avoid duplicate logging if this message was sent programmatically (by bot or dashboard)
      const key = `${phoneNumber}:${messageText}`;
      if (pendingOutgoingMessages.has(key)) {
        pendingOutgoingMessages.delete(key);
        return;
      }
      // Ensure customer exists in CRM
      let customer = await db('customers').where('phone_number', phoneNumber).first();
      if (!customer) {
        let name = 'Customer';
        try {
          const contact = await client.getContactById(phoneNumber);
          name = contact.pushname || contact.name || 'Customer';
        } catch (e) {}

        await db('customers').insert({
          phone_number: phoneNumber,
          name,
          status: 'NORMAL',
          unread_count: 0,
          last_message_at: new Date()
        });
      } else {
        await db('customers').where('phone_number', phoneNumber).update({
          last_message_at: new Date(),
          updated_at: new Date()
        });
      }

      // Add to conversation history as 'agent'
      await db('conversations').insert({
        phone_number: phoneNumber,
        message: messageText,
        sender: 'agent',
        message_type: 'text',
        status: 'sent',
        timestamp: new Date()
      });

      // Stream to dashboard client so Live Chat is 100% in sync
      emitEvent('incoming_message', {
        phone_number: phoneNumber,
        message: messageText,
        sender: 'agent',
        message_type: 'text',
        status: 'sent',
        timestamp: new Date()
      });

      // Auto-pause bot for this contact due to manual admin intervention from phone
      try {
        const { pauseBotForCustomer } = require('./utils/workflow');
        await pauseBotForCustomer(phoneNumber, 12);
      } catch (err) {
        logger.error('Failed to trigger pauseBotForCustomer in fromMe handler:', err);
      }

      return;
    }

    // ==========================================
    // CASE B: INCOMING MESSAGE FROM CUSTOMER
    // ==========================================
    logger.info(`Pesan masuk dari ${phoneNumber}: "${messageText}"`);

    // 1. Download media if image
    let imageBuffer = null;
    let imageMime = null;
    let finalMessageText = messageText;
    let isImage = false;

    if (msg.hasMedia && msg.type === 'image') {
      try {
        const media = await msg.downloadMedia();
        if (media) {
          isImage = true;
          imageMime = media.mimetype;
          imageBuffer = Buffer.from(media.data, 'base64');
          const ext = imageMime.split('/')[1] || 'png';
          const filename = `incoming-${Date.now()}-${Math.round(Math.random() * 1e9)}.${ext}`;
          const diskPath = path.join(__dirname, '../learn/images', filename);
          fs.writeFileSync(diskPath, imageBuffer);
          const relativeUrl = `/uploads/${filename}`;
          finalMessageText = `[Gambar: ${relativeUrl}]` + (messageText ? ` ${messageText}` : '');
          logger.info(`Downloaded and saved incoming media to ${diskPath}`);
        }
      } catch (err) {
        logger.error('Failed to download incoming media:', err);
      }
    }

    // 2. Auto-register customer in database CRM if not present
    let customer = await db('customers').where('phone_number', phoneNumber).first();
    if (!customer) {
      let name = 'Customer';
      try {
        const contact = await msg.getContact();
        name = contact.pushname || contact.name || 'Customer';
      } catch (e) {}

      await db('customers').insert({
        phone_number: phoneNumber,
        name,
        status: 'NORMAL',
        unread_count: 1,
        last_message_at: new Date()
      });
      customer = { phone_number: phoneNumber, name, status: 'NORMAL', unread_count: 1 };
    } else {
      // Update last message time and increment unread count
      await db('customers').where('phone_number', phoneNumber).update({
        unread_count: customer.unread_count + 1,
        last_message_at: new Date(),
        updated_at: new Date()
      });
      customer.unread_count += 1;
    }

    // Save incoming message to database
    await db('conversations').insert({
      phone_number: phoneNumber,
      message: finalMessageText || '',
      sender: 'customer',
      message_type: isImage ? 'image' : 'text',
      status: 'received',
      timestamp: new Date()
    });

    // Stream incoming message to dashboard Live Chat in real-time
    emitEvent('incoming_message', {
      phone_number: phoneNumber,
      message: finalMessageText || '',
      sender: 'customer',
      message_type: isImage ? 'image' : 'text',
      status: 'received',
      timestamp: new Date()
    });

    // Notify UI of updated customer stats (unread badge, last_message_at)
    const updatedCustomer = await db('customers').where('phone_number', phoneNumber).first();
    emitEvent('customer_updated', updatedCustomer);

    // 3. CHECK BLOCK TABLE, ACTIVE ORDERS & SMART PAUSE TIMER
    const isBlocked = await db('blocked_numbers').where('phone_number', phoneNumber).first();
    const isPaused = customer.paused_until && new Date(customer.paused_until) > new Date();
    const isMutedStatus = ['WAITING_HUMAN', 'ORDER_PENDING', 'ORDER_CONFIRMED'].includes(customer.status);

    if (isBlocked || isPaused || isMutedStatus) {
      logger.info(`Bot CS di-mute untuk ${phoneNumber} (Blocked: ${!!isBlocked}, Paused: ${!!isPaused}, Muted Status: ${customer.status})`);
      
      // OPTIMIZATION: If a blocked/active/paused/muted user sends the filled order format, still parse and update the order board, but keep bot silent!
      if (messageHandler.isFilledOrderFormat(finalMessageText)) {
        logger.info(`Customer ${phoneNumber} mengirimkan format order terisi. Mem-parsing untuk order board...`);
        try {
          const parsed = await messageHandler.parseOrderFormatWithGemini(finalMessageText);
          const existingPendingOrder = await db('orders')
            .where('phone_number', phoneNumber)
            .andWhere('status', 'PENDING')
            .orderBy('id', 'desc')
            .first();

          let orderId;
          const orderHeader = {
            customer_name: parsed.customer_name || (existingPendingOrder ? existingPendingOrder.customer_name : 'Customer Vuyama'),
            address: parsed.address,
            phone: parsed.phone,
            pesanan_raw: parsed.pesanan_raw,
            updated_at: new Date()
          };

          const customSpecs = {
            brand_name: parsed.brand_name,
            label_size: parsed.label_size,
            label_shape: parsed.label_shape,
            ink_color: parsed.ink_color,
            label_color: parsed.label_color,
            font: parsed.font
          };

          if (existingPendingOrder) {
            orderId = existingPendingOrder.id;
            await db('orders').where('id', orderId).update(orderHeader);
            
            // Check if draft item exists
            const existingItem = await db('order_items').where('order_id', orderId).first();
            if (existingItem) {
              await db('order_items').where('id', existingItem.id).update({
                product_name: parsed.pesanan_raw || 'Label Custom',
                custom_specs: JSON.stringify(customSpecs),
                updated_at: new Date()
              });
            } else {
              await db('order_items').insert({
                order_id: orderId,
                product_name: parsed.pesanan_raw || 'Label Custom',
                quantity: 1,
                price: 0,
                subtotal: 0,
                custom_specs: JSON.stringify(customSpecs)
              });
            }
            logger.info(`Mengupdate Order #${orderId} milik customer.`);
          } else {
            const [orderIdObj] = await db('orders').insert({
              phone_number: phoneNumber,
              customer_name: orderHeader.customer_name,
              address: orderHeader.address,
              phone: orderHeader.phone,
              pesanan_raw: orderHeader.pesanan_raw,
              status: 'PENDING',
              total: 0
            }).returning('id');
            orderId = orderIdObj ? orderIdObj.id : null;

            await db('order_items').insert({
              order_id: orderId,
              product_name: parsed.pesanan_raw || 'Label Custom',
              quantity: 1,
              price: 0,
              subtotal: 0,
              custom_specs: JSON.stringify(customSpecs)
            });
            logger.info(`Membuat Order #${orderId} baru untuk customer.`);
          }

          // Update customer CRM status
          await db('customers').where('phone_number', phoneNumber).update({
            status: 'ORDER_CONFIRMED',
            updated_at: new Date()
          });

          // Stream real-time update to dashboard
          const rawOrder = await db('orders').where('id', orderId).first();
          const items = await db('order_items').where('order_id', orderId);
          const updatedOrder = {
            ...rawOrder,
            items,
            brand_name: customSpecs.brand_name || null,
            label_size: customSpecs.label_size || null,
            label_shape: customSpecs.label_shape || null,
            ink_color: customSpecs.ink_color || null,
            label_color: customSpecs.label_color || null,
            font: customSpecs.font || null
          };

          emitEvent('order_updated', updatedOrder);

          const updatedCustomer = await db('customers').where('phone_number', phoneNumber).first();
          emitEvent('customer_updated', updatedCustomer);
        } catch (err) {
          logger.error('Gagal mem-parsing format order untuk customer:', err);
        }
      }
      return;
    }

    // 4. GENERATE BOT RESPONSE
    const response = await messageHandler.generateResponse(phoneNumber, finalMessageText, customer.status, imageBuffer, imageMime);

    try {
      // Simulate typing status
      const chat = await msg.getChat();
      await chat.sendStateTyping();
      await new Promise(resolve => setTimeout(resolve, 1500));
    } catch (e) {
      // Fail-safe
    }

    // 5. SEND BOT RESPONSE
    const imgRegex = /\[SEND_IMAGE:\s*([^\]]+)\]/gi;
    const docRegex = /\[SEND_DOCUMENT:\s*([^\]]+)\]/gi;
    
    let replyText = response.response;
    
    // Detect comparison PDF trigger
    const isComp = replyText.includes('[COMPARISON_SHEET]');
    replyText = replyText.replace(/\[COMPARISON_SHEET\]/gi, '').trim();

    // Detect invoice PDF trigger
    const isInvoice = replyText.includes('[INVOICE_SHEET]');
    replyText = replyText.replace(/\[INVOICE_SHEET\]/gi, '').trim();

    // Detect welcome guide PDF trigger
    const welcomeGuideRegex = /\[WELCOME_GUIDE:\s*([^\]]+)\]/gi;
    let resellerLevel = null;
    const welcomeMatch = welcomeGuideRegex.exec(replyText);
    if (welcomeMatch) {
      resellerLevel = welcomeMatch[1].trim();
    }
    replyText = replyText.replace(welcomeGuideRegex, '').trim();

    // Extract all images
    let imgMatches = [...replyText.matchAll(imgRegex)].map(m => m[1].trim());
    replyText = replyText.replace(imgRegex, '').trim();
    
    // Filter out comparison images
    imgMatches = imgMatches.filter(img => !img.includes('comparison'));
    
    // Extract all documents
    const docMatches = [...replyText.matchAll(docRegex)].map(m => m[1].trim());
    replyText = replyText.replace(docRegex, '').trim();

    const key = `${phoneNumber}:${response.response}`;
    pendingOutgoingMessages.add(key);
    
    let sentMsg = null;

    try {
      // Step A: Send reply text first if it exists
      if (replyText.length > 0) {
        sentMsg = await client.sendMessage(phoneNumber, replyText);
        logger.info(`Bot merespons teks ke ${phoneNumber}: "${replyText.substring(0, 50)}..."`);
      }

      // Step B: Send all matching images back-to-back
      if (imgMatches.length > 0) {
        (async () => {
          await new Promise(resolve => setTimeout(resolve, 2500));
          
          for (const imagePath of imgMatches) {
            let absolutePath = null;
            if (imagePath.startsWith('/uploads/')) {
              absolutePath = path.join(__dirname, '../learn/images', path.basename(imagePath));
            } else if (imagePath.startsWith('/media/')) {
              const rel = imagePath.replace(/^\/media\/?/, '');
              absolutePath = path.join(__dirname, '../data/media', rel);
            } else {
              const p1 = path.join(__dirname, '../learn/images', path.basename(imagePath));
              const p2 = path.join(__dirname, '../data/media', path.basename(imagePath));
              const p3 = path.join(__dirname, '../data/media/color_stock', path.basename(imagePath));
              const p4 = path.join(__dirname, '../data/media/others', path.basename(imagePath));
              if (fs.existsSync(p1)) absolutePath = p1;
              else if (fs.existsSync(p2)) absolutePath = p2;
              else if (fs.existsSync(p3)) absolutePath = p3;
              else if (fs.existsSync(p4)) absolutePath = p4;
            }

            if (absolutePath && fs.existsSync(absolutePath)) {
              try {
                const chat = await msg.getChat();
                await chat.sendStateTyping();
                
                const media = MessageMedia.fromFilePath(absolutePath);
                let caption = '';
                if (imagePath.includes('/color_stock/')) {
                  const productName = path.basename(imagePath).replace(/\s+Color\s+Stock\.[a-zA-Z0-9]+$/i, '').trim();
                  caption = `Pilihan stok warna harian untuk ${productName} kak... 😊`;
                }
                await client.sendMessage(phoneNumber, media, caption ? { caption } : undefined);
                logger.info(`Bot mengirim gambar "${imagePath}" ke ${phoneNumber} secara asynchronous`);
              } catch (mediaErr) {
                logger.error(`Gagal mengirim gambar dari path ${absolutePath}:`, mediaErr);
              }
            }
          }
        })().catch(err => logger.error('Error in async static image sending:', err));
      }

      // Step B2: If it's a comparison query, invoice, or welcome guide, dynamically generate and send in background
      if (isComp) {
        asyncGenerateAndSendPdf(client, phoneNumber, 'comparison', { messageText, comparisonText: response.response })
          .catch(err => logger.error('Error in dynamic PDF comparison generation:', err));
      }
      if (isInvoice) {
        asyncGenerateAndSendPdf(client, phoneNumber, 'invoice')
          .catch(err => logger.error('Error in dynamic PDF invoice generation:', err));
      }
      if (resellerLevel) {
        asyncGenerateAndSendPdf(client, phoneNumber, 'welcome_guide', { resellerLevel })
          .catch(err => logger.error('Error in dynamic PDF welcome guide generation:', err));
      }

      // Step C: Send all matching documents
      for (const docPath of docMatches) {
        let absoluteDocPath = null;
        if (docPath.startsWith('/pdf/')) {
          absoluteDocPath = path.join(__dirname, '../data/pdf', path.basename(docPath));
        } else if (docPath.startsWith('/media/')) {
          const rel = docPath.replace(/^\/media\/?/, '');
          absoluteDocPath = path.join(__dirname, '../data/media', rel);
        } else {
          const p1 = path.join(__dirname, '../data/pdf', path.basename(docPath));
          const p2 = path.join(__dirname, '../data/media', path.basename(docPath));
          const p3 = path.join(__dirname, '../data/media/others', path.basename(docPath));
          if (fs.existsSync(p1)) absoluteDocPath = p1;
          else if (fs.existsSync(p2)) absoluteDocPath = p2;
          else if (fs.existsSync(p3)) absoluteDocPath = p3;
        }

        if (absoluteDocPath && fs.existsSync(absoluteDocPath)) {
          try {
            const media = MessageMedia.fromFilePath(absoluteDocPath);
            const mediaMsg = await client.sendMessage(phoneNumber, media);
            if (!sentMsg) sentMsg = mediaMsg;
            logger.info(`Bot mengirim dokumen "${docPath}" ke ${phoneNumber}`);
          } catch (docErr) {
            logger.error(`Gagal mengirim dokumen dari path ${absoluteDocPath}:`, docErr);
          }
        } else {
          logger.warn(`Dokumen "${docPath}" tidak ditemukan di disk pada path ${absoluteDocPath || 'unknown'}`);
        }
      }

    } finally {
      setTimeout(() => pendingOutgoingMessages.delete(key), 8000);
    }

    // Save bot response to CRM database
    const dbMessageType = isImage ? 'image' : 'text';
    const dbMessage = replyText || '[Dokumen/Gambar Terkirim]';

    await db('conversations').insert({
      phone_number: phoneNumber,
      message: dbMessage,
      sender: 'bot',
      message_type: dbMessageType,
      status: 'sent',
      timestamp: new Date()
    });

    // Stream bot response to dashboard
    emitEvent('incoming_message', {
      phone_number: phoneNumber,
      message: dbMessage,
      sender: 'bot',
      message_type: dbMessageType,
      status: 'sent',
      timestamp: new Date()
    });

  } catch (error) {
    logger.error('Error processing WhatsApp message:', error);
    await logToDb('error', `Error processing message from ${msg.from}: ${error.message}`);
  } finally {
    if (!msg.fromMe) {
      inFlightLocks.delete(phoneNumber);
    }
  }
});

// Handle connection issues
client.on('disconnected', (reason) => {
  const msg = `WhatsApp Disconnected: ${reason}`;
  logger.warn(msg);
  logToDb('warn', msg);
  setBotStatus('disconnected');
});

client.on('auth_failure', (msg) => {
  const errMsg = `WhatsApp Authentication failed: ${msg}`;
  logger.error(errMsg);
  logToDb('error', errMsg);
  setBotStatus('disconnected');
});

// Initialize bot
const startBot = async () => {
  try {
    logger.info('Memulai Vuyama AI Customer Service Bot...');
    logger.info(`Checking Gemini AI connection...`);
    
    const geminiReady = await gemini.healthCheck();
    if (!geminiReady) {
      logger.warn('Gemini API not responding or timed out. AI replies may fall back to default, but proceeding with WhatsApp startup...');
      await logToDb('warn', 'Gemini AI connection check failed. AI replies may be limited.');
    } else {
      logger.info(`Gemini connected! Model: ${gemini.MODEL_NAME}`);
      await logToDb('info', `Gemini AI connected. Model: ${gemini.MODEL_NAME}`);
    }

    // Ensure data directory exists
    const dataDir = config.dataDir;
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    // Set status to scanning while initializing
    setBotStatus('disconnected');

    // Start WhatsApp client
    await client.initialize();
    logger.info('WhatsApp client initialized successfully.');
    await logToDb('info', 'WhatsApp client initialized.');
  } catch (error) {
    logger.error('Failed to start bot:', error);
    process.exit(1);
  }
};

// Graceful shutdown
process.on('SIGINT', async () => {
  logger.info('Shutting down bot...');
  try {
    await client.destroy();
    await db.destroy();
    logger.info('Shutdown clean.');
  } catch (err) {
    logger.error('Error during shutdown:', err);
  }
  process.exit(0);
});

process.on('SIGTERM', async () => {
  logger.info('Shutting down bot...');
  try {
    await client.destroy();
    await db.destroy();
    logger.info('Shutdown clean.');
  } catch (err) {
    logger.error('Error during shutdown:', err);
  }
  process.exit(0);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  if (reason === 'auth timeout') {
    logger.warn('WhatsApp Auth Timeout. Continuing check...');
    return;
  }
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

module.exports = {
  client,
  startBot,
  pendingOutgoingMessages,
  asyncGenerateAndSendPdf
};
