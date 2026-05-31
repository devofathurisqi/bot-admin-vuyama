const db = require('../utils/db');
const logger = require('../utils/logger');

const run = async () => {
  try {
    logger.info('Altering "products" table to add variants and wholesale_tiers jsonb columns...');
    
    const hasVariants = await db.schema.hasColumn('products', 'variants');
    if (!hasVariants) {
      await db.schema.alterTable('products', (table) => {
        table.jsonb('variants').defaultTo('[]');
        table.jsonb('wholesale_tiers').defaultTo('[]');
      });
      logger.info('Columns "variants" and "wholesale_tiers" added to "products" table successfully!');
    } else {
      logger.info('Columns "variants" and "wholesale_tiers" already exist in "products" table.');
    }
    
    process.exit(0);
  } catch (err) {
    logger.error('Error altering products table:', err);
    process.exit(1);
  }
};

run();
