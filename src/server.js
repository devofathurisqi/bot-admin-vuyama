const express = require('express');
const http = require('http');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const db = require('./utils/db');
const { initSocket, emitEvent } = require('./utils/socket');
const { getBotStatus } = require('./bot_state');
const logger = require('./utils/logger');
const { exec } = require('child_process');

const triggerBackupSync = () => {
  try {
    const { invalidateKnowledgeCache } = require('./services/knowledge');
    invalidateKnowledgeCache();
  } catch (e) {
    logger.error('Failed to invalidate knowledge cache:', e);
  }
  exec('node scratch/sync_backup.js', (err, stdout, stderr) => {
    if (err) {
      logger.error('Error running sync_backup.js:', err);
    } else {
      logger.info('sync_backup.js completed successfully.');
    }
  });
};

const app = express();
const server = http.createServer(app);

// Initialize Socket.IO
initSocket(server);

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Ensure upload, media & pdf directories exist
const uploadDir = path.join(__dirname, '../learn/images');
const mediaDir = path.join(__dirname, '../data/media');
const pdfDir = path.join(__dirname, '../data/pdf');
const colorStockMediaDir = path.join(mediaDir, 'color_stock');
const othersMediaDir = path.join(mediaDir, 'others');

if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
if (!fs.existsSync(mediaDir)) fs.mkdirSync(mediaDir, { recursive: true });
if (!fs.existsSync(pdfDir)) fs.mkdirSync(pdfDir, { recursive: true });
if (!fs.existsSync(colorStockMediaDir)) fs.mkdirSync(colorStockMediaDir, { recursive: true });
if (!fs.existsSync(othersMediaDir)) fs.mkdirSync(othersMediaDir, { recursive: true });

// Serve Static Uploads & PDFs with optimized Cache-Control headers
app.use('/uploads', express.static(uploadDir, {
  maxAge: '7d',
  immutable: true
}));
app.use('/media', express.static(mediaDir, {
  maxAge: '7d',
  immutable: true
}));
app.use('/pdf', express.static(pdfDir, {
  maxAge: '1d',
  immutable: true
}));



const productImgStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, 'product-' + uniqueSuffix + ext);
  }
});
const uploadProductImg = multer({ storage: productImgStorage });

// General Media Gallery Storage (saves to media/others, but routes color stock uploads to color_stock)
const galleryStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const isColorStock = file.originalname.toLowerCase().includes('color stock') || file.originalname.toLowerCase().includes('color_stock') || (req.body && req.body.tag === 'color_stock');
    if (isColorStock) {
      cb(null, colorStockMediaDir);
    } else {
      cb(null, othersMediaDir);
    }
  },
  filename: (req, file, cb) => {
    const isColorStock = file.originalname.toLowerCase().includes('color stock') || file.originalname.toLowerCase().includes('color_stock') || (req.body && req.body.tag === 'color_stock');
    if (isColorStock) {
      // Preserve original name so it overwrites harian color stocks perfectly!
      cb(null, file.originalname);
    } else {
      const ext = path.extname(file.originalname);
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
      cb(null, 'media-' + uniqueSuffix + ext);
    }
  }
});
const uploadGalleryFile = multer({ storage: galleryStorage });

// Stock Colors Specific Storage (saves to media/color_stock and preserves original filename)
const stockColorStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, colorStockMediaDir);
  },
  filename: (req, file, cb) => {
    // Preserve original filename to allow overwrites and matching
    cb(null, file.originalname);
  }
});
const uploadStockColorFile = multer({ storage: stockColorStorage });

/**
 * Realtime Logger Helper to store logs in PostgreSQL and broadcast to clients
 */
const logToDb = async (level, message) => {
  try {
    const timestamp = new Date();
    await db('bot_logs').insert({ level, message, timestamp });
    emitEvent('new_log', { level, message, timestamp });
  } catch (err) {
    logger.error('Error writing bot log to DB:', err);
  }
};

// ======================== API ROUTES ========================

// 1. Bot Connection & Status
app.get('/api/whatsapp/status', (req, res) => {
  res.json(getBotStatus());
});


