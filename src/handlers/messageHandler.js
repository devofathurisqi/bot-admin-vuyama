const knowledge = require('../services/knowledge');
const history = require('../services/history');
const gemini = require('../services/gemini');
const db = require('../utils/db');
const { emitEvent } = require('../utils/socket');
const logger = require('../utils/logger');

// Database logging helper
const logToDb = async (level, message) => {
  try {
    const timestamp = new Date();
    await db('bot_logs').insert({ level, message, timestamp });
    emitEvent('new_log', { level, message, timestamp });
  } catch (err) {
    logger.error('Error writing bot log to DB:', err);
  }
};

/**
 * Build dynamic system prompt containing the latest database context
 */
const buildDynamicSystemPrompt = async () => {
  try {
    const companyInfo = await knowledge.getCompanyInfo();
    const products = await knowledge.getAllProducts();
    const services = await knowledge.getServices();
    const faq = await knowledge.getFAQByCategory('');
    const reseller = await knowledge.getResellerProgram();

    return `Kamu adalah admin customer service resmi Vuyama, perusahaan produsen/penjual mukena, kerudung, dan label brand hijab berkualitas.

ATURAN UTAMA & GAYA BAHASA (WAJIB DIPATUHI):
1. JAWABAN HARUS SUPER SINGKAT, PADAT, DAN LANGSUNG KE INTI (Maksimal 1-2 kalimat pendek). Jangan pernah menulis paragraf panjang bertele-tele!
2. Bicara sangat ramah, santai, dan manusiawi (Gunakan kata seperti "Kak", "Ready kak", "Bisa kok", "Ada kak").
3. Gunakan emoji secukupnya agar bersahabat (😊, 👍, kak 🙏, dll).
4. Jangan pernah menyebut diri Anda "AI", "bot", atau "model bahasa". Anda adalah "Admin Vuyama" (manusia).
5. Hindari membuat format daftar (list) panjang kecuali ditanyakan langsung.
6. Jika ditanya harga/detail produk, sebutkan nama produk, harga retail/reseller secara ringkas dan bersahabat.

KNOWLEDGE BASE VUYAMA (TERBARU DARI DATABASE):
${JSON.stringify({
      company: companyInfo,
      products: products.map(p => ({ id: p.id, name: p.name, category: p.category, price_retail: p.price_retail, price_reseller: p.price_reseller, stock: p.stock, status: p.status })),
      services: services,
      faq: faq.map(f => ({ q: f.question, a: f.answer })),
      reseller_program: reseller
    }, null, 2)}

Gunakan database di atas untuk memberikan jawaban yang ramah, ringkas, dan akurat.`;
  } catch (err) {
    logger.error('Error building dynamic prompt:', err);
    return `Kamu adalah admin customer service resmi Vuyama. Bicara ramah, santai, dan singkat (1-2 kalimat).`;
  }
};

/**
 * Check if the message indicates a customer complaint
 */
const isComplaintMessage = (msgText) => {
  const COMPLAINT_KEYWORDS = [
    'kecewa', 'marah', 'refund', 'penipuan', 'barang belum datang', 
    'respon lama', 'komplain', 'jelek', 'rugi', 'lambat', 
    'kembalikan uang', 'salah kirim', 'cacat', 'rusak', 'pecah'
  ];
  const normalized = msgText.toLowerCase();
  return COMPLAINT_KEYWORDS.some(k => normalized.includes(k));
};

/**
 * Check if the message indicates the customer wants to order
 */
const isOrderIntentMessage = (msgText) => {
  const ORDER_INTENT_KEYWORDS = [
    'mau beli', 'cara order', 'order kak', 'mau pesan', 
    'cara pesan', 'order dong', 'pesan mukena', 'beli kerudung', 
    'format order', 'mau beli label'
  ];
  const normalized = msgText.toLowerCase();
  return ORDER_INTENT_KEYWORDS.some(k => normalized.includes(k));
};

/**
 * Check if the message contains the required fields for the order format
 */
const isFilledOrderFormat = (msgText) => {
  const normalized = msgText.toLowerCase();
  return ['nama :', 'alamat lengkap :', 'no hp :', 'pesanan :'].every(field => normalized.includes(field));
};

/**
 * Gemini-powered unstructured order format text extractor with fallback Regex parser
 */
