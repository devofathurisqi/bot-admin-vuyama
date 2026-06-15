const fs = require('fs');
const path = require('path');
const db = require('../utils/db');
const logger = require('../utils/logger');
const messageHandler = require('../handlers/messageHandler');
const { MessageMedia } = require('whatsapp-web.js');

let whatsappClient = null;
let isWorkerRunning = false;

/**
 * Initialize Queue Worker with WhatsApp Client reference
 * @param {Client} client 
 */
const initQueueWorker = (client) => {
  whatsappClient = client;
  logger.info('[QueueWorker] Initialized successfully with WhatsApp Client.');
  triggerQueueWorker();
};

/**
 * Trigger the queue processing loop
 */
const triggerQueueWorker = () => {
  processQueue().catch(err => {
    logger.error('[QueueWorker] Error in triggered queue processing:', err);
  });
};

/**
 * Main queue processing loop
 */
const processQueue = async () => {
  if (isWorkerRunning) return;
  isWorkerRunning = true;

  try {
    while (true) {
      if (!whatsappClient) {
        logger.warn('[QueueWorker] WhatsApp client is not initialized yet. Skipping loop.');
        break;
      }

      // Find all phone numbers that are currently being processed
      const processingNumbers = await db('chat_request_queue')
        .where('status', 'PROCESSING')
        .distinct('phone_number')
        .pluck('phone_number');

      // Find the next oldest PENDING or FAILED request (with retry < 3)
      let query = db('chat_request_queue')
        .whereIn('status', ['PENDING', 'FAILED'])
        .where('retry_count', '<', 3)
        .andWhere(function() {
          this.where('status', 'PENDING')
            .orWhere('updated_at', '<', new Date(Date.now() - 5000)); // wait 5s to retry
        });

      if (processingNumbers.length > 0) {
        query = query.whereNotIn('phone_number', processingNumbers);
      }

      const nextRequest = await query.orderBy('id', 'asc').first();

      if (!nextRequest) {
        // No more items to process
        break;
      }

      logger.info(`[QueueWorker] Processing message ID ${nextRequest.id} for ${nextRequest.phone_number}`);

      // 1. Mark as PROCESSING
      await db('chat_request_queue')
        .where('id', nextRequest.id)
        .update({
          status: 'PROCESSING',
          processed_at: new Date(),
          updated_at: new Date()
        });

      try {
        await processSingleRequest(nextRequest);

        // 2. Mark as SENT/COMPLETED
        await db('chat_request_queue')
          .where('id', nextRequest.id)
          .update({
            status: 'SENT',
            completed_at: new Date(),
            updated_at: new Date()
          });

        logger.info(`[QueueWorker] Successfully processed message ID ${nextRequest.id}`);
      } catch (err) {
        logger.error(`[QueueWorker] Failed to process message ID ${nextRequest.id}:`, err);

        // 3. Mark as FAILED for retry
        await db('chat_request_queue')
          .where('id', nextRequest.id)
          .update({
            status: 'FAILED',
            retry_count: nextRequest.retry_count + 1,
            error_message: err.message,
            updated_at: new Date()
          });
      }
    }
  } catch (globalErr) {
    logger.error('[QueueWorker] Global error in queue worker loop:', globalErr);
  } finally {
    isWorkerRunning = false;
  }
};

/**
 * Process a single request row
 * @param {Object} request 
 */
