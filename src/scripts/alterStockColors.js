const db = require('../utils/db');
const logger = require('../utils/logger');

const run = async () => {
  try {
    logger.info('Checking/creating "stock_colors" table...');
    
    const hasTable = await db.schema.hasTable('stock_colors');
    if (!hasTable) {
      await db.schema.createTable('stock_colors', (table) => {
        table.increments('id').primary();
        table.string('color_name').notNullable();
        table.string('category').nullable(); // e.g. "Mukena", "Hijab", "Label"
        table.string('image_path').notNullable(); // e.g. "/media/media-unique-id.png"
        table.boolean('is_ready').defaultTo(true); // true = Ready, false = Out of Stock (crossed out)
        table.timestamp('created_at').defaultTo(db.fn.now());
        table.timestamp('updated_at').defaultTo(db.fn.now());
      });
      logger.info('Table "stock_colors" created successfully!');
    } else {
      logger.info('Table "stock_colors" already exists.');
    }
    
    process.exit(0);
  } catch (err) {
    logger.error('Error creating stock_colors table:', err);
    process.exit(1);
  }
};

run();
