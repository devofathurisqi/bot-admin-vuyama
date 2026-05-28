const { startBot } = require('./bot');
const { startServer } = require('./server');
const logger = require('./utils/logger');

// Start application components
const main = async () => {
  try {
    logger.info('Starting Vuyama Suite...');
    
    // 1. Boot up Express Backend & Socket.IO
    startServer();
    
    // 2. Boot up WhatsApp Bot Client
    await startBot();
  } catch (error) {
    logger.error('Fatal boot error in main application:', error);
    process.exit(1);
  }
};

main();