// 3. Products CRUD
app.get('/api/products', async (req, res) => {
  try {
    const { search, category, limit = 20, page = 1 } = req.query;
    const offset = (page - 1) * limit;

    let query = db('products');

    if (search) {
      const s = `%${search.toLowerCase()}%`;
      query = query.where((q) => {
        q.whereILike('name', s)
         .orWhereILike('id', s)
         .orWhereILike('description', s);
      });
    }

    if (category) {
      query = query.whereILike('category', category);
    }

    const totalRes = await query.clone().count('id as count').first();
    const products = await query.orderBy('id', 'asc').limit(limit).offset(offset);

    // Format fields
    const formatted = products.map(p => ({
      ...p,
      price_retail: parseFloat(p.price_retail),
      price_reseller: parseFloat(p.price_reseller),
      color: typeof p.color === 'string' ? JSON.parse(p.color) : p.color,
      size: typeof p.size === 'string' ? JSON.parse(p.size) : p.size,
      variants: typeof p.variants === 'string' ? JSON.parse(p.variants) : (p.variants || []),
      wholesale_tiers: typeof p.wholesale_tiers === 'string' ? JSON.parse(p.wholesale_tiers) : (p.wholesale_tiers || [])
    }));

    res.json({
      success: true,
      data: formatted,
      pagination: {
        total: parseInt(totalRes.count),
        page: parseInt(page),
        limit: parseInt(limit)
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/products', async (req, res) => {
  try {
    const { id, name, category, sub_category, description, price_retail, price_reseller, color, size, material, weight, stock, image, status, variants, wholesale_tiers } = req.body;
    
    const existing = await db('products').where('id', id).first();
    if (existing) {
      return res.status(400).json({ success: false, error: `Product with ID ${id} already exists.` });
    }

    const payload = {
      id,
      name,
      category,
      sub_category,
      description,
      price_retail: parseFloat(price_retail) || 0,
      price_reseller: parseFloat(price_reseller) || 0,
      color: JSON.stringify(color || []),
      size: JSON.stringify(size || []),
      material,
      weight: parseInt(weight) || 0,
      stock: parseInt(stock) || 0,
      image,
      status: status || 'Tersedia',
      variants: JSON.stringify(variants || []),
      wholesale_tiers: JSON.stringify(wholesale_tiers || [])
    };

    await db('products').insert(payload);
    await db('audit_logs').insert({ action: 'CREATE_PRODUCT', details: `Created product: ${id} - ${name}` });

    triggerBackupSync();

    res.json({ success: true, data: { ...payload, color, size, variants, wholesale_tiers } });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.put('/api/products/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, category, sub_category, description, price_retail, price_reseller, color, size, material, weight, stock, image, status, variants, wholesale_tiers } = req.body;

    const payload = {
      name,
      category,
      sub_category,
      description,
      price_retail: parseFloat(price_retail) || 0,
      price_reseller: parseFloat(price_reseller) || 0,
      color: JSON.stringify(color || []),
      size: JSON.stringify(size || []),
      material,
      weight: parseInt(weight) || 0,
      stock: parseInt(stock) || 0,
      image,
      status: status || 'Tersedia',
      variants: JSON.stringify(variants || []),
      wholesale_tiers: JSON.stringify(wholesale_tiers || []),
      updated_at: new Date()
    };

    await db('products').where('id', id).update(payload);
    await db('audit_logs').insert({ action: 'UPDATE_PRODUCT', details: `Updated product: ${id}` });

    triggerBackupSync();

    res.json({ success: true, data: { id, ...payload, color, size, variants, wholesale_tiers } });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.delete('/api/products/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await db('products').where('id', id).del();
    await db('audit_logs').insert({ action: 'DELETE_PRODUCT', details: `Deleted product: ${id}` });
    
    triggerBackupSync();

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/products/upload-image', uploadProductImg.single('image'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, error: 'No file uploaded.' });
  }
  const imageUrl = `/uploads/${req.file.filename}`;
  res.json({ success: true, url: imageUrl });
});

// 4. CRM Live Chat & Customers
app.get('/api/customers', async (req, res) => {
  try {
    const { status, search } = req.query;
    let query = db('customers');

    if (status) {
      query = query.where('status', status);
    }

    if (search) {
      const s = `%${search.toLowerCase()}%`;
      query = query.where((q) => {
        q.whereILike('name', s)
         .orWhereILike('phone_number', s);
      });
    }

    const customers = await query
      .orderBy('is_pinned', 'desc')
      .orderBy('last_message_at', 'desc');

    res.json({ success: true, data: customers });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/whatsapp/chats/:phoneNumber', async (req, res) => {
  try {
    const { phoneNumber } = req.params;
    
    // Clear unread count when reading chat
    await db('customers').where('phone_number', phoneNumber).update({ unread_count: 0 });
    emitEvent('chat_read', { phone_number: phoneNumber });

    const messages = await db('conversations')
      .where('phone_number', phoneNumber)
      .orderBy('timestamp', 'asc');

    res.json({ success: true, data: messages });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.delete('/api/whatsapp/chats/:phoneNumber', async (req, res) => {
  try {
    const { phoneNumber } = req.params;
    
    // Delete conversations from database
    await db('conversations').where('phone_number', phoneNumber).del();
    
    // Audit logging
    await db('audit_logs').insert({
      action: 'DELETE_CHAT_HISTORY',
      details: `Cleared chat history for customer: ${phoneNumber}`
    });

    // Notify all dashboard clients
    emitEvent('chat_history_cleared', { phone_number: phoneNumber });

    res.json({ success: true, message: 'Chat history cleared.' });
  } catch (error) {
    logger.error('Error clearing chat history:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/whatsapp/send', async (req, res) => {
  try {
    const { phoneNumber, message } = req.body;
    
    // Send message using the global Baileys / WWebJS client
    const { client, pendingOutgoingMessages } = require('./bot');
    
    const key = `${phoneNumber}:${message}`;
    if (pendingOutgoingMessages) {
      pendingOutgoingMessages.add(key);
    }
    try {
      await client.sendMessage(phoneNumber, message);
    } finally {
      if (pendingOutgoingMessages) {
        setTimeout(() => pendingOutgoingMessages.delete(key), 5000);
      }
    }
    
    // Save to conversation history
    const timestamp = new Date();
    await db('conversations').insert({
      phone_number: phoneNumber,
      message,
      sender: 'agent',
      message_type: 'text',
      status: 'sent',
      timestamp
    });

    // Update customer last message time
    await db('customers').where('phone_number', phoneNumber).update({
      last_message_at: timestamp
    });

    // Broadcast manually sent message
    emitEvent('incoming_message', {
      phone_number: phoneNumber,
      message,
      sender: 'agent',
      message_type: 'text',
      status: 'sent',
      timestamp
    });

    // Auto-pause bot for this contact due to manual admin reply from dashboard
    try {
      const { pauseBotForCustomer } = require('./utils/workflow');
      await pauseBotForCustomer(phoneNumber, 12);
    } catch (err) {
      logger.error('Failed to trigger pauseBotForCustomer in send route:', err);
    }

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/whatsapp/send-media', uploadGalleryFile.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No file uploaded.' });
    }
    const { phoneNumber } = req.body;
    if (!phoneNumber) {
      return res.status(400).json({ success: false, error: 'phoneNumber is required.' });
    }
    
    const { client, pendingOutgoingMessages } = require('./bot');
    const { MessageMedia } = require('whatsapp-web.js');

    const isImage = req.file.mimetype.startsWith('image/');
    const isColorStock = req.file.destination.includes('color_stock');
    const filepath = isColorStock 
      ? `/media/color_stock/${req.file.filename}` 
      : `/media/others/${req.file.filename}`;

    const absolutePath = path.join(__dirname, '..', filepath);

    if (!fs.existsSync(absolutePath)) {
      return res.status(400).json({ success: false, error: 'Saved file path not found on disk.' });
    }

    // Send via WhatsApp client
    const media = MessageMedia.fromFilePath(absolutePath);
    
    const mediaKey = `${phoneNumber}:`;
    if (pendingOutgoingMessages) {
      pendingOutgoingMessages.add(mediaKey);
    }

    try {
      await client.sendMessage(phoneNumber, media);
    } finally {
      if (pendingOutgoingMessages) {
        setTimeout(() => pendingOutgoingMessages.delete(mediaKey), 8000);
      }
    }

    // Save to CRM Database Conversations
    const tag = isImage ? 'Gambar' : 'Dokumen';
    const dbMessage = `[${tag}: ${filepath}]`;
    const dbMessageType = isImage ? 'image' : 'document';
    const timestamp = new Date();

    await db('conversations').insert({
      phone_number: phoneNumber,
      message: dbMessage,
      sender: 'agent',
      message_type: dbMessageType,
      status: 'sent',
      timestamp
    });

    // Update customer last message time
    await db('customers').where('phone_number', phoneNumber).update({
      last_message_at: timestamp
    });

    // Broadcast manually sent message
    emitEvent('incoming_message', {
      phone_number: phoneNumber,
      message: dbMessage,
      sender: 'agent',
      message_type: dbMessageType,
      status: 'sent',
      timestamp
    });

    // Auto-pause bot for this contact due to manual admin reply from dashboard
    try {
      const { pauseBotForCustomer } = require('./utils/workflow');
      await pauseBotForCustomer(phoneNumber, 12);
    } catch (err) {
      logger.error('Failed to trigger pauseBotForCustomer in send-media route:', err);
    }

    res.json({ success: true, filepath });
  } catch (error) {
    logger.error('Error sending media via WhatsApp:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Broadcasting: Fetch all active chats/groups
app.get('/api/whatsapp/chats', async (req, res) => {
  try {
    const { client } = require('./bot');
    if (!client) {
      return res.status(400).json({ success: false, error: 'WhatsApp client not active.' });
    }
    const chats = await client.getChats();
    const formatted = chats.map(c => ({
      id: c.id._serialized,
      name: c.name || c.id.user,
      isGroup: c.isGroup,
      isReadOnly: c.isReadOnly || false
    }));
    res.json({ success: true, data: formatted });
  } catch (error) {
    logger.error('Error fetching chats:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Broadcasting: Send message to list of recipients (background worker)
app.post('/api/whatsapp/broadcast', uploadGalleryFile.single('file'), async (req, res) => {
  try {
    const { message, recipients: recipientsRaw } = req.body;
    let recipients = [];
    if (typeof recipientsRaw === 'string') {
      recipients = JSON.parse(recipientsRaw);
    } else if (Array.isArray(recipientsRaw)) {
      recipients = recipientsRaw;
    }

    if (!recipients || recipients.length === 0) {
      return res.status(400).json({ success: false, error: 'Target penerima (recipients) wajib diisi.' });
    }

    const { client } = require('./bot');
    if (!client) {
      return res.status(400).json({ success: false, error: 'WhatsApp client tidak aktif.' });
    }

    let media = null;
    let relativeUrl = null;
    let fileType = 'text';

    if (req.file) {
      const { MessageMedia } = require('whatsapp-web.js');
      const isImage = req.file.mimetype.startsWith('image/');
      const isColorStock = req.file.destination.includes('color_stock');
      const filepath = isColorStock 
        ? `/media/color_stock/${req.file.filename}` 
        : `/media/others/${req.file.filename}`;

      const absolutePath = path.join(__dirname, '..', filepath);
      if (fs.existsSync(absolutePath)) {
        media = MessageMedia.fromFilePath(absolutePath);
        relativeUrl = filepath;
        fileType = isImage ? 'image' : 'document';
      }
    }

    res.json({ success: true, message: `Broadcasting dimulai ke ${recipients.length} penerima.` });

    // Run sending in the background
    (async () => {
      let successCount = 0;
      let failCount = 0;

      for (const target of recipients) {
        try {
          // 1. Ensure target customer exists in CRM
          let customer = await db('customers').where('phone_number', target).first();
          if (!customer) {
            let name = target.split('@')[0];
            try {
              const chat = await client.getChatById(target);
              name = chat.name || name;
            } catch (e) {}

            await db('customers').insert({
              phone_number: target,
              name,
              status: 'NORMAL',
              unread_count: 0,
              last_message_at: new Date()
            });
          }

          // 2. Send message
          if (media) {
            await client.sendMessage(target, media, message ? { caption: message } : undefined);
          } else {
            await client.sendMessage(target, message);
          }

          // 3. Save to CRM Database Conversations
          const finalMsgText = media 
            ? `[${fileType === 'image' ? 'Gambar' : 'Dokumen'}: ${relativeUrl}]` + (message ? ` ${message}` : '')
            : message;

          const timestamp = new Date();
          await db('conversations').insert({
            phone_number: target,
            message: finalMsgText,
            sender: 'agent',
            message_type: fileType,
            status: 'sent',
            timestamp
          });

          // 4. Update customer last message time
          await db('customers').where('phone_number', target).update({
            last_message_at: timestamp
          });

          // 5. Broadcast manually sent message to dashboard live chat
          emitEvent('incoming_message', {
            phone_number: target,
            message: finalMsgText,
            sender: 'agent',
            message_type: fileType,
            status: 'sent',
            timestamp
          });

          successCount++;
          // Delay to prevent getting blocked by WhatsApp
          await new Promise(resolve => setTimeout(resolve, 1000));
        } catch (sendErr) {
          logger.error(`Failed to send broadcast to ${target}:`, sendErr);
          failCount++;
        }
      }

      const summaryMsg = `[Broadcast] Selesai mengirim pesan ke ${successCount} berhasil, ${failCount} gagal.`;
      logger.info(summaryMsg);
      await logToDb('info', summaryMsg);

      await db('audit_logs').insert({
        action: 'BROADCAST_MESSAGE',
        details: `Broadcasted to ${successCount} successful, ${failCount} failed. Message preview: "${message ? message.substring(0, 50) : ''}"`
      });

    })().catch(err => logger.error('Error in background broadcast loop:', err));

  } catch (error) {
    logger.error('Error starting broadcast:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.put('/api/customers/:phoneNumber', async (req, res) => {
  try {
    const { phoneNumber } = req.params;
    const { status, assigned_to, is_pinned, paused_until, notes } = req.body;

    const updates = {};
    if (status !== undefined) {
      updates.status = status;
      if (status === 'NORMAL') {
        updates.paused_until = null;
      }
    }
    if (assigned_to !== undefined) updates.assigned_to = assigned_to;
    if (is_pinned !== undefined) updates.is_pinned = is_pinned;
    if (paused_until !== undefined) {
      updates.paused_until = paused_until ? new Date(paused_until) : null;
    }
    if (notes !== undefined) updates.notes = notes;
    
    updates.updated_at = new Date();

    await db('customers').where('phone_number', phoneNumber).update(updates);
    
    // Fetch updated
    const customer = await db('customers').where('phone_number', phoneNumber).first();
    emitEvent('customer_updated', customer);

    res.json({ success: true, data: customer });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Helper to hydrate order with items and flatten custom specs for backward compatibility
const hydrateOrder = async (order) => {
  if (!order) return null;
  const items = await db('order_items').where('order_id', order.id).orderBy('id', 'asc');
  let customSpecs = {};
  const formattedItems = items.map(item => {
    const specs = typeof item.custom_specs === 'string' ? JSON.parse(item.custom_specs) : (item.custom_specs || {});
    if (Object.keys(specs).length > 0) {
      customSpecs = { ...customSpecs, ...specs };
    }
    return {
      ...item,
      price: parseFloat(item.price),
      subtotal: parseFloat(item.subtotal),
      custom_specs: specs
    };
  });
  return {
    ...order,
    total: parseFloat(order.total),
    shipping_cost: parseFloat(order.shipping_cost),
    grand_total: parseFloat(order.grand_total),
    items: formattedItems,
    brand_name: customSpecs.brand_name || null,
    label_size: customSpecs.label_size || null,
    label_shape: customSpecs.label_shape || null,
    ink_color: customSpecs.ink_color || null,
    label_color: customSpecs.label_color || null,
    font: customSpecs.font || null
  };
};

// 5. Orders API
app.get('/api/orders', async (req, res) => {
  try {
    const { status } = req.query;
    let query = db('orders');
    
    if (status) {
      query = query.where('status', status);
    }
    
    const orders = await query.orderBy('created_at', 'desc');
    const hydratedOrders = [];
    for (const order of orders) {
      const hydrated = await hydrateOrder(order);
      hydratedOrders.push(hydrated);
    }
    res.json({ success: true, data: hydratedOrders });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.put('/api/orders/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { status, total, customer_name, address, phone, items, custom_specs } = req.body;

    const existingOrder = await db('orders').where('id', id).first();
    if (!existingOrder) {
      return res.status(404).json({ success: false, error: 'Order not found.' });
    }
    if (existingOrder.status === 'COMPLETED' || existingOrder.status === 'CANCELLED') {
      return res.status(400).json({ success: false, error: 'Pesanan yang sudah Completed atau Cancelled tidak dapat diedit lagi.' });
    }

    const updates = { updated_at: new Date() };
    if (status !== undefined) updates.status = status;
    if (total !== undefined) updates.total = parseFloat(total) || 0;
    if (customer_name !== undefined) updates.customer_name = customer_name;
    if (address !== undefined) updates.address = address;
    if (phone !== undefined) updates.phone = phone;

    await db('orders').where('id', id).update(updates);

    // Update order items if provided
    if (items && Array.isArray(items)) {
      // Delete existing order items
      await db('order_items').where('order_id', id).del();

      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        const itemQty = parseInt(item.quantity) || 1;
        const itemPrice = parseFloat(item.price) || 0.0;
        const itemSubtotal = itemQty * itemPrice;

        // If this is the first item, we can attach the custom specs
        let specsObj = item.custom_specs || {};
        if (i === 0 && custom_specs) {
          specsObj = { ...specsObj, ...custom_specs };
        }

        await db('order_items').insert({
          order_id: id,
          product_id: item.productId || item.product_id || null,
          product_name: item.product_name || 'Item Pesanan',
          quantity: itemQty,
          price: itemPrice,
          subtotal: itemSubtotal,
          custom_specs: JSON.stringify(specsObj)
        });
      }
    }

    // Invalidate cached invoice PDF
    const cachedPdfPath = path.join(__dirname, '../data/pdf', `invoice_${id}.pdf`);
    if (fs.existsSync(cachedPdfPath)) {
      try {
        fs.unlinkSync(cachedPdfPath);
        logger.info(`Invalidated cached invoice PDF for order #${id}`);
      } catch (err) {
        logger.error(`Failed to delete cached invoice PDF for order #${id}:`, err);
      }
    }

    // Write audit log
    await db('audit_logs').insert({
      action: 'UPDATE_ORDER',
      details: `Updated order ID ${id} (Status: ${status || existingOrder.status}, Total: ${total || existingOrder.total})`
    });

    const rawOrder = await db('orders').where('id', id).first();
    const updatedOrder = await hydrateOrder(rawOrder);
    
    // Unblock customer when order is COMPLETED or CANCELLED
    if (status && (status === 'COMPLETED' || status === 'CANCELLED')) {
      if (updatedOrder && updatedOrder.phone_number) {
        await db('blocked_numbers').where('phone_number', updatedOrder.phone_number).del();
        await db('customers').where('phone_number', updatedOrder.phone_number).update({
          status: 'NORMAL',
          updated_at: new Date()
        });
        const updatedCustomer = await db('customers').where('phone_number', updatedOrder.phone_number).first();
        emitEvent('customer_updated', updatedCustomer);
        emitEvent('number_unblocked', { phone_number: updatedOrder.phone_number });
      }
    }

    emitEvent('order_updated', updatedOrder);

    res.json({ success: true, data: updatedOrder });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.delete('/api/orders/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const order = await db('orders').where('id', id).first();
    if (!order) {
      return res.status(404).json({ success: false, error: 'Order not found.' });
    }

    await db('orders').where('id', id).del();

    // Unblock the customer and update status to NORMAL when order is deleted
    if (order && order.phone_number) {
      await db('blocked_numbers').where('phone_number', order.phone_number).del();
      await db('customers').where('phone_number', order.phone_number).update({
        status: 'NORMAL',
        updated_at: new Date()
      });
      const updatedCustomer = await db('customers').where('phone_number', order.phone_number).first();
      emitEvent('customer_updated', updatedCustomer);
      emitEvent('number_unblocked', { phone_number: order.phone_number });
    }

    // Log audit
    await db('audit_logs').insert({
      action: 'DELETE_ORDER',
      details: `Deleted order ID ${id} for customer ${order.phone_number}`
    });

    emitEvent('order_deleted', { id: parseInt(id) });
    res.json({ success: true, message: 'Order successfully deleted.' });
  } catch (error) {
    logger.error('Error deleting order:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/orders/:id/confirm-purchase', async (req, res) => {
  try {
    const { id } = req.params;
    const { productId, quantity, total, remark, items: bodyItems } = req.body;

    const order = await db('orders').where('id', id).first();
    if (!order) {
      return res.status(404).json({ success: false, error: 'Order not found.' });
    }
    if (order.status === 'COMPLETED' || order.status === 'CANCELLED') {
      return res.status(400).json({ success: false, error: 'Pesanan yang sudah Completed atau Cancelled tidak dapat diselesaikan lagi.' });
    }

    // Wrap single item checkout in array to support backward compatibility
    let items = [];
    if (bodyItems && Array.isArray(bodyItems) && bodyItems.length > 0) {
      items = bodyItems;
    } else if (productId && quantity) {
      items = [
        {
          productId,
          quantity: parseInt(quantity) || 0,
          price: (parseFloat(total) || 0) / (parseInt(quantity) || 1)
        }
      ];
    }

    // Fetch existing custom specs from draft items to preserve them
    const existingDraftItems = await db('order_items').where('order_id', id);
    let preservedSpecs = {};
    for (const item of existingDraftItems) {
      const specs = typeof item.custom_specs === 'string' ? JSON.parse(item.custom_specs) : (item.custom_specs || {});
      if (Object.keys(specs).length > 0) {
        preservedSpecs = { ...preservedSpecs, ...specs };
      }
    }

    // Delete draft items
    await db('order_items').where('order_id', id).del();

    let calculatedTotal = 0;
    for (const item of items) {
      const product = await db('products').where('id', item.productId).first();
      const productName = product ? product.name : 'Unknown Product';
      const itemQty = parseInt(item.quantity) || 0;
      const unitPrice = parseFloat(item.price) || 0;
      const subtotal = itemQty * unitPrice;
      calculatedTotal += subtotal;

      if (product) {
        const newStock = Math.max(0, product.stock - itemQty);
        await db('products').where('id', item.productId).update({ stock: newStock });
        
        await db('audit_logs').insert({
          action: 'DEDUCT_STOCK',
          details: `Deducted stock for product ${item.productId}: -${itemQty} pcs (Order #${id})`
        });
      }

      // Attach preserved specs to label products
      const specs = (product && product.category === 'Label') ? preservedSpecs : {};

      await db('order_items').insert({
        order_id: id,
        product_id: item.productId,
        product_name: productName,
        quantity: itemQty,
        price: unitPrice,
        subtotal: subtotal,
        custom_specs: JSON.stringify(specs)
      });
    }

    const totalVal = total !== undefined ? parseFloat(total) : calculatedTotal;
    let updatedPesananRaw = order.pesanan_raw || '';
    if (remark) {
      updatedPesananRaw += `\n[Remark Admin]: ${remark}`;
    }

    await db('orders').where('id', id).update({
      status: 'COMPLETED',
      total: totalVal,
      pesanan_raw: updatedPesananRaw,
      updated_at: new Date()
    });

    // Unblock customer when order is completed
    if (order.phone_number) {
      await db('blocked_numbers').where('phone_number', order.phone_number).del();
      await db('customers').where('phone_number', order.phone_number).update({
        status: 'NORMAL',
        updated_at: new Date()
      });
      
      const updatedCustomer = await db('customers').where('phone_number', order.phone_number).first();
      emitEvent('customer_updated', updatedCustomer);
      emitEvent('number_unblocked', { phone_number: order.phone_number });
    }

    // Write audit log
    await db('audit_logs').insert({
      action: 'COMPLETE_ORDER',
      details: `Completed order #${id} (Items: ${items.map(i => `${i.productId} x${i.quantity}`).join(', ')}, Total: Rp ${totalVal}, Remark: ${remark || ''})`
    });

    const rawOrder = await db('orders').where('id', id).first();
    const updatedOrder = await hydrateOrder(rawOrder);
    
    emitEvent('order_updated', updatedOrder);
    emitEvent('products_updated');

    res.json({ success: true, data: updatedOrder });
  } catch (error) {
    logger.error('Error confirming order purchase:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Manual PDF Action: Send Invoice PDF
app.post('/api/whatsapp/send-pdf/invoice', async (req, res) => {
  try {
    const { orderId } = req.body;
    if (!orderId) {
      return res.status(400).json({ success: false, error: 'orderId is required.' });
    }
    const order = await db('orders').where('id', orderId).first();
    if (!order) {
      return res.status(404).json({ success: false, error: 'Order not found.' });
    }

    const { client, asyncGenerateAndSendPdf } = require('./bot');
    if (!client || !client.pupBrowser) {
      return res.status(400).json({ success: false, error: 'WhatsApp client or Puppeteer browser not active.' });
    }

    // Trigger PDF invoice sending
    await asyncGenerateAndSendPdf(client, order.phone_number, 'invoice', { orderId, logToConversations: true });
    res.json({ success: true, message: 'PDF invoice generation triggered successfully.' });
  } catch (error) {
    logger.error('Error in send-pdf/invoice endpoint:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Manual PDF Action: Send welcome guide PDF
app.post('/api/whatsapp/send-pdf/welcome', async (req, res) => {
  try {
    const { phoneNumber, resellerLevel } = req.body;
    if (!phoneNumber || !resellerLevel) {
      return res.status(400).json({ success: false, error: 'phoneNumber and resellerLevel are required.' });
    }

    const { client, asyncGenerateAndSendPdf } = require('./bot');
    if (!client || !client.pupBrowser) {
      return res.status(400).json({ success: false, error: 'WhatsApp client or Puppeteer browser not active.' });
    }

    await asyncGenerateAndSendPdf(client, phoneNumber, 'welcome_guide', { resellerLevel, logToConversations: true });
    res.json({ success: true, message: 'PDF Welcome Guide generation triggered successfully.' });
  } catch (error) {
    logger.error('Error in send-pdf/welcome endpoint:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Direct Download Invoice PDF
app.get('/api/orders/:id/invoice/download', async (req, res) => {
  try {
    const { id } = req.params;
    const { client } = require('./bot');
    const docGen = require('./services/documentGenerator');
    
    if (!client || !client.pupBrowser) {
      return res.status(400).json({ success: false, error: 'WhatsApp client/browser tidak aktif.' });
    }

    const pdfPath = await docGen.generateInvoicePdf(client.pupBrowser, id);
    if (fs.existsSync(pdfPath)) {
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename=invoice-${id}.pdf`);
      fs.createReadStream(pdfPath).pipe(res);
    } else {
      res.status(404).json({ success: false, error: 'File PDF Invoice tidak ditemukan.' });
    }
  } catch (error) {
    logger.error('Error downloading invoice PDF:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 6. Complaints API
app.get('/api/complaints', async (req, res) => {
  try {
    const { status } = req.query;
    let query = db('complaints');
    if (status) {
      query = query.where('status', status);
    }
    const complaints = await query.orderBy('created_at', 'desc');
    res.json({ success: true, data: complaints });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.put('/api/complaints/:id/resolve', async (req, res) => {
  try {
    const { id } = req.params;

    const complaint = await db('complaints').where('id', id).first();
    if (!complaint) {
      return res.status(404).json({ success: false, error: 'Complaint not found.' });
    }

    // Resolve complaint
    await db('complaints').where('id', id).update({
      status: 'RESOLVED',
      resolved_at: new Date()
    });

    // Unblock the customer from auto replies
    await db('blocked_numbers').where('phone_number', complaint.phone_number).del();

    // Reset customer status to NORMAL
    await db('customers').where('phone_number', complaint.phone_number).update({
      status: 'NORMAL'
    });

    await logToDb('info', `Complaint resolved for ${complaint.phone_number}. Bot auto-replies unblocked.`);

    await db('audit_logs').insert({
      action: 'RESOLVE_COMPLAINT',
      details: `Resolved complaint for number: ${complaint.phone_number}`
    });

    emitEvent('complaint_resolved', { id: parseInt(id), phone_number: complaint.phone_number });
    
    // Also notify customer state update
    const customer = await db('customers').where('phone_number', complaint.phone_number).first();
    emitEvent('customer_updated', customer);

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.delete('/api/complaints/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const complaint = await db('complaints').where('id', id).first();
    if (!complaint) {
      return res.status(404).json({ success: false, error: 'Complaint not found.' });
    }

    await db('complaints').where('id', id).del();

    // Log audit
    await db('audit_logs').insert({
      action: 'DELETE_COMPLAINT',
      details: `Deleted complaint ID ${id} for number ${complaint.phone_number}`
    });

    emitEvent('complaint_deleted', { id: parseInt(id) });
    res.json({ success: true, message: 'Complaint successfully deleted.' });
  } catch (error) {
    logger.error('Error deleting complaint:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 7. Blocked Numbers API
app.get('/api/blocked-numbers', async (req, res) => {
  try {
    const blocked = await db('blocked_numbers').orderBy('created_at', 'desc');
    res.json({ success: true, data: blocked });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/blocked-numbers', async (req, res) => {
  try {
    const { phone_number, reason } = req.body;

    const existing = await db('blocked_numbers').where('phone_number', phone_number).first();
    if (existing) {
      return res.status(400).json({ success: false, error: 'Number already blocked.' });
    }

    await db('blocked_numbers').insert({ phone_number, reason });
    await db('customers').where('phone_number', phone_number).update({ status: 'WAITING_HUMAN' });

    await logToDb('warn', `Manual block applied to ${phone_number}. Reason: ${reason || 'Manual Admin Block'}`);

    // Broadcast
    emitEvent('number_blocked', { phone_number, reason });
    
    const customer = await db('customers').where('phone_number', phone_number).first();
    emitEvent('customer_updated', customer);

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.delete('/api/blocked-numbers/:phoneNumber', async (req, res) => {
  try {
    const { phoneNumber } = req.params;

    await db('blocked_numbers').where('phone_number', phoneNumber).del();
    await db('customers').where('phone_number', phoneNumber).update({ status: 'NORMAL' });

    await logToDb('info', `Manual block removed from ${phoneNumber}. Bot auto-replies resumed.`);

    emitEvent('number_unblocked', { phone_number: phoneNumber });
    
    const customer = await db('customers').where('phone_number', phoneNumber).first();
    emitEvent('customer_updated', customer);

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 8. Media Gallery API
app.get('/api/media', async (req, res) => {
  try {
    const { search, tag, limit = 12, page = 1 } = req.query;
    const offset = (page - 1) * limit;

    let query = db('media_gallery');

    if (search) {
      const s = `%${search.toLowerCase()}%`;
      query = query.where((q) => {
        q.whereILike('original_name', s)
         .orWhereILike('filename', s);
      });
    }

    if (tag) {
      if (tag === 'color_stock') {
        query = query.where('tag', 'color_stock');
      } else {
        // Tag 'gallery' represents any other files
        query = query.whereNot('tag', 'color_stock');
      }
    }

    const totalRes = await query.clone().count('id as count').first();
    const media = await query.orderBy('created_at', 'desc').limit(limit).offset(offset);

    res.json({
      success: true,
      data: media,
      pagination: {
        total: parseInt(totalRes.count),
        page: parseInt(page),
        limit: parseInt(limit)
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/media/upload', uploadGalleryFile.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No file uploaded.' });
    }
    const { tag } = req.body;
    
    const isColorStock = req.file.destination.includes('color_stock');
    const finalTag = isColorStock ? 'color_stock' : (tag || 'general');
    const filepath = isColorStock ? `/media/color_stock/${req.file.filename}` : `/media/others/${req.file.filename}`;
    
    const payload = {
      filename: req.file.filename,
      original_name: req.file.originalname,
      filepath: filepath,
      mime_type: req.file.mimetype,
      size: req.file.size,
      tag: finalTag
    };

    const [inserted] = await db('media_gallery').insert(payload).returning('*');

    await db('audit_logs').insert({
      action: 'UPLOAD_MEDIA',
      details: `Uploaded media: ${req.file.originalname} to folder ${isColorStock ? 'color_stock' : 'others'}`
    });

    res.json({ success: true, data: inserted });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.delete('/api/media/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    let filename = '';
    let subFolder = '';
    
    if (String(id).startsWith('color-stock-')) {
      filename = String(id).replace('color-stock-', '');
      subFolder = 'color_stock';
    } else if (String(id).startsWith('others-')) {
      filename = String(id).replace('others-', '');
      subFolder = 'others';
    } else if (String(id).startsWith('media-')) {
      filename = String(id).replace('media-', '');
      subFolder = '';
    } else {
      // Fallback to database query if numeric ID
      const media = await db('media_gallery').where('id', id).first();
      if (media) {
        filename = media.filename;
        subFolder = media.filepath.includes('/others/') ? 'others' : (media.filepath.includes('/color_stock/') ? 'color_stock' : '');
        await db('media_gallery').where('id', id).del();
      }
    }
    
    if (filename) {
      const diskPath = path.join(__dirname, '../data/media', subFolder, filename);
      if (fs.existsSync(diskPath)) {
        fs.unlinkSync(diskPath);
      }
      res.json({ success: true });
    } else {
      res.status(404).json({ success: false, error: 'Media not found.' });
    }
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 8b. Stock Colors Swatch Board API
app.get('/api/stock-colors', async (req, res) => {
  try {
    const { category, product_id } = req.query;
    let query = db('stock_colors');
    if (product_id) {
      query = query.where('product_id', product_id);
    } else if (category) {
      query = query.whereILike('category', `%${category}%`);
    }
    const colors = await query.orderBy('created_at', 'desc');
    res.json({ success: true, data: colors });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/stock-colors', uploadStockColorFile.single('file'), async (req, res) => {
  try {
    const { color_name, category, is_ready, product_id } = req.body;
    let image_path = '';

    if (req.file) {
      image_path = `/media/color_stock/${req.file.filename}`;
    } else if (req.body.image_path) {
      image_path = req.body.image_path;
    } else {
      return res.status(400).json({ success: false, error: 'File gambar warna wajib diunggah!' });
    }

    const payload = {
      color_name: color_name || 'Tanpa Nama',
      category: category || 'General',
      image_path,
      is_ready: is_ready === 'false' || is_ready === false ? false : true,
      product_id: product_id || null,
      created_at: new Date(),
      updated_at: new Date()
    };

    const [inserted] = await db('stock_colors').insert(payload).returning('*');

    await db('audit_logs').insert({
      action: 'ADD_STOCK_COLOR',
      details: `Added stock color swatch: ${color_name} for category ${category}${product_id ? ` and product ${product_id}` : ''}`
    });

    res.json({ success: true, data: inserted });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.put('/api/stock-colors/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { color_name, category, is_ready, product_id } = req.body;
    
    const original = await db('stock_colors').where('id', id).first();
    if (!original) {
      return res.status(404).json({ success: false, error: 'Color not found.' });
    }

    const updatePayload = {
      updated_at: new Date()
    };
    if (color_name !== undefined) updatePayload.color_name = color_name;
    if (category !== undefined) updatePayload.category = category;
    if (is_ready !== undefined) {
      updatePayload.is_ready = is_ready === 'false' || is_ready === false ? false : true;
    }
    if (product_id !== undefined) {
      updatePayload.product_id = product_id || null;
    }

    const [updated] = await db('stock_colors')
      .where('id', id)
      .update(updatePayload)
      .returning('*');

    res.json({ success: true, data: updated });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.delete('/api/stock-colors/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const original = await db('stock_colors').where('id', id).first();
    if (!original) {
      return res.status(404).json({ success: false, error: 'Color not found.' });
    }

    // Delete file from disk if it was uploaded
    if (original.image_path.startsWith('/media/')) {
      const filename = path.basename(original.image_path);
      // Determine the directory from image_path or fallback to color_stock
      const subFolder = original.image_path.includes('/color_stock/') ? 'color_stock' : (original.image_path.includes('/others/') ? 'others' : '');
      const diskPath = path.join(__dirname, '../data/media', subFolder, filename);
      if (fs.existsSync(diskPath)) {
        fs.unlinkSync(diskPath);
      }
    }

    await db('stock_colors').where('id', id).del();
    
    await db('audit_logs').insert({
      action: 'DELETE_STOCK_COLOR',
      details: `Deleted stock color swatch: ${original.color_name} for category ${original.category}`
    });

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 8c. Sync Color Stock Information to pdf_knowledge_backup.json
app.post('/api/stock-colors/sync-knowledge', async (req, res) => {
  try {
    const backupPath = path.join(__dirname, '../data/pdf_knowledge_backup.json');
    let backupData = {};
    if (fs.existsSync(backupPath)) {
      try {
        backupData = JSON.parse(fs.readFileSync(backupPath, 'utf8'));
      } catch (err) {
        logger.error('Error parsing pdf_knowledge_backup:', err);
      }
    }

    if (!backupData.metadata) {
      backupData.metadata = {
        title: "Price List Produk, Label dan Packaging Vuyama",
        status: "Official PDF Extraction Backup"
      };
    }

    // Fetch latest stock colors from database
    const dbColors = await db('stock_colors').orderBy('color_name', 'asc');

    // Fetch latest color stock files from directory
    let colorStockFiles = [];
    const colorStockDir = path.join(__dirname, '../data/media/color_stock');
    if (fs.existsSync(colorStockDir)) {
      const files = fs.readdirSync(colorStockDir);
      colorStockFiles = files.filter(f => f.toLowerCase().endsWith('.jpeg') || f.toLowerCase().endsWith('.jpg') || f.toLowerCase().endsWith('.png')).map(f => {
        let baseProductName = f.replace(/\s+Color\s+Stock\.[a-zA-Z0-9]+$/i, '').trim();
        return {
          filename: f,
          product_name: baseProductName,
          path: `/media/color_stock/${f}`
        };
      });
    }

    // Update backupData keys
    backupData.stock_colors = dbColors.map(c => ({
      color_name: c.color_name,
      category: c.category,
      is_ready: c.is_ready,
      image_path: c.image_path,
      product_id: c.product_id || null
    }));
    backupData.color_stock_files = colorStockFiles;
    backupData.metadata.last_update = new Date().toLocaleDateString('id-ID', { year: 'numeric', month: 'long', day: 'numeric' });

    // Write updated JSON back to disk
    fs.writeFileSync(backupPath, JSON.stringify(backupData, null, 2), 'utf8');

    await db('audit_logs').insert({
      action: 'SYNC_KNOWLEDGE_COLORS',
      details: 'Synchronized stock colors information to pdf_knowledge_backup'
    });

    res.json({ success: true, message: 'Stock colors successfully synced to pdf_knowledge_backup.' });
  } catch (error) {
    logger.error('Error syncing stock colors knowledge:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 9. Bot Logs API
app.get('/api/logs', async (req, res) => {
  try {
    const logs = await db('bot_logs').orderBy('timestamp', 'desc').limit(200);
    res.json({ success: true, data: logs });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 10. Settings API
app.get('/api/settings', async (req, res) => {
  try {
    const company = await db('company_info').select('*').orderBy('id', 'asc');
    const reseller = await db('reseller_program').select('*').orderBy('id', 'asc');
    const services = await db('services').select('*').orderBy('id', 'asc');

    res.json({
      success: true,
      data: {
        company,
        reseller,
        services,
        escalationKeywords: process.env.ESCALATION_KEYWORDS
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Company Profile CRUD
app.post('/api/settings/company', async (req, res) => {
  try {
    const { key, label, value } = req.body;
    if (!key || !label || !value) {
      return res.status(400).json({ success: false, error: 'key, label, and value are required.' });
    }

    const [inserted] = await db('company_info').insert({
      key,
      label,
      value,
      created_at: new Date(),
      updated_at: new Date()
    }).returning('*');

    await db('audit_logs').insert({
      action: 'ADD_COMPANY_INFO',
      details: `Added company info: ${key}`
    });

    triggerBackupSync();
    res.json({ success: true, data: inserted });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.put('/api/settings/company/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { key, label, value } = req.body;

    const updates = { updated_at: new Date() };
    if (key !== undefined) updates.key = key;
    if (label !== undefined) updates.label = label;
    if (value !== undefined) updates.value = value;

    await db('company_info').where('id', id).update(updates);
    
    await db('audit_logs').insert({
      action: 'UPDATE_COMPANY_INFO',
      details: `Updated company info: ${id}`
    });

    triggerBackupSync();
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.delete('/api/settings/company/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await db('company_info').where('id', id).del();

    await db('audit_logs').insert({
      action: 'DELETE_COMPANY_INFO',
      details: `Deleted company info: ${id}`
    });

    triggerBackupSync();
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Reseller Program CRUD
app.post('/api/settings/reseller', async (req, res) => {
  try {
    const { level, min_order, price, benefits } = req.body;
    if (!level || price === undefined) {
      return res.status(400).json({ success: false, error: 'level and price are required.' });
    }

    const [inserted] = await db('reseller_program').insert({
      level,
      min_order: min_order || null,
      price: parseFloat(price) || 0,
      benefits: benefits || null,
      created_at: new Date(),
      updated_at: new Date()
    }).returning('*');

    await db('audit_logs').insert({
      action: 'ADD_RESELLER_TIER',
      details: `Added reseller tier: ${level}`
    });

    triggerBackupSync();
    res.json({ success: true, data: inserted });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.put('/api/settings/reseller/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { level, min_order, price, benefits } = req.body;

    const updates = { updated_at: new Date() };
    if (level !== undefined) updates.level = level;
    if (min_order !== undefined) updates.min_order = min_order;
    if (price !== undefined) updates.price = parseFloat(price) || 0;
    if (benefits !== undefined) updates.benefits = benefits;

    await db('reseller_program').where('id', id).update(updates);

    await db('audit_logs').insert({
      action: 'UPDATE_RESELLER_TIER',
      details: `Updated reseller tier: ${id}`
    });

    triggerBackupSync();
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.delete('/api/settings/reseller/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await db('reseller_program').where('id', id).del();

    await db('audit_logs').insert({
      action: 'DELETE_RESELLER_TIER',
      details: `Deleted reseller tier: ${id}`
    });

    triggerBackupSync();
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Serve frontend assets if compiled
const frontendDist = path.join(__dirname, '../dist');
if (fs.existsSync(frontendDist)) {
  app.use(express.static(frontendDist));
  app.get('*', (req, res) => {
    if (path.extname(req.path)) {
      return res.status(404).send('Not Found');
    }
    res.sendFile(path.join(frontendDist, 'index.html'));
  });
}

// Start Listening
const PORT = process.env.PORT || 5000;
const startServer = () => {
  server.listen(PORT, async () => {
    logger.info(`Backend API and WebSockets running on port ${PORT}`);

    // Ensure product_id column exists on stock_colors table (automatic migration)
    try {
      const hasProductId = await db.schema.hasColumn('stock_colors', 'product_id');
      if (!hasProductId) {
        logger.info('Adding product_id column to stock_colors table...');
        await db.schema.table('stock_colors', table => {
          table.string('product_id', 50).nullable().references('id').inTable('products').onDelete('CASCADE');
        });
        logger.info('Successfully added product_id column to stock_colors.');
      }
    } catch (e) {
      logger.error('Failed to run schema update for stock_colors product_id:', e);
    }

    // Ensure chat_request_queue table exists (automatic migration)
    try {
      const hasQueueTable = await db.schema.hasTable('chat_request_queue');
      if (!hasQueueTable) {
        logger.info('Creating chat_request_queue table...');
        await db.schema.createTable('chat_request_queue', table => {
          table.increments('id').primary();
          table.string('phone_number', 50).notNullable();
          table.string('message_id', 150).nullable().unique();
          table.text('message_body').nullable();
          table.string('message_type', 50).defaultTo('text');
          table.string('media_path', 255).nullable();
          table.string('media_mime', 100).nullable();
          table.string('status', 50).defaultTo('PENDING').index();
          table.integer('retry_count').defaultTo(0);
          table.text('error_message').nullable();
          table.timestamp('processed_at').nullable();
          table.timestamp('completed_at').nullable();
          table.timestamps(true, true);
        });
        logger.info('Successfully created chat_request_queue table.');
      }
    } catch (e) {
      logger.error('Failed to run schema update for chat_request_queue:', e);
    }
    
    // Sync physical media folder files into database media_gallery table
    try {
      const colorStockDir = path.join(__dirname, '../data/media/color_stock');
      const othersDir = path.join(__dirname, '../data/media/others');
      const mediaDir = path.join(__dirname, '../data/media');

      const scanAndInsert = async (dir, tag, relativePrefix) => {
        if (!fs.existsSync(dir)) return;
        const files = await fs.promises.readdir(dir);
        for (const f of files) {
          const filePath = path.join(dir, f);
          try {
            const stats = await fs.promises.stat(filePath);
            if (stats.isFile()) {
              const filepath = `${relativePrefix}/${f}`;
              const existing = await db('media_gallery').where('filepath', filepath).first();
              if (!existing) {
                await db('media_gallery').insert({
                  filename: f,
                  original_name: f,
                  filepath: filepath,
                  mime_type: f.toLowerCase().endsWith('.pdf') ? 'application/pdf' : (f.toLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg'),
                  size: stats.size,
                  tag: tag,
                  created_at: stats.mtime
                });
                logger.info(`Synced disk file to DB media_gallery: ${filepath}`);
              }
            }
          } catch (e) {
            // Ignore file specific stat/insert errors
          }
        }
      };

      await scanAndInsert(colorStockDir, 'color_stock', '/media/color_stock');
      await scanAndInsert(othersDir, 'others', '/media/others');

      if (fs.existsSync(mediaDir)) {
        const files = await fs.promises.readdir(mediaDir);
        for (const f of files) {
          const filePath = path.join(mediaDir, f);
          try {
            const stats = await fs.promises.stat(filePath);
            if (stats.isFile()) {
              const filepath = `/media/${f}`;
              const existing = await db('media_gallery').where('filepath', filepath).first();
              if (!existing) {
                await db('media_gallery').insert({
                  filename: f,
                  original_name: f,
                  filepath: filepath,
                  mime_type: f.toLowerCase().endsWith('.pdf') ? 'application/pdf' : (f.toLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg'),
                  size: stats.size,
                  tag: 'others',
                  created_at: stats.mtime
                });
                logger.info(`Synced root disk file to DB media_gallery: ${filepath}`);
              }
            }
          } catch (e) {
            // Ignore file specific stat/insert errors
          }
        }
      }
    } catch (e) {
      logger.error('Failed to sync media files into database on startup:', e);
    }
    
    // Ensure business hours parameters exist in database on startup
    try {
      const defaultSettings = [
        { key: 'ai_always_reply', label: 'AI Selalu Membalas (24/7)', value: 'true' },
        { key: 'business_hours_start', label: 'Jam Mulai Kerja (WIB)', value: '08' },
        { key: 'business_hours_end', label: 'Jam Selesai Kerja (WIB)', value: '17' },
        { key: 'business_workdays', label: 'Hari Kerja (0=Minggu, 1=Senin, dst)', value: '1,2,3,4,5,6' }
      ];
      
      for (const setting of defaultSettings) {
        const existing = await db('company_info').where('key', setting.key).first();
        if (!existing) {
          await db('company_info').insert({
            key: setting.key,
            label: setting.label,
            value: setting.value,
            created_at: new Date(),
            updated_at: new Date()
          });
          logger.info(`Added missing business hours setting on startup: ${setting.key}`);
        }
      }
    } catch (e) {
      logger.error('Failed to initialize business hours settings on startup:', e);
    }
  });
};

module.exports = {
  app,
  server,
  startServer,
  logToDb
};
