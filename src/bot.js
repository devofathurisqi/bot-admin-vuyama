const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const logger = require('./utils/logger');
const config = require('./utils/config');
const messageHandler = require('./handlers/messageHandler');
const history = require('./services/history');
const gemini = require('./services/gemini');
const fs = require('fs');
const path = require('path');

// Initialize WhatsApp client
const client = new Client({
  authStrategy: new LocalAuth({
    clientId: config.whatsappSessionName
  }),
  puppeteer: {
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  }
});

// Store for escalated conversations
const escalatedConversations = new Set();

// QR Code handler
client.on('qr', (qr) => {
  logger.info('⏳ Scan QR code untuk connect WhatsApp:');
  qrcode.generate(qr, { small: true });
});

// Ready handler
client.on('ready', () => {
  logger.info(`✅ Bot siap! Logged in as ${config.botName}`);
  logger.info('💬 Menunggu pesan...');
});

// Authenticated handler
client.on('authenticated', () => {
  logger.info('✓ Authentication berhasil');
});

// Message received handler
client.on('message_create', async (msg) => {
  try {
    // Skip if bot's own message or status
    if (msg.fromMe || msg.isStatus) return;

    const phoneNumber = msg.from;
    const messageText = msg.body;
    const isGroup = msg.isGroupMsg;

    // Skip group messages for now
    if (isGroup) {
      logger.debug(`Skipping group message from ${phoneNumber}`);
      return;
    }

    logger.info(`📨 Pesan dari ${phoneNumber}: ${messageText}`);

    // Check if message contains 'vuyama' keyword (case-insensitive)
    const hasVuyamaKeyword = messageText.toLowerCase().includes('vuyama');
    
    if (!hasVuyamaKeyword && !escalatedConversations.has(phoneNumber)) {
      logger.debug(`Skipping message from ${phoneNumber} - no 'vuyama' keyword`);
      return;
    }

    // Save incoming message to history
    await history.addMessage(phoneNumber, messageText, 'customer', 'text');

    // Check if this is an escalated conversation (manual mode)
    if (escalatedConversations.has(phoneNumber)) {
      logger.info(`ℹ️  Escalated mode untuk ${phoneNumber} - pesan diteruskan ke admin`);
      // In production, this would send to admin dashboard/channel
      console.log(`\n🔔 [ESCALATED] ${phoneNumber}: ${messageText}\n`);
      return;
    }

    // Generate bot response
    const response = await messageHandler.generateResponse(phoneNumber, messageText);

    // Check if needs escalation
    if (response.shouldEscalate) {
      logger.info(`🚨 Escalating conversation: ${phoneNumber}`);
      escalatedConversations.add(phoneNumber);

      // Create escalation record
      await history.createEscalation(phoneNumber, response.intent, phoneNumber);

      // Log escalation for admin
      console.log(`\n🚨 === ESCALATION ALERT ===`);
      console.log(`Phone: ${phoneNumber}`);
      console.log(`Reason: ${response.intent}`);
      console.log(`Last message: "${messageText}"`);
      console.log(`Time: ${new Date().toLocaleString('id-ID')}`);
      console.log(`${'='.repeat(25)}\n`);
    }

    // Send bot response
    await msg.reply(response.response);
    logger.info(`✅ Response sent to ${phoneNumber}`);

    // Save bot response to history
    await history.addMessage(phoneNumber, response.response, 'bot', 'text');
  } catch (error) {
    logger.error('Error processing message:', error);
    msg.reply('Maaf, ada kendala teknis. Tim kami sedang membantu 🙏');
  }
});

// Handle connection issues
client.on('disconnected', (reason) => {
  logger.warn(`⚠️  Disconnected: ${reason}`);
});

client.on('auth_failure', (msg) => {
  logger.error(`❌ Authentication failed: ${msg}`);
});

// Initialize bot
const startBot = async () => {
  try {
    logger.info('🤖 Memulai Vuyama AI Customer Service Bot...');
    logger.info(`Environment: ${config.env}`);

    // Check Gemini connection
    logger.info(`🧠 Checking Gemini AI connection...`);
    const geminiReady = await gemini.healthCheck();

    if (!geminiReady) {
      logger.error('❌ Gemini API not responding!');
      logger.error('Please check your GEMINI_API_KEY in .env file');
      process.exit(1);
    }

    logger.info(`✅ Gemini connected! Using model: ${gemini.MODEL_NAME}`);

    // Ensure data directory
    const dataDir = config.dataDir;
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
      logger.info(`📁 Data directory created: ${dataDir}`);
    }

    // Start WhatsApp client
    await client.initialize();
    logger.info('WhatsApp client initialized');
  } catch (error) {
    logger.error('Failed to start bot:', error);
    process.exit(1);
  }
};

// Graceful shutdown
process.on('SIGINT', async () => {
  logger.info('Shutting down bot...');
  await client.destroy();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  logger.info('Shutting down bot...');
  await client.destroy();
  process.exit(0);
});

module.exports = {
  client,
  startBot,
  escalatedConversations
};