const parseOrderFormatWithGemini = async (text) => {
  const prompt = `Extract Vuyama order details from this WhatsApp message and return it strictly as a single JSON object.
Do NOT output markdown code fences (like \`\`\`json) or any other explanation. Just the raw JSON string.

Schema keys:
- customer_name: (from Nama)
- address: (from Alamat Lengkap)
- phone: (from No HP)
- pesanan_raw: (from Pesanan)
- brand_name: (from Nama Brand)
- label_size: (from Ukuran Label)
- label_shape: (from Bentuk)
- ink_color: (from Warna Tinta)
- label_color: (from Warna Label)
- font: (from Font)

If a field is empty, missing, or omitted in the text, set its value to null.

WhatsApp Message Text:
"""
${text}
"""`;

  try {
    const rawRes = await gemini.callGemini(prompt);
    let cleaned = rawRes.trim();
    if (cleaned.startsWith('```json')) cleaned = cleaned.replace(/^```json/, '');
    if (cleaned.startsWith('```')) cleaned = cleaned.replace(/^```/, '');
    if (cleaned.endsWith('```')) cleaned = cleaned.replace(/```$/, '');
    cleaned = cleaned.trim();
    
    return JSON.parse(cleaned);
  } catch (err) {
    logger.error('Gemini order parsing failed, using regex fallback:', err);
    
    const getMatch = (regex) => {
      const match = text.match(regex);
      return match ? match[1].trim() : null;
    };

    return {
      customer_name: getMatch(/Nama\s*:\s*(.*)/i),
      address: getMatch(/Alamat Lengkap\s*:\s*(.*)/i),
      phone: getMatch(/No HP\s*:\s*(.*)/i),
      pesanan_raw: getMatch(/Pesanan\s*:\s*(.*)/i),
      brand_name: getMatch(/Nama Brand\s*:\s*(.*)/i),
      label_size: getMatch(/Ukuran Label\s*:\s*(.*)/i),
      label_shape: getMatch(/Bentuk\s*:\s*(.*)/i),
      ink_color: getMatch(/Warna Tinta\s*:\s*(.*)/i),
      label_color: getMatch(/Warna Label\s*:\s*(.*)/i),
      font: getMatch(/Font\s*:\s*(.*)/i)
    };
  }
};

/**
 * Context string builder from customer message history
 */
const buildContextString = async (phoneNumber) => {
  const chatHistory = await history.getHistory(phoneNumber, 8); // limit 8 messages
  if (chatHistory.length === 0) return '';

  let contextStr = '\nRiwayat chat terakhir:\n';
  chatHistory.forEach(msg => {
    const sender = msg.sender === 'customer' ? 'Customer' : 'Admin';
    contextStr += `${sender}: ${msg.message}\n`;
  });
  return contextStr;
};

/**
 * Main function to generate bot response
 */
const generateResponse = async (phoneNumber, userMessage, customerState) => {
  try {
    // 1. COMPLAINT DETECTION FLOW
    if (isComplaintMessage(userMessage)) {
      await logToDb('warn', `Deteksi otomatis Komplain dari ${phoneNumber}: "${userMessage.substring(0, 40)}..."`);
      
      // Auto-block the bot from replying to this customer in the future
      const existingBlock = await db('blocked_numbers').where('phone_number', phoneNumber).first();
      if (!existingBlock) {
        await db('blocked_numbers').insert({
          phone_number: phoneNumber,
          reason: 'Terdeteksi Komplain Otomatis'
        });
      }

      // Update customer status to COMPLAINT and WAITING_HUMAN
      await db('customers').where('phone_number', phoneNumber).update({
        status: 'WAITING_HUMAN',
        updated_at: new Date()
      });

      // Insert record to complaints
      await db('complaints').insert({
        phone_number: phoneNumber,
        message: userMessage,
        status: 'OPEN'
      });

      // Alert dashboard clients
      emitEvent('new_complaint', {
        phone_number: phoneNumber,
        message: userMessage
      });
      
      // Notify customer update to UI
      const updatedCustomer = await db('customers').where('phone_number', phoneNumber).first();
      emitEvent('customer_updated', updatedCustomer);

      return {
        intent: 'complaint',
        response: `Maaf banget atas ketidaknyamanannya ya Kak 🙏 Keluhan Kakak sudah dicatat oleh tim kami. Sebentar ya kak, kami bantu cek detail keluhan Kakak dan segera kami kabari. Mohon ditunggu sebentar ya Kak... 😊`
      };
    }

    // 2. ORDER CONFIRMATION FLOW
    
    // Scenario A: Customer wants to order (gives order format)
    if (isOrderIntentMessage(userMessage)) {
      await logToDb('info', `Deteksi keinginan order dari ${phoneNumber}. Mengirimkan format order...`);
      
      await db('customers').where('phone_number', phoneNumber).update({
        status: 'ORDER_PENDING',
        updated_at: new Date()
      });

      // Notify UI
      const updatedCustomer = await db('customers').where('phone_number', phoneNumber).first();
      emitEvent('customer_updated', updatedCustomer);

      return {
        intent: 'order_intent',
        response: `Silahkan diisi format order VUYAMA\n\nNama :\nAlamat Lengkap :\nNo HP :\nPesanan :\n\napabila ingin membuat label atau sudah ada label, silahkan diisi :\n\nNama Brand :\nUkuran Label :\nBentuk :\nWarna Tinta :\nWarna Label :\nFont :`
      };
    }

    // Scenario B: Customer fills the format (they must have status ORDER_PENDING or have the fields)
    if (isFilledOrderFormat(userMessage)) {
      await logToDb('info', `Customer ${phoneNumber} mengirimkan format order. Menjalankan AI parser...`);
      
      const parsed = await parseOrderFormatWithGemini(userMessage);

      // Save order to PostgreSQL
      const [orderIdObj] = await db('orders').insert({
        phone_number: phoneNumber,
        customer_name: parsed.customer_name || 'Customer Vuyama',
        address: parsed.address,
        phone: parsed.phone,
        pesanan_raw: parsed.pesanan_raw,
        brand_name: parsed.brand_name,
        label_size: parsed.label_size,
        label_shape: parsed.label_shape,
        ink_color: parsed.ink_color,
        label_color: parsed.label_color,
        font: parsed.font,
        status: 'PENDING',
        total: 0
      }).returning('id');

      const orderId = orderIdObj ? orderIdObj.id : null;

      // Update customer status to ORDER_CONFIRMED
      await db('customers').where('phone_number', phoneNumber).update({
        status: 'ORDER_CONFIRMED',
        updated_at: new Date()
      });

      // Notify dashboard real-time
      emitEvent('new_order', {
        id: orderId,
        phone_number: phoneNumber,
        customer_name: parsed.customer_name || 'Customer Vuyama',
        pesanan_raw: parsed.pesanan_raw,
        status: 'PENDING'
      });

      const updatedCustomer = await db('customers').where('phone_number', phoneNumber).first();
      emitEvent('customer_updated', updatedCustomer);

      return {
        intent: 'order_filled',
        response: `Terima kasih Kak! 😊 Format ordernya sudah kami terima dan berhasil dicatat dengan status PENDING. Admin kami akan segera mengecek pesanan Kakak untuk menghitung ongkirnya. Mohon tunggu sebentar ya... 🙏`
      };
    }

    // 3. NORMAL AI CHAT FLOW (USING DYNAMIC KNOWLEDGE AND DYNAMIC SYSTEM PROMPT)
    const contextStr = await buildContextString(phoneNumber);
    const systemPrompt = await buildDynamicSystemPrompt();
    const prompt = `${systemPrompt}${contextStr}\n\nCustomer: ${userMessage}\n\nAdmin (jangan mulai dengan 'Admin:'):`;

    logger.info(`Calling Gemini AI for customer ${phoneNumber}`);
    const response = await gemini.callGemini(prompt);

    let cleanedResponse = response.trim();
    if (cleanedResponse.startsWith('Admin:')) {
      cleanedResponse = cleanedResponse.substring(6).trim();
    }

    return {
      intent: 'ai_reply',
      response: cleanedResponse || 'Boleh kak, ada yang bisa dibantu? 😊'
    };
  } catch (error) {
    logger.error('Error generating response:', error);
    return {
      intent: 'error',
      response: 'Boleh kak, sebentar ya kami cek dulu... 🙏'
    };
  }
};

module.exports = {
  generateResponse,
  buildDynamicSystemPrompt,
  isComplaintMessage,
  isOrderIntentMessage,
  isFilledOrderFormat
};
