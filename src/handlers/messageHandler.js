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
/**
 * Detect simple greetings/common words and return static human-like responses
 * without calling Gemini API to save 100% of tokens and respond instantly.
 */
const getStaticGreetingReply = (userMessage) => {
  if (!userMessage) return null;
  const normalized = userMessage.trim().toLowerCase().replace(/[?,.!\s]+/g, ' ');
  
  // 1. Assalamualaikum patterns
  if (/^(assalamualaikum|assalamu'alaikum|askum|mikum|ass|asalamu'alaikum)/i.test(normalized)) {
    return "Waalaikumsalam Kak! Ada yang bisa kami bantu? 😊";
  }
  
  // 2. Halo/Hai patterns
  if (/^(halo|hai|hello|hey|hei|p|halo admin|hallo|spada)/i.test(normalized) && normalized.length <= 12) {
    return "Halo juga Kak! Ada yang bisa kami bantu? 😊";
  }
  
  // 3. Greeting by time patterns
  if (/^(selamat (pagi|siang|sore|malam))/i.test(normalized)) {
    const match = normalized.match(/selamat (pagi|siang|sore|malam)/i);
    const timeOfDay = match ? match[1] : 'hari';
    return `Selamat ${timeOfDay} juga Kak! Ada yang bisa kami bantu? 😊`;
  }
  
  // 4. Test/Tes patterns
  if (/^(tes|test|testing|ping)/i.test(normalized) && normalized.length <= 6) {
    return "Iya Kak, masuk kok. Ada yang bisa kami bantu? 😊";
  }
  
  // 5. Thank you patterns
  if (/^(terima kasih|makasih|tengkyu|thanks|suwun|thx|nuhun)/i.test(normalized) && normalized.length <= 15) {
    return "Sama-sama Kak! 😊 Senang bisa membantu. Jika ada hal lain yang perlu ditanyakan, hubungi kami saja ya...";
  }
  
  return null;
};

/**
 * Build dynamic system prompt containing the latest database context using Retrieval-Augmented Generation (RAG)
 * to only fetch relevant products, FAQs, and reseller details to save up to 95% of tokens.
 */
