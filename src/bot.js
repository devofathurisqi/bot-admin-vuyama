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

    // 2. CHECK BLOCK TABLE (If customer is blocked, bot ignores and remains silent)
    const isBlocked = await db('blocked_numbers').where('phone_number', phoneNumber).first();
    if (isBlocked) {
      logger.info(`Bot dinonaktifkan (BLOCKED) untuk ${phoneNumber}. Human admin yang membalas.`);
      
      // OPTIMIZATION: If a blocked user sends the filled order format, still parse and update the order board, but keep bot silent!
      if (messageHandler.isFilledOrderFormat(messageText)) {
        logger.info(`Customer terblokir ${phoneNumber} mengirimkan format order terisi. Mem-parsing untuk order board...`);
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
            logger.info(`Mengupdate Order #${orderId} milik customer terblokir.`);
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
            logger.info(`Membuat Order #${orderId} baru untuk customer terblokir.`);
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
          logger.error('Gagal mem-parsing format order untuk customer terblokir:', err);
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

      // Step B: Send all matching images back-to-back
      for (const imagePath of imgMatches) {
        let absolutePath = null;
        if (imagePath.startsWith('/uploads/')) {
          absolutePath = path.join(__dirname, '../learn/images', path.basename(imagePath));
        } else if (imagePath.startsWith('/media/')) {
          absolutePath = path.join(__dirname, '../data/media', path.basename(imagePath));
        } else {
          const p1 = path.join(__dirname, '../learn/images', path.basename(imagePath));
          const p2 = path.join(__dirname, '../data/media', path.basename(imagePath));
          if (fs.existsSync(p1)) absolutePath = p1;
          else if (fs.existsSync(p2)) absolutePath = p2;
        }

        if (absolutePath && fs.existsSync(absolutePath)) {
          try {
            const media = MessageMedia.fromFilePath(absolutePath);
            const mediaMsg = await client.sendMessage(phoneNumber, media);
            if (!sentMsg) sentMsg = mediaMsg;
            sentImages.push(imagePath);
            sentMediaCount++;
            logger.info(`Bot mengirim gambar "${imagePath}" ke ${phoneNumber}`);
          } catch (mediaErr) {
            logger.error(`Gagal mengirim gambar dari path ${absolutePath}:`, mediaErr);
          }
        } else {
          logger.warn(`Gambar "${imagePath}" tidak ditemukan di disk pada path ${absolutePath || 'unknown'}`);
        }
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
