const db = require('../utils/db');
const logger = require('../utils/logger');

const initDb = async () => {
  try {
    logger.info('Initializing PostgreSQL Database Schema for Vuyama Bot...');

    // Drop old tables first to ensure a clean migration state
    logger.info('Cleaning up old tables...');
    await db.schema.dropTableIfExists('bot_logs');
    await db.schema.dropTableIfExists('audit_logs');
    await db.schema.dropTableIfExists('media_gallery');
    await db.schema.dropTableIfExists('blocked_numbers');
    await db.schema.dropTableIfExists('complaints');
    await db.schema.dropTableIfExists('orders');
    await db.schema.dropTableIfExists('conversations');
    await db.schema.dropTableIfExists('escalations'); // Drop old escalations table
    await db.schema.dropTableIfExists('customers');
    await db.schema.dropTableIfExists('reseller_program');
    await db.schema.dropTableIfExists('faq');
    await db.schema.dropTableIfExists('services');
    await db.schema.dropTableIfExists('company_info');
    await db.schema.dropTableIfExists('products');

    logger.info('Creating new database schema...');

    // 1. Products Table
    await db.schema.createTable('products', (table) => {
      table.string('id').primary(); // Custom Product ID from Excel or manual (e.g. "P001")
      table.string('name').notNullable();
      table.string('category');
      table.string('sub_category');
      table.text('description');
      table.decimal('price_retail', 12, 2).defaultTo(0);
      table.decimal('price_reseller', 12, 2).defaultTo(0);
      table.jsonb('color').defaultTo('[]'); // Array of colors
      table.jsonb('size').defaultTo('[]'); // Array of sizes
      table.string('material');
      table.integer('weight').defaultTo(0); // in grams
      table.integer('stock').defaultTo(0);
      table.string('image'); // Link to image
      table.string('status').defaultTo('Active');
      table.timestamps(true, true);
    });
    logger.info('Table "products" created');

    // 2. Company Info Table
    await db.schema.createTable('company_info', (table) => {
      table.increments('id').primary();
      table.string('key').unique().notNullable(); // e.g. "nama_perusahaan"
      table.string('label').notNullable(); // e.g. "Nama Perusahaan"
      table.text('value').notNullable();
      table.timestamps(true, true);
    });
    logger.info('Table "company_info" created');

    // 3. Services Table
    await db.schema.createTable('services', (table) => {
      table.string('id').primary(); // Service ID (e.g. "S001")
      table.string('name').notNullable();
      table.text('description');
      table.jsonb('benefits').defaultTo('[]');
      table.text('terms');
      table.timestamps(true, true);
    });
    logger.info('Table "services" created');

    // 4. FAQ Table
    await db.schema.createTable('faq', (table) => {
      table.increments('id').primary();
      table.string('category');
      table.text('question').notNullable();
      table.text('answer').notNullable();
      table.timestamps(true, true);
    });
    logger.info('Table "faq" created');

    // 5. Reseller Program Table
    await db.schema.createTable('reseller_program', (table) => {
      table.increments('id').primary();
      table.string('level').notNullable(); // e.g. "Silver", "Gold"
      table.string('min_order');
      table.string('discount');
      table.text('benefits');
      table.timestamps(true, true);
    });
    logger.info('Table "reseller_program" created');

    // 6. Customers Table
    await db.schema.createTable('customers', (table) => {
      table.string('phone_number').primary(); // e.g. "62812345678@c.us"
      table.string('name');
      table.string('status').defaultTo('NORMAL'); // NORMAL, ORDER_PENDING, ORDER_CONFIRMED, WAITING_HUMAN, COMPLAINT
      table.string('assigned_to'); // Admin name
      table.boolean('is_pinned').defaultTo(false);
      table.integer('unread_count').defaultTo(0);
      table.timestamp('last_message_at').defaultTo(db.fn.now());
      table.timestamps(true, true);
    });
    logger.info('Table "customers" created');

    // 7. Conversations Table
    await db.schema.createTable('conversations', (table) => {
      table.increments('id').primary();
      table.string('phone_number').references('phone_number').inTable('customers').onDelete('CASCADE');
      table.text('message').notNullable();
      table.string('sender').notNullable(); // customer, bot, agent
      table.string('message_type').defaultTo('text');
      table.string('status').defaultTo('received');
      table.timestamp('timestamp').defaultTo(db.fn.now());
      table.index(['phone_number']);
    });
    logger.info('Table "conversations" created');

    // 8. Orders Table
    await db.schema.createTable('orders', (table) => {
      table.increments('id').primary();
      table.string('phone_number').references('phone_number').inTable('customers').onDelete('CASCADE');
      table.string('customer_name');
      table.text('address');
      table.string('phone');
      table.text('pesanan_raw');
      table.string('brand_name');
      table.string('label_size');
      table.string('label_shape');
      table.string('ink_color');
      table.string('label_color');
      table.string('font');
      table.string('status').defaultTo('PENDING'); // PENDING, CONFIRMED, PAID, SHIPPED, DELIVERED, CANCELLED
      table.decimal('total', 12, 2).defaultTo(0);
      table.timestamps(true, true);
      table.index(['phone_number']);
    });
    logger.info('Table "orders" created');

    // 9. Complaints Table
    await db.schema.createTable('complaints', (table) => {
      table.increments('id').primary();
      table.string('phone_number').references('phone_number').inTable('customers').onDelete('CASCADE');
      table.text('message');
      table.string('status').defaultTo('OPEN'); // OPEN, RESOLVED
      table.timestamp('created_at').defaultTo(db.fn.now());
      table.timestamp('resolved_at');
    });
    logger.info('Table "complaints" created');

    // 10. Blocked Numbers Table
    await db.schema.createTable('blocked_numbers', (table) => {
      table.string('phone_number').primary();
      table.text('reason');
      table.timestamp('created_at').defaultTo(db.fn.now());
    });
    logger.info('Table "blocked_numbers" created');

    // 11. Media Gallery Table
    await db.schema.createTable('media_gallery', (table) => {
      table.increments('id').primary();
      table.string('filename').notNullable();
      table.string('original_name').notNullable();
      table.string('filepath').notNullable();
      table.string('mime_type').notNullable();
      table.integer('size').notNullable();
      table.string('tag'); // product, label, catalog, general
      table.timestamp('created_at').defaultTo(db.fn.now());
    });
    logger.info('Table "media_gallery" created');

    // 12. Bot Logs Table
    await db.schema.createTable('bot_logs', (table) => {
      table.increments('id').primary();
      table.string('level').defaultTo('info');
      table.text('message').notNullable();
      table.timestamp('timestamp').defaultTo(db.fn.now());
    });
    logger.info('Table "bot_logs" created');

    // 13. Audit Logs Table
    await db.schema.createTable('audit_logs', (table) => {
      table.increments('id').primary();
      table.string('action').notNullable();
      table.text('details');
      table.timestamp('created_at').defaultTo(db.fn.now());
    });
    logger.info('Table "audit_logs" created');

    logger.info('All database tables initialized successfully!');
    process.exit(0);
  } catch (error) {
    logger.error('Error during database schema initialization:', error);
    process.exit(1);
  }
};

initDb();