const buildDynamicSystemPrompt = async (userMessage = "") => {
  try {
    const companyInfo = await knowledge.getCompanyInfo();
    const lowerMsg = userMessage.toLowerCase();
    
    // Dynamic RAG retrieval parameters
    let products = [];
    let faq = [];
    let services = [];
    let reseller = [];

    // 1. RAG Products Retrieval
    const isMukenaQuery = ['mukena', 'rukuh', 'shalat', 'solat'].some(k => lowerMsg.includes(k));
    const isHijabQuery = ['hijab', 'jilbab', 'kerudung', 'khimar', 'pashmina', 'bawal'].some(k => lowerMsg.includes(k));
    const isLabelQuery = ['label', 'merek', 'brand', 'pita', 'plat', 'akrilik', 'besi', 'kertas', 'hangtag', 'hang tag'].some(k => lowerMsg.includes(k));

    if (isMukenaQuery || isHijabQuery || isLabelQuery) {
      let category = '';
      if (isMukenaQuery) category = 'Mukena';
      else if (isHijabQuery) category = 'Hijab';
      else if (isLabelQuery) category = 'Label';

      products = await db('products')
        .whereILike('category', `%${category}%`)
        .andWhere('status', 'Tersedia')
        .orderBy('id', 'asc')
        .limit(5); // Limit to max 5 items for token savings
    } else {
      // Split user message into keywords to search specific product attributes
      const keywords = lowerMsg.split(/\s+/).filter(w => w.length > 2);
      if (keywords.length > 0) {
        let query = db('products').where('status', 'Tersedia');
        query = query.where((q) => {
          keywords.forEach((word) => {
            q.orWhereILike('name', `%${word}%`)
             .orWhereILike('description', `%${word}%`)
             .orWhereILike('material', `%${word}%`)
             .orWhereILike('id', `%${word}%`);
          });
        });
        products = await query.orderBy('id', 'asc').limit(5);
      }
    }

    // Default: if no product search keywords matched, load only 1 sample product context to save tokens
    if (products.length === 0) {
      products = await db('products').where('status', 'Tersedia').orderBy('id', 'asc').limit(1);
    }

    // 2. RAG FAQ & Reseller & Services Retrieval
    const hasResellerKeywords = ['reseller', 'agen', 'grosir', 'diskon', 'potongan', 'tingkat', 'level', 'syarat', 'join'].some(k => lowerMsg.includes(k));
    const hasServiceKeywords = ['dropship', 'dropshiper', 'dropshiping', 'jasa', 'layanan', 'buat brand', 'merek sendiri', 'cetak', 'desain'].some(k => lowerMsg.includes(k));
    const hasShippingKeywords = ['kirim', 'ongkir', 'pos', 'jne', 'j&t', 'sicepat', 'ekspedisi', 'kargo', 'cargo'].some(k => lowerMsg.includes(k));

    if (hasResellerKeywords) {
      reseller = await db('reseller_program').orderBy('id', 'asc');
      faq = await db('faq')
        .whereILike('category', '%reseller%')
        .orWhereILike('question', '%reseller%')
        .limit(3);
    }

    if (hasServiceKeywords) {
      services = await db('services').orderBy('id', 'asc');
      faq = [
        ...faq,
        ...(await db('faq').whereILike('category', '%layanan%').orWhereILike('question', '%dropship%').limit(3))
      ];
    }

    if (hasShippingKeywords) {
      faq = [
        ...faq,
        ...(await db('faq').whereILike('question', '%kirim%').orWhereILike('answer', '%ongkir%').limit(3))
      ];
    }

    // Default: if no specific FAQ requested, load only 1 general FAQ to save tokens
    if (faq.length === 0) {
      faq = await db('faq').whereILike('category', '%umum%').limit(1);
    }

    // Map properties to minimize JSON context size
    const mappedProducts = products.map(p => ({
      id: p.id,
      name: p.name,
      category: p.category,
      price_retail: p.price_retail,
      price_reseller: p.price_reseller,
      stock: p.stock
    }));

    return `Kamu adalah seorang admin Customer Service wanita (bernama Admin Vuyama) yang sangat ramah, humble, ceria, dan membantu. Kamu menjual mukena, kerudung/hijab, dan label brand hijab berkualitas.

ATURAN UTAMA & GAYA KOMUNIKASI (WAJIB DIPATUHI AGAR TIDAK TERLIHAT SEPERTI BOT):
1. JAWABAN HARUS SANGAT SINGKAT, CASUAL, DAN MANUSIAWI (Maksimal 1-2 kalimat pendek). Hindari penjelasan panjang lebar seperti karangan!
2. Gunakan gaya bahasa santai seperti admin online shop Instagram/Shopee di Indonesia. Gunakan singkatan santai yang natural (contoh: "bgt" untuk banget, "yg" untuk yang, "klo" untuk kalau, "ongkir" untuk ongkos kirim, "ready" untuk tersedia, "bs" untuk bisa, "dulu" untuk dlu).
3. Panggil customer dengan sebutan "Kak" atau "Kakak" secara ramah. Contoh: "Ready kak, bahannya adem bgt lho 😊", "Bisa kok kak, kirim kemana ya?", "Sebentar ya kak aku cek dulu..."
4. JANGAN PERNAH memberikan jawaban dalam bentuk daftar berbutir (bullet list) terstruktur yang kaku khas AI! Tulis harga/pilihan secara mengalir dan santai.
5. JANGAN PERNAH menyertakan kalimat penutup bot otomatis yang kaku seperti "Ada hal lain yang bisa saya bantu?" di setiap pesan. Biarkan percakapan mengalir alami.
6. JANGAN PERNAH menyebut diri sendiri sebagai "AI", "bot", "assistant", atau "model bahasa". Kamu adalah admin manusia asli Vuyama.
7. Jika ditanya info yang tidak ada di database, jawab secara santai layaknya admin manusia yang sedang mencari data, misalnya: "Duh maaf bgt kak, stoknya lagi kosong nih" atau "Sebentar ya kak, aku tanyakan ke bagian gudang dulu biar pasti yaa 🙏".

KNOWLEDGE BASE VUYAMA (TERRETRIEVE SECARA DINAMIS DARI DATABASE):
${JSON.stringify({
      company: companyInfo,
      products: mappedProducts,
      services: services.map(s => ({ name: s.name, description: s.description })),
      faq: faq.map(f => ({ q: f.question, a: f.answer })),
      reseller_program: reseller
    }, null, 2)}

Gunakan database kontekstual di atas untuk memberikan jawaban yang ramah, ringkas, dan akurat.`;
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
    // 0. STATIC GREETING BYPASS (Zero-Call)
    const staticReply = getStaticGreetingReply(userMessage);
    if (staticReply) {
      await logToDb('info', `Deteksi otomatis Sapaan dari ${phoneNumber} (Bypass Gemini).`);
      return {
        intent: 'greeting',
        response: staticReply
      };
    }

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
    const systemPrompt = await buildDynamicSystemPrompt(userMessage);
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