const processSingleRequest = async (request) => {
  const phoneNumber = request.phone_number;
  const messageText = request.message_body || '';
  const isImage = request.message_type === 'image';

  // 1. Check if customer is blocked, paused, or muted
  const customer = await db('customers').where('phone_number', phoneNumber).first();
  if (!customer) {
    throw new Error(`Customer with phone number ${phoneNumber} not found in CRM`);
  }

  const isBlocked = await db('blocked_numbers').where('phone_number', phoneNumber).first();
  const isPaused = customer.paused_until && new Date(customer.paused_until) > new Date();
  const isMutedStatus = ['WAITING_HUMAN', 'ORDER_PENDING', 'ORDER_CONFIRMED'].includes(customer.status);

  if (isBlocked || isPaused || isMutedStatus) {
    logger.info(`[QueueWorker] Bot CS is muted/paused for ${phoneNumber}. Checking if order format needs parsing.`);
    
    // OPTIMIZATION: If muted user sends filled order format, still parse it for order board but keep bot silent
    if (messageHandler.isFilledOrderFormat(messageText)) {
      logger.info(`[QueueWorker] Muted customer ${phoneNumber} sent filled order format. Parsing for order board...`);
      const parsed = await messageHandler.parseOrderFormatWithGemini(messageText);
      const existingPendingOrder = await db('orders')
        .where('phone_number', phoneNumber)
        .andWhere('status', 'PENDING')
        .orderBy('id', 'desc')
        .first();

      let orderId;
      const orderHeader = {
        customer_name: parsed.customer_name || (existingPendingOrder ? existingPendingOrder.customer_name : 'Customer Vuyama'),
        address: parsed.address,
        phone: parsed.phone,
        pesanan_raw: parsed.pesanan_raw,
        updated_at: new Date()
      };

      const customSpecs = {
        brand_name: parsed.brand_name,
        label_size: parsed.label_size,
        label_shape: parsed.label_shape,
        ink_color: parsed.ink_color,
        label_color: parsed.label_color,
        font: parsed.font
      };

      if (existingPendingOrder) {
        orderId = existingPendingOrder.id;
        await db('orders').where('id', orderId).update(orderHeader);
        
        const existingItem = await db('order_items').where('order_id', orderId).first();
        if (existingItem) {
          await db('order_items').where('id', existingItem.id).update({
            product_name: parsed.pesanan_raw || 'Label Custom',
            custom_specs: JSON.stringify(customSpecs),
            updated_at: new Date()
          });
        } else {
          await db('order_items').insert({
            order_id: orderId,
            product_name: parsed.pesanan_raw || 'Label Custom',
            quantity: 1,
            price: 0,
            subtotal: 0,
            custom_specs: JSON.stringify(customSpecs)
          });
        }
      } else {
        const [orderIdObj] = await db('orders').insert({
          phone_number: phoneNumber,
          customer_name: orderHeader.customer_name,
          address: orderHeader.address,
          phone: orderHeader.phone,
          pesanan_raw: orderHeader.pesanan_raw,
          status: 'PENDING',
          total: 0
        }).returning('id');
        orderId = orderIdObj ? orderIdObj.id : null;

        await db('order_items').insert({
          order_id: orderId,
          product_name: parsed.pesanan_raw || 'Label Custom',
          quantity: 1,
          price: 0,
          subtotal: 0,
          custom_specs: JSON.stringify(customSpecs)
        });
      }

      await db('customers').where('phone_number', phoneNumber).update({
        status: 'ORDER_CONFIRMED',
        updated_at: new Date()
      });

      const rawOrder = await db('orders').where('id', orderId).first();
      const items = await db('order_items').where('order_id', orderId);
      const updatedOrder = {
        ...rawOrder,
        items,
        brand_name: customSpecs.brand_name || null,
        label_size: customSpecs.label_size || null,
        label_shape: customSpecs.label_shape || null,
        ink_color: customSpecs.ink_color || null,
        label_color: customSpecs.label_color || null,
        font: customSpecs.font || null
      };

      const { emitEvent } = require('../utils/socket');
      emitEvent('order_updated', updatedOrder);
      const updatedCustomer = await db('customers').where('phone_number', phoneNumber).first();
      emitEvent('customer_updated', updatedCustomer);
    }
    return; // Bot stays silent
  }

  // 2. Load media if image
  let imageBuffer = null;
  let imageMime = null;
  if (isImage && request.media_path) {
    const absolutePath = path.join(__dirname, '../..', request.media_path);
    if (fs.existsSync(absolutePath)) {
      imageBuffer = fs.readFileSync(absolutePath);
      imageMime = request.media_mime;
    }
  }

  // 3. Generate response
  const response = await messageHandler.generateResponse(
    phoneNumber,
    messageText,
    customer.status,
    imageBuffer,
    imageMime
  );

  // 4. Send response to WhatsApp
  const imgRegex = /\[SEND_IMAGE:\s*([^\]]+)\]/gi;
  const docRegex = /\[SEND_DOCUMENT:\s*([^\]]+)\]/gi;
  
  let replyText = response.response;
  
  // Detect comparison PDF trigger
  const isComp = replyText.includes('[COMPARISON_SHEET]');
  replyText = replyText.replace(/\[COMPARISON_SHEET\]/gi, '').trim();

  // Detect invoice PDF trigger
  const isInvoice = replyText.includes('[INVOICE_SHEET]');
  replyText = replyText.replace(/\[INVOICE_SHEET\]/gi, '').trim();

  // Detect welcome guide PDF trigger
  const welcomeGuideRegex = /\[WELCOME_GUIDE:\s*([^\]]+)\]/gi;
  let resellerLevel = null;
  const welcomeMatch = welcomeGuideRegex.exec(replyText);
  if (welcomeMatch) {
    resellerLevel = welcomeMatch[1].trim();
  }
  replyText = replyText.replace(welcomeGuideRegex, '').trim();

  // Extract all images
  let imgMatches = [...replyText.matchAll(imgRegex)].map(m => m[1].trim());
  replyText = replyText.replace(imgRegex, '').trim();
  
  // Filter out comparison images
  imgMatches = imgMatches.filter(img => !img.includes('comparison'));
  
  // Extract all documents
  const docMatches = [...replyText.matchAll(docRegex)].map(m => m[1].trim());
  replyText = replyText.replace(docRegex, '').trim();

  // Handle outgoing lock prevention
  const { pendingOutgoingMessages, asyncGenerateAndSendPdf } = require('../bot');
  const key = `${phoneNumber}:${response.response}`;
  if (pendingOutgoingMessages) {
    pendingOutgoingMessages.add(key);
  }
  
  let sentMsg = null;

  try {
    // A. Send text message
    if (replyText.length > 0) {
      try {
        const chat = await whatsappClient.getChatById(phoneNumber);
        await chat.sendStateTyping();
        await new Promise(resolve => setTimeout(resolve, 1500));
      } catch (e) {}

      sentMsg = await whatsappClient.sendMessage(phoneNumber, replyText);
      logger.info(`[QueueWorker] Sent text response to ${phoneNumber}: "${replyText.substring(0, 50)}..."`);
    }

    // B. Send images
    if (imgMatches.length > 0) {
      (async () => {
        await new Promise(resolve => setTimeout(resolve, 2500));
        
        for (const imagePath of imgMatches) {
          let absolutePath = null;
          if (imagePath.startsWith('/uploads/')) {
            absolutePath = path.join(__dirname, '../../learn/images', path.basename(imagePath));
          } else if (imagePath.startsWith('/media/')) {
            const rel = imagePath.replace(/^\/media\/?/, '');
            absolutePath = path.join(__dirname, '../../data/media', rel);
          } else {
            const p1 = path.join(__dirname, '../../learn/images', path.basename(imagePath));
            const p2 = path.join(__dirname, '../../data/media', path.basename(imagePath));
            const p3 = path.join(__dirname, '../../data/media/color_stock', path.basename(imagePath));
            const p4 = path.join(__dirname, '../../data/media/others', path.basename(imagePath));
            if (fs.existsSync(p1)) absolutePath = p1;
            else if (fs.existsSync(p2)) absolutePath = p2;
            else if (fs.existsSync(p3)) absolutePath = p3;
            else if (fs.existsSync(p4)) absolutePath = p4;
          }

          if (absolutePath && fs.existsSync(absolutePath)) {
            try {
              const media = MessageMedia.fromFilePath(absolutePath);
              let caption = '';
              if (imagePath.includes('/color_stock/')) {
                const productName = path.basename(imagePath).replace(/\s+Color\s+Stock\.[a-zA-Z0-9]+$/i, '').trim();
                caption = `Pilihan stok warna harian untuk ${productName} kak... 😊`;
              }
              await whatsappClient.sendMessage(phoneNumber, media, caption ? { caption } : undefined);
              logger.info(`[QueueWorker] Sent image "${imagePath}" to ${phoneNumber}`);
            } catch (mediaErr) {
              logger.error(`[QueueWorker] Failed to send image ${imagePath}:`, mediaErr);
            }
          }
        }
      })().catch(err => logger.error('[QueueWorker] Error in async static image sending:', err));
    }

    // B2. Send dynamic PDFs
    if (isComp) {
      asyncGenerateAndSendPdf(whatsappClient, phoneNumber, 'comparison', { messageText, comparisonText: response.response })
        .catch(err => logger.error('[QueueWorker] Error in dynamic PDF comparison generation:', err));
    }
    if (isInvoice) {
      asyncGenerateAndSendPdf(whatsappClient, phoneNumber, 'invoice')
        .catch(err => logger.error('[QueueWorker] Error in dynamic PDF invoice generation:', err));
    }
    if (resellerLevel) {
      asyncGenerateAndSendPdf(whatsappClient, phoneNumber, 'welcome_guide', { resellerLevel })
        .catch(err => logger.error('[QueueWorker] Error in dynamic PDF welcome guide generation:', err));
    }

    // C. Send documents
    for (const docPath of docMatches) {
      let absoluteDocPath = null;
      if (docPath.startsWith('/pdf/')) {
        absoluteDocPath = path.join(__dirname, '../../data/pdf', path.basename(docPath));
      } else if (docPath.startsWith('/media/')) {
        const rel = docPath.replace(/^\/media\/?/, '');
        absoluteDocPath = path.join(__dirname, '../../data/media', rel);
      } else {
        const p1 = path.join(__dirname, '../../data/pdf', path.basename(docPath));
        const p2 = path.join(__dirname, '../../data/media', path.basename(docPath));
        const p3 = path.join(__dirname, '../../data/media/others', path.basename(docPath));
        if (fs.existsSync(p1)) absoluteDocPath = p1;
        else if (fs.existsSync(p2)) absoluteDocPath = p2;
        else if (fs.existsSync(p3)) absoluteDocPath = p3;
      }

      if (absoluteDocPath && fs.existsSync(absoluteDocPath)) {
        try {
          const media = MessageMedia.fromFilePath(absoluteDocPath);
          await whatsappClient.sendMessage(phoneNumber, media);
          logger.info(`[QueueWorker] Sent document "${docPath}" to ${phoneNumber}`);
        } catch (docErr) {
          logger.error(`[QueueWorker] Failed to send document ${absoluteDocPath}:`, docErr);
        }
      }
    }

  } finally {
    if (pendingOutgoingMessages) {
      setTimeout(() => pendingOutgoingMessages.delete(key), 8000);
    }
  }

  // 5. Save bot response to CRM database conversations
  const dbMessageType = isImage ? 'image' : 'text';
  const dbMessage = replyText || '[Dokumen/Gambar Terkirim]';

  await db('conversations').insert({
    phone_number: phoneNumber,
    message: dbMessage,
    sender: 'bot',
    message_type: dbMessageType,
    status: 'sent',
    timestamp: new Date()
  });

  // 6. Stream bot response to dashboard
  const { emitEvent } = require('../utils/socket');
  emitEvent('incoming_message', {
    phone_number: phoneNumber,
    message: dbMessage,
    sender: 'bot',
    message_type: dbMessageType,
    status: 'sent',
    timestamp: new Date()
  });
};

// Start a recurring polling timer as a fallback
setInterval(() => {
  if (whatsappClient) {
    triggerQueueWorker();
  }
}, 5000);

module.exports = {
  initQueueWorker,
  triggerQueueWorker
};
