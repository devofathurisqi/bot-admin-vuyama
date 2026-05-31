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
 * Asynchronously generates a custom comparison infographic using Gemini and Puppeteer,
 * and sends it to the customer when ready.
 */
const asyncGenerateAndSendComparison = async (client, phoneNumber, comparisonText) => {
  try {
    logger.info(`Starting background comparison image generation for ${phoneNumber}...`);
    
    if (!client.pupBrowser) {
      logger.warn('Puppeteer browser instance not found in WhatsApp client. Skipping dynamic image generation.');
      return;
    }

    // 1. Ask Gemini to generate a clean HTML table
    const prompt = `You are a professional graphic designer for Vuyama (premium hijab and label brand). 
Based on the following comparison explanation:
"""
${comparisonText}
"""

Create an extremely clean, beautiful, minimalist HTML comparison table.
Design Guidelines (Strict):
1. Background MUST be solid white (#ffffff).
2. Use clean, elegant modern typography (e.g. from Google Fonts, import Inter or Montserrat).
3. At the very top, place a simple, elegant centered dark logo "V" with a small sub-text "VUYAMA CS".
4. Below the logo, create a clean comparison table with elegant light-gray borders (#e2e8f0), beautiful cell padding, and centered headers.
5. Under the table, write a very brief 1-2 sentence clean summary or tips.
6. The entire design must look premium, modern, clean, and not over-the-top (no colorful backgrounds, gradients, or dark modes).
7. Return ONLY the complete HTML code starting with <!DOCTYPE html>. Do NOT wrap it in markdown code blocks like \`\`\`html.`;

    const htmlCode = await gemini.callGemini(prompt);
    
    let cleanHtml = htmlCode.trim();
    if (cleanHtml.startsWith('```html')) cleanHtml = cleanHtml.replace(/^```html/, '');
    if (cleanHtml.startsWith('```')) cleanHtml = cleanHtml.replace(/^```/, '');
    if (cleanHtml.endsWith('```')) cleanHtml = cleanHtml.replace(/```$/, '');
    cleanHtml = cleanHtml.trim();

    // 2. Render screenshot via Puppeteer
    const page = await client.pupBrowser.newPage();
    try {
      await page.setContent(cleanHtml, { waitUntil: 'networkidle0' });
      await page.setViewport({ width: 800, height: 600, deviceScaleFactor: 2 });
      
      const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
      const bodyHeight = await page.evaluate(() => document.body.scrollHeight);
      
      await page.setViewport({ 
        width: Math.max(bodyWidth + 40, 800), 
        height: Math.max(bodyHeight + 40, 400), 
        deviceScaleFactor: 2 
      });

      const filename = `dynamic_comparison_${Date.now()}.png`;
      const outputPath = path.join(__dirname, '../data/media/others', filename);
      
      const dir = path.dirname(outputPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      await page.screenshot({ path: outputPath, fullPage: true });
      logger.info(`Successfully generated dynamic comparison image at ${outputPath}`);

      // 3. Send the image to the customer via WhatsApp
      if (fs.existsSync(outputPath)) {
        const media = MessageMedia.fromFilePath(outputPath);
        await client.sendMessage(phoneNumber, media);
        logger.info(`Successfully sent dynamic comparison image to ${phoneNumber}`);
        
        // Clean up the temporary file
        setTimeout(() => {
          try {
            fs.unlinkSync(outputPath);
            logger.info(`Cleaned up temporary dynamic image: ${filename}`);
          } catch (e) {}
        }, 15000);
      }
    } finally {
      await page.close();
    }
  } catch (error) {
    logger.error('Failed to generate or send dynamic comparison image:', error);
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
  try {
    // Skip if status message
    if (msg.isStatus) return;

    const phoneNumber = msg.fromMe ? msg.to : msg.from;
    const messageText = msg.body;
    const isGroup = msg.isGroupMsg || phoneNumber.includes('@g.us');

    // Skip group messages
    if (isGroup) {
      return;
    }

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
      return;
    }

    // ==========================================
    // CASE B: INCOMING MESSAGE FROM CUSTOMER
    // ==========================================
    logger.info(`Pesan masuk dari ${phoneNumber}: "${messageText}"`);

    // 1. Auto-register customer in database CRM if not present
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
      message: messageText,
      sender: 'customer',
      message_type: 'text',
      status: 'received',
      timestamp: new Date()
    });

    // Stream incoming message to dashboard Live Chat in real-time
    emitEvent('incoming_message', {
      phone_number: phoneNumber,
      message: messageText,
      sender: 'customer',
      message_type: 'text',
      status: 'received',
      timestamp: new Date()
    });

    // Notify UI of updated customer stats (unread badge, last_message_at)
    const updatedCustomer = await db('customers').where('phone_number', phoneNumber).first();
    emitEvent('customer_updated', updatedCustomer);

    // 2. CHECK BLOCK TABLE & ACTIVE ORDERS (If customer is blocked or has an active order, bot ignores and remains silent)
    const isBlocked = await db('blocked_numbers').where('phone_number', phoneNumber).first();
    const activeOrder = await db('orders')
      .where('phone_number', phoneNumber)
      .whereIn('status', ['PENDING', 'CONFIRMED', 'PAID', 'SHIPPED'])
      .first();

    if (isBlocked || activeOrder) {
      logger.info(`Bot dinonaktifkan untuk ${phoneNumber}. Human admin yang membalas. (Blocked: ${!!isBlocked}, Active Order: ${!!activeOrder})`);
      
      // OPTIMIZATION: If a blocked/active user sends the filled order format, still parse and update the order board, but keep bot silent!
      if (messageHandler.isFilledOrderFormat(messageText)) {
        logger.info(`Customer ${phoneNumber} mengirimkan format order terisi. Mem-parsing untuk order board...`);
        try {
          const parsed = await messageHandler.parseOrderFormatWithGemini(messageText);
          const existingPendingOrder = await db('orders')
            .where('phone_number', phoneNumber)
            .andWhere('status', 'PENDING')
            .orderBy('id', 'desc')
            .first();

          let orderId;
          if (existingPendingOrder) {
            orderId = existingPendingOrder.id;
            await db('orders').where('id', orderId).update({
              customer_name: parsed.customer_name || existingPendingOrder.customer_name || 'Customer Vuyama',
              address: parsed.address,
              phone: parsed.phone,
              pesanan_raw: parsed.pesanan_raw,
              brand_name: parsed.brand_name,
              label_size: parsed.label_size,
              label_shape: parsed.label_shape,
              ink_color: parsed.ink_color,
              label_color: parsed.label_color,
              font: parsed.font,
              updated_at: new Date()
            });
            logger.info(`Mengupdate Order #${orderId} milik customer.`);
          } else {
            const [orderIdObj] = await db('orders').insert({
              phone_number: phoneNumber,
              customer_name: parsed.customer_name || 'Customer Vuyama',
              address: parsed.address,
              phone: parsed.phone,
              pesanan_raw: parsed.pesanan_raw,
              brand_name: parsed.brand_name,
              label_size: parsed.label_size,
              label_shape: parsed.label_shape,
              ink_color: parsed.ink_color,
              label_color: parsed.label_color,
              font: parsed.font,
              status: 'PENDING',
              total: 0
            }).returning('id');
            orderId = orderIdObj ? orderIdObj.id : null;
            logger.info(`Membuat Order #${orderId} baru untuk customer.`);
          }

          // Update customer CRM status
          await db('customers').where('phone_number', phoneNumber).update({
            status: 'ORDER_CONFIRMED',
            updated_at: new Date()
          });

          // Stream real-time update to dashboard
          const updatedOrder = await db('orders').where('id', orderId).first();
          emitEvent('order_updated', updatedOrder);

          const updatedCustomer = await db('customers').where('phone_number', phoneNumber).first();
          emitEvent('customer_updated', updatedCustomer);
        } catch (err) {
          logger.error('Gagal mem-parsing format order untuk customer:', err);
        }
      }
      return;
    }

    // 3. GENERATE BOT RESPONSE
    const response = await messageHandler.generateResponse(phoneNumber, messageText, customer.status);

    try {
      // Simulate typing status to look exactly like a human admin and reduce spam flagging
      const chat = await msg.getChat();
      await chat.sendStateTyping();
      // Small delay of 1.5 seconds to mimic typing speed
      await new Promise(resolve => setTimeout(resolve, 1500));
    } catch (e) {
      // Fail-safe if sendStateTyping throws
    }

    // 4. SEND BOT RESPONSE
    const imgRegex = /\[SEND_IMAGE:\s*([^\]]+)\]/gi;
    const docRegex = /\[SEND_DOCUMENT:\s*([^\]]+)\]/gi;
    
    let replyText = response.response;
    
    // Extract all images
    const imgMatches = [...replyText.matchAll(imgRegex)].map(m => m[1].trim());
    replyText = replyText.replace(imgRegex, '').trim();
    
    // Extract all documents
    const docMatches = [...replyText.matchAll(docRegex)].map(m => m[1].trim());
    replyText = replyText.replace(docRegex, '').trim();

    const key = `${phoneNumber}:${response.response}`;
    pendingOutgoingMessages.add(key);
    
    let sentMsg = null;
    let sentMediaCount = 0;
    const sentImages = [];
    const sentDocs = [];

    try {
      // Step A: Send reply text first if it exists
      if (replyText.length > 0) {
        sentMsg = await client.sendMessage(phoneNumber, replyText);
        logger.info(`Bot merespons teks ke ${phoneNumber}: "${replyText.substring(0, 50)}..."`);
      }

      // Step B: Send all matching images back-to-back asynchronously in background
      if (imgMatches.length > 0) {
        (async () => {
          // Wait 2.5 seconds to simulate separate loading status
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
                // Simulate typing/uploading status for image
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
            } else {
              logger.warn(`Gambar "${imagePath}" tidak ditemukan di disk pada path ${absolutePath || 'unknown'}`);
            }
          }
        })().catch(err => logger.error('Error in async static image sending:', err));
      }

      // Step B2: If no static images matched, but it's a comparison query, dynamically generate and send comparison infographic
      const isCompQuery = /(beda|banding|vs|lawan|lebih|bagus|laku|mending|pilih|mana|kelebihan|kekurangan|perbedaan|selisih)/i.test(messageText);
      const isComp = response.intent === 'comparison_match' || 
                     response.intent === 'faq_match' || 
                     response.intent === 'ai_reply';
      
      if (imgMatches.length === 0 && isCompQuery && isComp && replyText.length > 0) {
        asyncGenerateAndSendComparison(client, phoneNumber, replyText)
          .catch(err => logger.error('Error in dynamic comparison image generation:', err));
      }

      // Step C: Send all matching documents back-to-back
      for (const docPath of docMatches) {
        let absoluteDocPath = null;
        if (docPath.startsWith('/pdf/')) {
          absoluteDocPath = path.join(__dirname, '../data/pdf', path.basename(docPath));
        } else {
          const p1 = path.join(__dirname, '../data/pdf', path.basename(docPath));
          if (fs.existsSync(p1)) absoluteDocPath = p1;
        }

        if (absoluteDocPath && fs.existsSync(absoluteDocPath)) {
          try {
            const media = MessageMedia.fromFilePath(absoluteDocPath);
            const mediaMsg = await client.sendMessage(phoneNumber, media);
            if (!sentMsg) sentMsg = mediaMsg;
            sentDocs.push(docPath);
            sentMediaCount++;
            logger.info(`Bot mengirim dokumen "${docPath}" ke ${phoneNumber}`);
          } catch (docErr) {
            logger.error(`Gagal mengirim dokumen dari path ${absoluteDocPath}:`, docErr);
          }
        } else {
          logger.warn(`Dokumen "${docPath}" tidak ditemukan di disk pada path ${absoluteDocPath || 'unknown'}`);
        }
      }

      // Fallback if absolutely nothing was sent (neither text nor media)
      if (!sentMsg && replyText.length === 0) {
        const fallbackText = "Ada yang bisa Vumin bantu lagi kak? 😊";
        sentMsg = await client.sendMessage(phoneNumber, fallbackText);
      }
    } catch (sendErr) {
      logger.error('Gagal mengirim respon bot:', sendErr);
    } finally {
      setTimeout(() => pendingOutgoingMessages.delete(key), 5000);
    }

    // Save bot reply to database (include sent media logs)
    let dbMessage = replyText;
    if (sentImages.length > 0) {
      dbMessage += (dbMessage ? '\n' : '') + `[Gambar: ${sentImages.join(', ')}]`;
    }
    if (sentDocs.length > 0) {
      dbMessage += (dbMessage ? '\n' : '') + `[Dokumen: ${sentDocs.join(', ')}]`;
    }
    const dbMessageType = sentMediaCount > 0 ? (sentImages.length > 0 ? 'image' : 'document') : 'text';

    await db('conversations').insert({
      phone_number: phoneNumber,
      message: dbMessage,
      sender: 'bot',
      message_type: dbMessageType,
      status: 'sent',
      timestamp: new Date()
    });

    // Stream bot's reply to dashboard Live Chat in real-time
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
  pendingOutgoingMessages
};
