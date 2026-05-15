const { startBot } = require('./bot');
const logger = require('./utils/logger');

// Start application
const main = async () => {
  try {
    await startBot();
  } catch (error) {
    logger.error('Fatal error:', error);
    process.exit(1);
  }
};

main();
