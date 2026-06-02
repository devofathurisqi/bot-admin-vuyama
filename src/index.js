const { startBot } = require('./bot');
const { startServer } = require('./server');
const { recoverImages } = require('./scripts/recover_images');
const logger = require('./utils/logger');

// Start application components
const main = async () => {
  try {
    logger.info('Starting Vuyama Suite...');
    
    // 1. Boot up Express Backend & Socket.IO
    startServer();
    
    // 2. Run Image Recovery module in background
    recoverImages().catch(err => logger.error('Error in startup image recovery:', err));
    
    // 3. Boot up WhatsApp Bot Client
    await startBot();
  } catch (error) {
    logger.error('Fatal boot error in main application:', error);
    process.exit(1);
  }
};

main();
