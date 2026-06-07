const db = require('./db');
const logger = require('./logger');
const fs = require('fs');
const path = require('path');

async function recreateDatabase() {
  try {
    logger.info('Starting database restructuration (Total Rebuild)...');

    // 1. Drop tables with CASCADE to clean up everything
    const tablesToDrop = [
      'audit_logs',
      'blocked_numbers',
      'bot_logs',
      'company_info',
      'complaints',
      'conversation_memories',
      'conversations',
      'order_items',
      'orders',
      'products',
      'reseller_program',
      'services',
      'stock_colors',
      'media_gallery',
      'customers',
      'faq'
    ];

    for (const table of tablesToDrop) {
      logger.info(`Dropping table ${table} if exists (CASCADE)...`);
      await db.raw(`DROP TABLE IF EXISTS "${table}" CASCADE`);
    }

    logger.info('All tables dropped successfully.');

    // 2. Create company_info table
    logger.info('Creating company_info table...');
    await db.schema.createTable('company_info', (table) => {
      table.increments('id').primary();
      table.string('key', 100).unique().notNullable();
      table.string('label', 100).notNullable();
      table.text('value').notNullable();
      table.timestamp('created_at').defaultTo(db.fn.now());
      table.timestamp('updated_at').defaultTo(db.fn.now());
    });

    // 3. Create customers table
    logger.info('Creating customers table...');
    await db.schema.createTable('customers', (table) => {
      table.string('phone_number', 50).primary();
      table.string('name', 255).notNullable().defaultTo('Customer');
      table.string('status', 50).notNullable().defaultTo('NORMAL'); // NORMAL, WAITING_HUMAN, ORDER_PENDING, ORDER_CONFIRMED
      table.string('assigned_to', 100).nullable();
      table.boolean('is_pinned').notNullable().defaultTo(false);
      table.integer('unread_count').notNullable().defaultTo(0);
      table.timestamp('last_message_at').nullable();
      table.timestamp('paused_until').nullable(); // Smart Auto-Resume Timer
      table.text('notes').nullable(); // Admin notes
      table.timestamp('created_at').defaultTo(db.fn.now());
      table.timestamp('updated_at').defaultTo(db.fn.now());
    });

    // 4. Create products table
    logger.info('Creating products table...');
    await db.schema.createTable('products', (table) => {
      table.string('id', 50).primary();
      table.string('name', 255).notNullable();
      table.string('category', 100).notNullable(); // Hijab, Mukena, Inner, Label, Packaging
      table.string('sub_category', 100).nullable();
      table.text('description').nullable();
      table.decimal('price_retail', 12, 2).notNullable().defaultTo(0.00);
      table.decimal('price_reseller', 12, 2).notNullable().defaultTo(0.00);
      table.jsonb('color').notNullable().defaultTo('[]');
      table.jsonb('size').notNullable().defaultTo('[]');
      table.string('material', 255).nullable();
      table.integer('weight').notNullable().defaultTo(0); // in grams
      table.integer('stock').notNullable().defaultTo(0);
      table.text('image').nullable();
      table.string('status', 50).notNullable().defaultTo('Tersedia'); // Tersedia, Habis
      table.jsonb('variants').notNullable().defaultTo('[]');
      table.jsonb('wholesale_tiers').notNullable().defaultTo('[]');
      table.timestamp('created_at').defaultTo(db.fn.now());
      table.timestamp('updated_at').defaultTo(db.fn.now());
    });

    // 5. Create reseller_program table
    logger.info('Creating reseller_program table...');
    await db.schema.createTable('reseller_program', (table) => {
      table.increments('id').primary();
      table.string('level', 100).notNullable();
      table.string('min_order', 100).nullable();
      table.decimal('price', 12, 2).notNullable().defaultTo(0.00);
      table.text('benefits').nullable();
      table.timestamp('created_at').defaultTo(db.fn.now());
      table.timestamp('updated_at').defaultTo(db.fn.now());
    });

    // 6. Create services table
    logger.info('Creating services table...');
    await db.schema.createTable('services', (table) => {
      table.string('id', 50).primary();
      table.string('name', 255).notNullable();
      table.text('description').nullable();
      table.jsonb('benefits').notNullable().defaultTo('[]');
      table.text('terms').nullable();
      table.timestamp('created_at').defaultTo(db.fn.now());
      table.timestamp('updated_at').defaultTo(db.fn.now());
    });

    // 7. Create conversations table
    logger.info('Creating conversations table...');
    await db.schema.createTable('conversations', (table) => {
      table.increments('id').primary();
      table.string('phone_number', 50).notNullable().references('phone_number').inTable('customers').onDelete('CASCADE');
      table.text('message').notNullable();
      table.string('sender', 50).notNullable(); // customer, bot, agent
      table.string('message_type', 50).notNullable().defaultTo('text'); // text, image, document
      table.string('status', 50).notNullable().defaultTo('sent'); // received, sent
      table.timestamp('timestamp').defaultTo(db.fn.now());
    });

    // 8. Create orders table (Relational Metadata Header)
    logger.info('Creating orders table (Relational)...');
    await db.schema.createTable('orders', (table) => {
      table.increments('id').primary();
      table.string('phone_number', 50).notNullable().references('phone_number').inTable('customers').onDelete('CASCADE');
      table.string('customer_name', 255).nullable();
      table.text('address').nullable();
      table.string('phone', 50).nullable();
      table.text('pesanan_raw').nullable();
      table.string('status', 50).notNullable().defaultTo('PENDING'); // PENDING, CONFIRMED, PAID, SHIPPED, COMPLETED, CANCELLED
      table.decimal('total', 12, 2).notNullable().defaultTo(0.00);
      table.decimal('shipping_cost', 12, 2).notNullable().defaultTo(0.00);
      table.decimal('grand_total', 12, 2).notNullable().defaultTo(0.00);
      table.timestamp('created_at').defaultTo(db.fn.now());
      table.timestamp('updated_at').defaultTo(db.fn.now());
    });

    // 9. Create order_items table (Relational Normalized Breakdown)
    logger.info('Creating order_items table...');
    await db.schema.createTable('order_items', (table) => {
      table.increments('id').primary();
      table.integer('order_id').notNullable().references('id').inTable('orders').onDelete('CASCADE');
      table.string('product_id', 50).nullable().references('id').inTable('products').onDelete('SET NULL');
      table.string('product_name', 255).notNullable();
      table.integer('quantity').notNullable().defaultTo(1);
      table.decimal('price', 12, 2).notNullable().defaultTo(0.00);
      table.decimal('subtotal', 12, 2).notNullable().defaultTo(0.00);
      table.jsonb('custom_specs').nullable().defaultTo('{}'); // Stores brand_name, label_size, ink_color, layout, etc.
      table.timestamp('created_at').defaultTo(db.fn.now());
      table.timestamp('updated_at').defaultTo(db.fn.now());
    });

    // 10. Create complaints table
    logger.info('Creating complaints table...');
    await db.schema.createTable('complaints', (table) => {
      table.increments('id').primary();
      table.string('phone_number', 50).notNullable().references('phone_number').inTable('customers').onDelete('CASCADE');
      table.text('message').notNullable();
      table.string('status', 50).notNullable().defaultTo('OPEN'); // OPEN, RESOLVED
      table.timestamp('created_at').defaultTo(db.fn.now());
      table.timestamp('resolved_at').nullable();
    });

    // 11. Create blocked_numbers table
    logger.info('Creating blocked_numbers table...');
    await db.schema.createTable('blocked_numbers', (table) => {
      table.string('phone_number', 50).primary();
      table.text('reason').nullable();
      table.timestamp('created_at').defaultTo(db.fn.now());
    });

    // 12. Create faq table
    logger.info('Creating faq table...');
    await db.schema.createTable('faq', (table) => {
      table.increments('id').primary();
      table.string('category', 100).notNullable();
      table.text('question').notNullable();
      table.text('answer').notNullable();
      table.timestamp('created_at').defaultTo(db.fn.now());
      table.timestamp('updated_at').defaultTo(db.fn.now());
    });

    // 13. Create media_gallery table
    logger.info('Creating media_gallery table...');
    await db.schema.createTable('media_gallery', (table) => {
      table.increments('id').primary();
      table.string('filename', 255).notNullable();
      table.string('original_name', 255).notNullable();
      table.string('filepath', 255).notNullable();
      table.string('mime_type', 100).notNullable();
      table.integer('size').notNullable();
      table.string('tag', 100).nullable();
      table.timestamp('created_at').defaultTo(db.fn.now());
    });

    // 14. Create stock_colors table
    logger.info('Creating stock_colors table...');
    await db.schema.createTable('stock_colors', (table) => {
      table.increments('id').primary();
      table.string('color_name', 100).notNullable();
      table.string('category', 100).notNullable();
      table.string('image_path', 255).notNullable();
      table.boolean('is_ready').notNullable().defaultTo(true);
      table.timestamp('created_at').defaultTo(db.fn.now());
      table.timestamp('updated_at').defaultTo(db.fn.now());
    });

    // 15. Create conversation_memories table
    logger.info('Creating conversation_memories table...');
    await db.schema.createTable('conversation_memories', (table) => {
      table.string('phone_number', 50).primary().references('phone_number').inTable('customers').onDelete('CASCADE');
      table.text('summary').nullable();
      table.string('extracted_intent', 100).nullable();
      table.string('conversation_state', 100).nullable();
      table.timestamp('last_summarized_at').nullable();
      table.timestamp('created_at').defaultTo(db.fn.now());
      table.timestamp('updated_at').defaultTo(db.fn.now());
    });

    // 16. Create bot_logs table
    logger.info('Creating bot_logs table...');
    await db.schema.createTable('bot_logs', (table) => {
      table.increments('id').primary();
      table.string('level', 50).notNullable();
      table.text('message').notNullable();
      table.timestamp('timestamp').defaultTo(db.fn.now());
    });

    // 17. Create audit_logs table
    logger.info('Creating audit_logs table...');
    await db.schema.createTable('audit_logs', (table) => {
      table.increments('id').primary();
      table.string('action', 100).notNullable();
      table.text('details').nullable();
      table.timestamp('created_at').defaultTo(db.fn.now());
    });

    logger.info('Database schema created successfully. Loading seed data...');

    // Load master configuration data from JSON
    const vuyamaKnowledgePath = path.join(__dirname, '../../data/vuyama_knowledge.json');
    if (!fs.existsSync(vuyamaKnowledgePath)) {
      throw new Error(`Master knowledge file not found at ${vuyamaKnowledgePath}`);
    }
    const knowledge = JSON.parse(fs.readFileSync(vuyamaKnowledgePath, 'utf8'));

    // A. Seed company_info
    logger.info('Seeding company_info...');
    const companyLabels = {
      nama_perusahaan: 'Nama Perusahaan',
      alamat: 'Alamat',
      kontak: 'Kontak',
      whatsapp_cs: 'WhatsApp CS',
      instagram: 'Instagram',
      jam_operasional: 'Jam Operasional',
      metode_pembayaran: 'Metode Pembayaran',
      area_layanan: 'Area Layanan',
      ketentuan_garansi: 'Ketentuan Garansi',
      deskripsi_singkat: 'Deskripsi Singkat',
      visi_misi: 'Visi & Misi',
      website: 'Website',
      ai_always_reply: 'AI Selalu Membalas (24/7)',
      business_hours_start: 'Jam Mulai Kerja (WIB)',
      business_hours_end: 'Jam Selesai Kerja (WIB)',
      business_workdays: 'Hari Kerja (0=Minggu, 1=Senin, dst)'
    };

    const companyData = Object.entries(knowledge.company).map(([key, value]) => ({
      key,
      label: companyLabels[key] || key,
      value
    }));

    // Append default business hours keys if they don't exist in knowledge
    if (!companyData.some(d => d.key === 'ai_always_reply')) {
      companyData.push({ key: 'ai_always_reply', label: companyLabels.ai_always_reply, value: 'true' });
    }
    if (!companyData.some(d => d.key === 'business_hours_start')) {
      companyData.push({ key: 'business_hours_start', label: companyLabels.business_hours_start, value: '08' });
    }
    if (!companyData.some(d => d.key === 'business_hours_end')) {
      companyData.push({ key: 'business_hours_end', label: companyLabels.business_hours_end, value: '17' });
    }
    if (!companyData.some(d => d.key === 'business_workdays')) {
      companyData.push({ key: 'business_workdays', label: companyLabels.business_workdays, value: '1,2,3,4,5,6' });
    }

    await db('company_info').insert(companyData);

    // B. Seed products
    logger.info('Seeding products...');
    const productData = knowledge.products.map(p => ({
      id: p.id,
      name: p.name,
      category: p.category,
      sub_category: p.sub_category,
      description: p.description,
      price_retail: p.price_retail,
      price_reseller: p.price_reseller,
      color: JSON.stringify(p.color || []),
      size: JSON.stringify(p.size || []),
      material: p.material,
      weight: p.weight,
      stock: p.stock,
      image: p.image,
      status: p.status,
      variants: JSON.stringify(p.variants || []),
      wholesale_tiers: JSON.stringify(p.wholesale_tiers || [])
    }));
    await db('products').insert(productData);

    // C. Seed reseller_program
    logger.info('Seeding reseller_program...');
    await db('reseller_program').insert(knowledge.reseller_program);

    // D. Seed services
    logger.info('Seeding services...');
    const serviceData = knowledge.services.map(s => ({
      id: s.id,
      name: s.name,
      description: s.description,
      benefits: JSON.stringify(s.benefits || []),
      terms: s.terms
    }));
    await db('services').insert(serviceData);

    // E. Seed FAQ
    logger.info('Seeding faq...');
    await db('faq').insert(knowledge.faq);

    logger.info('Database restructuring and dynamic seeding completed successfully!');
  } catch (error) {
    logger.error('Failed to recreate database and seed:', error);
    throw error;
  }
}

if (require.main === module) {
  recreateDatabase()
    .then(() => {
      logger.info('Successfully initialized the database.');
      process.exit(0);
    })
    .catch((err) => {
      logger.error('Error during database initialization:', err);
      process.exit(1);
    });
}

module.exports = { recreateDatabase };
