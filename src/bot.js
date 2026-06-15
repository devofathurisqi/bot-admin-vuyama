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

// Smart Tracker to prevent duplicate logging in CRM
class PendingMessagesTracker {
  constructor() {
    this.list = [];
  }

  add(key) {
    this.list.push({ key, timestamp: Date.now() });
    
    // Automatically prune after 15 seconds to avoid memory leaks
    setTimeout(() => {
      this.delete(key);
    }, 15000);
  }

  has(key) {
    this._pruneExpired();
    return this._findIndex(key) !== -1;
  }

  delete(key) {
    this._pruneExpired();
    const idx = this._findIndex(key);
    if (idx !== -1) {
      this.list.splice(idx, 1);
      return true;
    }
    return false;
  }

  _findIndex(key) {
    const parts = key.split(':');
    const phoneNumber = parts[0];
    const messageText = parts.slice(1).join(':');

    const normPhone = this._normalizePhone(phoneNumber);
    const normText = this._normalizeText(messageText);

    return this.list.findIndex(item => {
      const itemParts = item.key.split(':');
      const itemPhone = itemParts[0];
      const itemText = itemParts.slice(1).join(':');

      return this._normalizePhone(itemPhone) === normPhone && this._normalizeText(itemText) === normText;
    });
  }

  _pruneExpired() {
    const now = Date.now();
    this.list = this.list.filter(item => now - item.timestamp < 15000);
  }

  _normalizePhone(phone) {
    if (!phone) return '';
    return phone.replace(/[^0-9]/g, '');
  }

  _normalizeText(text) {
    if (!text) return '';
    return text.toLowerCase().replace(/[^a-z0-9]/gi, '');
  }
}

