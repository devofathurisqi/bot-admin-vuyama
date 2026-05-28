const { Client, LocalAuth } = require('whatsapp-web.js');
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
      return;
    }

    // 3. GENERATE BOT RESPONSE
    const response = await messageHandler.generateResponse(phoneNumber, messageText, customer.status);

    // 4. SEND BOT RESPONSE
    await msg.reply(response.response);
    logger.info(`Bot merespons ke ${phoneNumber}: "${response.response.substring(0, 40)}..."`);

    // Save bot reply to database
    await db('conversations').insert({
      phone_number: phoneNumber,
      message: response.response,
      sender: 'bot',
      message_type: 'text',
      status: 'sent',
      timestamp: new Date()
    });

    // Stream bot's reply to dashboard Live Chat in real-time
    emitEvent('incoming_message', {
      phone_number: phoneNumber,
      message: response.response,
      sender: 'bot',
      message_type: 'text',
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
      logger.error('Gemini API not responding! Please verify GEMINI_API_KEY.');
      await logToDb('error', 'Gemini API not responding. Check configuration.');
      process.exit(1);
    }

    logger.info(`Gemini connected! Model: ${gemini.MODEL_NAME}`);
    await logToDb('info', `Gemini AI connected. Model: ${gemini.MODEL_NAME}`);

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
  startBot
};
