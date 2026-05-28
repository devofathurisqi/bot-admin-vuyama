const { syncExcelToDatabase } = require('../services/knowledge');
const db = require('../utils/db');
const logger = require('../utils/logger');

const run = async () => {
  try {
    logger.info('Starting initial Excel-to-Database synchronization...');
    const result = await syncExcelToDatabase();
    logger.info(`Sync Status: ${result.message}`);
    logger.info('Initial database seeding complete!');
    process.exit(0);
  } catch (error) {
    logger.error('Excel-to-Database synchronization failed:', error);
    process.exit(1);
  }
};

run();
