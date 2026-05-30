const express = require('express');
const http = require('http');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const db = require('./utils/db');
const { initSocket, emitEvent } = require('./utils/socket');
const { getBotStatus } = require('./bot_state');
const { syncExcelToDatabase } = require('./services/knowledge');
const logger = require('./utils/logger');

const app = express();
const server = http.createServer(app);

// Initialize Socket.IO
initSocket(server);

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Ensure upload & media directories exist
const uploadDir = path.join(__dirname, '../learn/images');
const mediaDir = path.join(__dirname, '../data/media');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
if (!fs.existsSync(mediaDir)) fs.mkdirSync(mediaDir, { recursive: true });

// Serve Static Uploads
app.use('/uploads', express.static(uploadDir));
app.use('/media', express.static(mediaDir));

// Multer Storage Configuration
const excelStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, '../learn'));
  },
  filename: (req, file, cb) => {
    cb(null, 'vuyama_data.xlsx'); // Overwrite the main Excel file
  }
});
const uploadExcel = multer({ storage: excelStorage });

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

const galleryStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, mediaDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, 'media-' + uniqueSuffix + ext);
  }
});
const uploadGalleryFile = multer({ storage: galleryStorage });

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

// 2. Excel Migration Sync
app.post('/api/migration/import', uploadExcel.single('file'), async (req, res) => {
  try {
    await logToDb('info', 'Excel upload initiated via dashboard...');
    const result = await syncExcelToDatabase();
    await logToDb('info', 'Excel sync completed successfully!');
    
    // Add audit log
    await db('audit_logs').insert({
      action: 'SYNC_EXCEL',
      details: 'excel file imported and database synced'
    });

    res.json(result);
  } catch (error) {
    await logToDb('error', `Excel migration failed: ${error.message}`);
    res.status(500).json({ success: false, error: error.message });
  }
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
      size: typeof p.size === 'string' ? JSON.parse(p.size) : p.size
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
    const { id, name, category, sub_category, description, price_retail, price_reseller, color, size, material, weight, stock, image, status } = req.body;
    
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
      status: status || 'Tersedia'
    };

    await db('products').insert(payload);
    await db('audit_logs').insert({ action: 'CREATE_PRODUCT', details: `Created product: ${id} - ${name}` });

    res.json({ success: true, data: { ...payload, color, size } });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.put('/api/products/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, category, sub_category, description, price_retail, price_reseller, color, size, material, weight, stock, image, status } = req.body;

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
      updated_at: new Date()
    };

    await db('products').where('id', id).update(payload);
    await db('audit_logs').insert({ action: 'UPDATE_PRODUCT', details: `Updated product: ${id}` });

    res.json({ success: true, data: { id, ...payload, color, size } });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.delete('/api/products/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await db('products').where('id', id).del();
    await db('audit_logs').insert({ action: 'DELETE_PRODUCT', details: `Deleted product: ${id}` });
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

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.put('/api/customers/:phoneNumber', async (req, res) => {
  try {
    const { phoneNumber } = req.params;
    const { status, assigned_to, is_pinned } = req.body;

    const updates = {};
    if (status !== undefined) updates.status = status;
    if (assigned_to !== undefined) updates.assigned_to = assigned_to;
    if (is_pinned !== undefined) updates.is_pinned = is_pinned;
    
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

// 5. Orders API
app.get('/api/orders', async (req, res) => {
  try {
    const { status } = req.query;
    let query = db('orders');
    
    if (status) {
      query = query.where('status', status);
    }
    
    const orders = await query.orderBy('created_at', 'desc');
    res.json({ success: true, data: orders });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.put('/api/orders/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { status, total } = req.body;

    const updates = { updated_at: new Date() };
    if (status !== undefined) updates.status = status;
    if (total !== undefined) updates.total = parseFloat(total) || 0;

    await db('orders').where('id', id).update(updates);

    // Write audit log
    await db('audit_logs').insert({
      action: 'UPDATE_ORDER',
      details: `Updated order ID ${id} to status: ${status}`
    });

    // Notify
    const updatedOrder = await db('orders').where('id', id).first();
    emitEvent('order_updated', updatedOrder);

    res.json({ success: true, data: updatedOrder });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/orders/:id/confirm-purchase', async (req, res) => {
  try {
    const { id } = req.params;
    const { productId, quantity, total } = req.body;

    const order = await db('orders').where('id', id).first();
    if (!order) {
      return res.status(404).json({ success: false, error: 'Order not found.' });
    }

    // 1. Deduct product stock in database
    if (productId && quantity) {
      const product = await db('products').where('id', productId).first();
      if (product) {
        const newStock = Math.max(0, product.stock - parseInt(quantity));
        await db('products').where('id', productId).update({ stock: newStock });
        
        await db('audit_logs').insert({
          action: 'DEDUCT_STOCK',
          details: `Deducted stock for product ${productId}: -${quantity} pcs (Order #${id})`
        });
      }
    }

    // 2. Update order status to CONFIRMED and total price
    const totalVal = parseFloat(total) || 0;
    await db('orders').where('id', id).update({
      status: 'CONFIRMED',
      total: totalVal,
      updated_at: new Date()
    });

    // Write audit log
    await db('audit_logs').insert({
      action: 'CONFIRM_ORDER',
      details: `Confirmed order #${id} (Product: ${productId || 'unknown'}, Qty: ${quantity || 0}, Total: Rp ${totalVal})`
    });

    // Broadcast real-time notifications
    const updatedOrder = await db('orders').where('id', id).first();
    emitEvent('order_updated', updatedOrder);
    emitEvent('products_updated');

    res.json({ success: true, data: updatedOrder });
  } catch (error) {
    logger.error('Error confirming order purchase:', error);
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
    const { tag } = req.query;
    let query = db('media_gallery');
    if (tag) {
      query = query.where('tag', tag);
    }
    const media = await query.orderBy('created_at', 'desc');
    res.json({ success: true, data: media });
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
    
    const payload = {
      filename: req.file.filename,
      original_name: req.file.originalname,
      filepath: `/media/${req.file.filename}`,
      mime_type: req.file.mimetype,
      size: req.file.size,
      tag: tag || 'general'
    };

    const [inserted] = await db('media_gallery').insert(payload).returning('*');

    await db('audit_logs').insert({
      action: 'UPLOAD_MEDIA',
      details: `Uploaded media: ${req.file.originalname} as tag ${tag}`
    });

    res.json({ success: true, data: inserted });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.delete('/api/media/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const media = await db('media_gallery').where('id', id).first();
    if (!media) {
      return res.status(404).json({ success: false, error: 'Media not found.' });
    }

    // Delete from disk
    const diskPath = path.join(__dirname, '../data/media', media.filename);
    if (fs.existsSync(diskPath)) {
      fs.unlinkSync(diskPath);
    }

    // Delete from DB
    await db('media_gallery').where('id', id).del();
    
    res.json({ success: true });
  } catch (error) {
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
    // Read sheets info as settings backup
    const company = await db('company_info').select('*');
    const reseller = await db('reseller_program').select('*');
    const services = await db('services').select('*');

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

app.put('/api/settings/company/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { value } = req.body;

    await db('company_info').where('id', id).update({ value, updated_at: new Date() });
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
    res.sendFile(path.join(frontendDist, 'index.html'));
  });
}

// Start Listening
const PORT = process.env.PORT || 5000;
const startServer = () => {
  server.listen(PORT, () => {
    logger.info(`Backend API and WebSockets running on port ${PORT}`);
  });
};

module.exports = {
  app,
  server,
  startServer,
  logToDb
};
