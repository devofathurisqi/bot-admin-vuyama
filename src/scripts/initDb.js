const db = require('../utils/db');
const logger = require('../utils/logger');

const initDb = async () => {
  try {
    logger.info('🚀 Initializing PostgreSQL Database...');

    // Conversations table
    const hasConversations = await db.schema.hasTable('conversations');
    if (!hasConversations) {
      await db.schema.createTable('conversations', (table) => {
        table.increments('id').primary();
        table.string('phone_number').notNullable();
        table.text('message').notNullable();
        table.string('sender').notNullable(); // customer, bot, agent
        table.string('message_type').defaultTo('text');
        table.string('status').defaultTo('received');
        table.timestamp('timestamp').defaultTo(db.fn.now());
        table.index(['phone_number']);
      });
      logger.info('✅ Table "conversations" created');
    }

    // Orders table
    const hasOrders = await db.schema.hasTable('orders');
    if (!hasOrders) {
      await db.schema.createTable('orders', (table) => {
        table.increments('id').primary();
        table.string('phone_number').notNullable();
        table.jsonb('products').notNullable();
        table.decimal('total', 12, 2).notNullable();
        table.text('notes');
        table.string('status').defaultTo('pending');
        table.timestamp('created_at').defaultTo(db.fn.now());
        table.index(['phone_number']);
      });
      logger.info('✅ Table "orders" created');
    }

    // Escalations table
    const hasEscalations = await db.schema.hasTable('escalations');
    if (!hasEscalations) {
      await db.schema.createTable('escalations', (table) => {
        table.increments('id').primary();
        table.string('phone_number').notNullable();
        table.text('reason');
        table.integer('conversation_id');
        table.string('status').defaultTo('open');
        table.timestamp('created_at').defaultTo(db.fn.now());
      });
      logger.info('✅ Table "escalations" created');
    }

    logger.info('✨ Database initialization complete!');
    process.exit(0);
  } catch (error) {
    logger.error('❌ Error initializing database:', error);
    process.exit(1);
  }
};

initDb();
