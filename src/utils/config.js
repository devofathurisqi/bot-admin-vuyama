require('dotenv').config();

module.exports = {
  env: process.env.NODE_ENV || 'development',
  botName: process.env.BOT_NAME || 'Vumin',
  logLevel: process.env.LOG_LEVEL || 'info',
  dataDir: process.env.DATA_DIR || './data',
  whatsappSessionName: process.env.WHATSAPP_SESSION_NAME || 'vuyama-session',
  escalationKeywords: (process.env.ESCALATION_KEYWORDS || '').split(',').map(k => k.trim()),
  contextMessagesLimit: parseInt(process.env.CONTEXT_MESSAGES_LIMIT || '10'),
  isDev: process.env.NODE_ENV === 'development'
};