const pendingOutgoingMessages = new PendingMessagesTracker();


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
      
      // Prevent double logging of dynamic PDFs
      const pdfKey = `${phoneNumber}:`;
      pendingOutgoingMessages.add(pdfKey);
      setTimeout(() => pendingOutgoingMessages.delete(pdfKey), 8000);

      await client.sendMessage(phoneNumber, media);

      // Log manually sent PDFs to database conversations history
      if (options.logToConversations) {
        let dbMessage = '';
        if (type === 'invoice') {
          dbMessage = '[BOT MENGIRIM PDF INVOICE]';
        } else if (type === 'welcome_guide') {
          dbMessage = `[BOT MENGIRIM PDF WELCOME GUIDE: ${options.resellerLevel || 'Silver'}]`;
        } else {
          dbMessage = '[BOT MENGIRIM PDF PERBANDINGAN]';
        }

        const timestamp = new Date();
        await db('conversations').insert({
          phone_number: phoneNumber,
          message: dbMessage,
          sender: 'agent',
          message_type: 'document',
          status: 'sent',
          timestamp
        });

        emitEvent('incoming_message', {
          phone_number: phoneNumber,
          message: dbMessage,
          sender: 'agent',
          message_type: 'document',
          status: 'sent',
          timestamp
        });
      }
      
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

  // Initialize queue worker
  try {
    const { initQueueWorker } = require('./services/queueWorker');
    initQueueWorker(client);
  } catch (err) {
    logger.error('Failed to initialize queue worker on ready:', err);
  }
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

      // Detect manual outgoing media sent from physical phone
      let finalOutText = messageText;
      let outMessageType = 'text';

      if (msg.hasMedia) {
        const isImg = msg.type === 'image';
        const isDoc = msg.type === 'document';
        const isVid = msg.type === 'video';
        const isAud = msg.type === 'audio';

        if (isImg) {
          outMessageType = 'image';
          finalOutText = '[Gambar]' + (messageText ? ` ${messageText}` : '');
        } else if (isDoc) {
          outMessageType = 'document';
          finalOutText = '[Dokumen]' + (messageText ? ` ${messageText}` : '');
        } else if (isVid) {
          outMessageType = 'document';
          finalOutText = '[Video]' + (messageText ? ` ${messageText}` : '');
        } else if (isAud) {
          outMessageType = 'document';
          finalOutText = '[Audio]';
        } else {
          outMessageType = 'document';
          finalOutText = '[Media]' + (messageText ? ` ${messageText}` : '');
        }
      }

      // Add to conversation history as 'agent'
      await db('conversations').insert({
        phone_number: phoneNumber,
        message: finalOutText || '',
        sender: 'agent',
        message_type: outMessageType,
        status: 'sent',
        timestamp: new Date()
      });

      // Stream to dashboard client so Live Chat is 100% in sync
      emitEvent('incoming_message', {
        phone_number: phoneNumber,
        message: finalOutText || '',
        sender: 'agent',
        message_type: outMessageType,
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

    // 1. Download media if image or document
    let mediaBuffer = null;
    let mediaMime = null;
    let finalMessageText = messageText;
    let isImage = false;
    let isDocument = false;
    let relativeUrl = null;

    if (msg.hasMedia) {
      try {
        const media = await msg.downloadMedia();
        if (media) {
          mediaMime = media.mimetype;
          const isImg = msg.type === 'image' || mediaMime.startsWith('image/');
          const isDoc = msg.type === 'document' || mediaMime.includes('pdf') || mediaMime.includes('document') || mediaMime.includes('sheet') || mediaMime.includes('excel');

          if (isImg) {
            isImage = true;
            mediaBuffer = Buffer.from(media.data, 'base64');
            const ext = mediaMime.split('/')[1] || 'png';
            const filename = `incoming-${Date.now()}-${Math.round(Math.random() * 1e9)}.${ext}`;
            const diskPath = path.join(__dirname, '../learn/images', filename);
            fs.writeFileSync(diskPath, mediaBuffer);
            relativeUrl = `/uploads/${filename}`;
            finalMessageText = `[Gambar: ${relativeUrl}]` + (messageText ? ` ${messageText}` : '');
            logger.info(`Downloaded and saved incoming image to ${diskPath}`);
          } else if (isDoc) {
            isDocument = true;
            let ext = 'pdf';
            if (media.filename && media.filename.includes('.')) {
              ext = media.filename.split('.').pop();
            } else {
              ext = mediaMime.split('/')[1] || 'pdf';
            }
            ext = ext.split(';')[0].trim();
            const filename = `incoming-${Date.now()}-${Math.round(Math.random() * 1e9)}.${ext}`;
            const diskPath = path.join(__dirname, '../learn/images', filename);
            fs.writeFileSync(diskPath, Buffer.from(media.data, 'base64'));
            relativeUrl = `/uploads/${filename}`;
            finalMessageText = `[Dokumen: ${relativeUrl}]` + (messageText ? ` ${messageText}` : '');
            logger.info(`Downloaded and saved incoming document to ${diskPath}`);
          } else {
            finalMessageText = `[Media: ${msg.type}]` + (messageText ? ` ${messageText}` : '');
          }
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
    const dbMsgType = isImage ? 'image' : (isDocument ? 'document' : 'text');
    await db('conversations').insert({
      phone_number: phoneNumber,
      message: finalMessageText || '',
      sender: 'customer',
      message_type: dbMsgType,
      status: 'received',
      timestamp: new Date()
    });

    // Stream incoming message to dashboard Live Chat in real-time
    emitEvent('incoming_message', {
      phone_number: phoneNumber,
      message: finalMessageText || '',
      sender: 'customer',
      message_type: dbMsgType,
      status: 'received',
      timestamp: new Date()
    });

    // Notify UI of updated customer stats (unread badge, last_message_at)
    const updatedCustomer = await db('customers').where('phone_number', phoneNumber).first();
    emitEvent('customer_updated', updatedCustomer);

    // 3. Save to Antrean (chat_request_queue) for asynchronous processing
    await db('chat_request_queue').insert({
      phone_number: phoneNumber,
      message_id: msg.id.id || `msg-${Date.now()}-${Math.round(Math.random() * 1e9)}`,
      message_body: messageText || '',
      message_type: dbMsgType,
      media_path: relativeUrl,
      media_mime: mediaMime,
      status: 'PENDING',
      retry_count: 0
    }).onConflict('message_id').ignore();

    // Trigger queue worker to process the message asynchronously
    const { triggerQueueWorker } = require('./services/queueWorker');
    triggerQueueWorker();

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
  pendingOutgoingMessages,
  asyncGenerateAndSendPdf
};
