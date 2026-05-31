const fs = require('fs');
const path = require('path');
const knowledge = require('../services/knowledge');
const history = require('../services/history');
const gemini = require('../services/gemini');
const db = require('../utils/db');
const { emitEvent } = require('../utils/socket');
const logger = require('../utils/logger');

// Auto-copy generated comparison infographics if present
(() => {
  const brainDir = 'C:\\Users\\devof\\.gemini\\antigravity-ide\\brain\\a5044708-c0b1-403e-86fa-100c158caa1d';
  const destDir = path.join(__dirname, '../../data/media/others');
  
  if (!fs.existsSync(destDir)) {
    fs.mkdirSync(destDir, { recursive: true });
  }

  const mappings = {
    'paris_comparison_1780228404954.png': 'paris_comparison.png',
    'label_comparison_1780228424359.png': 'label_comparison.png',
    'pashmina_comparison_1780228441760.png': 'pashmina_comparison.png'
  };

  for (const [srcName, destName] of Object.entries(mappings)) {
    const srcPath = path.join(brainDir, srcName);
    const destPath = path.join(destDir, destName);
    if (fs.existsSync(srcPath)) {
      try {
        fs.copyFileSync(srcPath, destPath);
        logger.info(`Successfully copied/verified comparison infographic: ${destName}`);
      } catch (err) {
        logger.error(`Failed to copy comparison infographic ${srcName}:`, err);
      }
    }
  }
})();


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
 * Detect comparison questions and return brief explanation with infographic image bypass
 */
const getComparisonReply = (userMessage) => {
  if (!userMessage) return null;
  const normalized = userMessage.trim().toLowerCase().replace(/[?,.!\s]+/g, ' ');

  // List of comparative/choice keywords
  const isComparisonQuery = /(beda|banding|vs|lawan|lebih|bagus|laku|mending|pilih|mana|kelebihan|kekurangan|perbedaan|selisih|populer|laris)/i.test(normalized);

  // 1. Paris Japan vs Paris Jadul
  const hasJapan = /japan/i.test(normalized);
  const hasJadul = /(jadul|legend|klasik|basic|ori)/i.test(normalized);
  const hasParis = /paris/i.test(normalized);

  if (
    (hasParis && isComparisonQuery) ||
    (hasJapan && hasJadul) ||
    (hasParis && (hasJapan || hasJadul) && isComparisonQuery)
  ) {
    // If specifically asking which is more popular / sells better
    if (/(laku|laris|populer|banyak|beli|jual)/i.test(normalized)) {
      return `Untuk Vuyama, **Paris Japan** jauh lebih banyak dipilih dan gampang laku kak! Karena bahannya premium, super lembut, tegak di dahi, dan feedback customernya sangat memuaskan... 😊\n\nSedangkan **Paris Jadul** biasanya dipilih untuk market massal karena harganya yang sangat murah & ekonomis.\n\nDetail tabel perbandingannya bisa langsung kakak cek pada gambar di bawah ini ya kak... 👇\n\n[SEND_IMAGE: /media/others/paris_comparison.png]`;
    }
    
    // Default comparison
    return `Ini perbandingan singkat antara Paris Japan dan Paris Jadul ya kak... 😊\n\n- **Paris Japan**: Bahan premium, serat rapat, super lembut, flowy, dan tegak di dahi (nggak kaku).\n- **Paris Jadul**: Bahan standar, serat renggang, tekstur agak kaku khas retro/vintage, sangat ekonomis.\n\nUntuk detail lengkapnya, silakan cek gambar tabel perbandingan di bawah ini kak... 👇\n\n[SEND_IMAGE: /media/others/paris_comparison.png]`;
  }

  // 2. Label Material (Akrilik vs Plat Besi vs Woven vs Satin)
  const hasAklik = /(akrilik|acrylic)/i.test(normalized);
  const hasPlat = /(plat|besi|logam)/i.test(normalized);
  const hasWoven = /woven/i.test(normalized);
  const hasSatin = /satin/i.test(normalized);
  const hasLabel = /label/i.test(normalized);

  // Check if at least two label types are mentioned, or one label type and comparative query
  const labelMatchCount = [hasAklik, hasPlat, hasWoven, hasSatin].filter(Boolean).length;

  if (
    (hasLabel && isComparisonQuery) ||
    (labelMatchCount >= 2) ||
    ((hasAklik || hasPlat || hasWoven || hasSatin) && hasLabel && isComparisonQuery)
  ) {
    if (/(laku|laris|populer|best|seller|bagusan|mending|pilih)/i.test(normalized)) {
      return `Bahan label paling laris (*best seller*) kami adalah **Akrilik** (kesan mewah mengkilap) dan **Woven** (rajutan benang super awet) kak... 😊\n\nSetiap bahan memiliki keunikan masing-masing untuk menaikkan kelas brand hijab kakak.\n\nBiar gampang milihnya, yuk cek tabel perbandingan lengkap 4 bahan label best seller kami di bawah ini kak... 👇\n\n[SEND_IMAGE: /media/others/label_comparison.png]`;
    }

    return `Berikut ringkasan singkat 4 bahan label brand best seller kami kak... 😊\n\n- **Akrilik**: Kesan modern & super mewah (efek kaca mengkilap).\n- **Plat Besi/Logam**: Sangat premium, kokoh, memberi kesan eksklusif & mahal.\n- **Woven**: Rajutan benang detail tinggi, awet, & bernuansa klasik.\n- **Satin**: Lembut di kulit, lentur, dan sangat ekonomis.\n\nDetail visual perbandingannya bisa langsung kakak cek di gambar berikut ya kak... 👇\n\n[SEND_IMAGE: /media/others/label_comparison.png]`;
  }

  // 3. Pashmina Bamboo vs Pashmina Airtech
  const hasBamboo = /bamboo/i.test(normalized);
  const hasAirtech = /airtech/i.test(normalized);
  const hasPashmina = /pashmina/i.test(normalized);

  if (
    (hasPashmina && isComparisonQuery) ||
    (hasBamboo && hasAirtech) ||
    (hasPashmina && (hasBamboo || hasAirtech) && isComparisonQuery)
  ) {
    if (/(laku|laris|populer|bagusan|mending|pilih)/i.test(normalized)) {
      return `Kedua pashmina ini sangat laris dengan keunggulannya masing-masing kak... 😊\n\n- Pilih **Bamboo Spandex** jika mencari kenyamanan ekstra (sangat adem & ada *cooling effect* serat bambu alami).\n- Pilih **Airtech Ultrasoft** jika mencari pashmina yang sangat ringan, mudah menyerap keringat (*quick-dry*), dan pas untuk luar ruangan.\n\nSilakan cek tabel perbandingan visual lengkapnya di bawah ini kak... 👇\n\n[SEND_IMAGE: /media/others/pashmina_comparison.png]`;
    }

    return `Perbedaan singkat Pashmina Bamboo vs Pashmina Airtech kak... 😊\n\n- **Pashmina Bamboo**: Serat bambu alami, super lembut, adem dingin (*cooling effect*), & jatuh banget.\n- **Pashmina Airtech**: Sangat ringan, ada sirkulasi udara mikro (*micro-ventilation*), menyerap keringat, & *quick-dry*.\n\nBiar lebih jelas bedanya, yuk cek gambar tabel perbandingannya di bawah ini kak... 👇\n\n[SEND_IMAGE: /media/others/pashmina_comparison.png]`;
  }

  return null;
};

/**
 * Clean and match user message against Database FAQs using Jaccard string similarity
 * acting as a local micro-machine learning matcher.
 */
const findMatchingLocalFAQ = (userMessage, faqs) => {
  if (!userMessage || !faqs || faqs.length === 0) return null;

  const normalize = (str) => {
    return str
      .toLowerCase()
      .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  };

  const getWords = (str) => {
    const stopwords = new Set(['di', 'ke', 'dari', 'yang', 'dan', 'atau', 'ini', 'itu', 'ada', 'adalah', 'untuk', 'dengan', 'saya', 'kami', 'kita', 'kamu', 'anda', 'dia', 'mereka', 'sih', 'ya', 'ka', 'kak', 'min', 'dong', 'kok']);
    return new Set(
      normalize(str)
        .split(' ')
        .filter(word => word.length > 1 && !stopwords.has(word))
    );
  };

  const calculateJaccard = (setA, setB) => {
    const intersection = new Set([...setA].filter(x => setB.has(x)));
    const union = new Set([...setA, ...setB]);
    if (union.size === 0) return 0;
    return intersection.size / union.size;
  };

  const userWords = getWords(userMessage);
  const normalizedUser = normalize(userMessage);

  let bestMatch = null;
  let highestScore = 0;

  for (const faq of faqs) {
    const faqWords = getWords(faq.question);
    let score = calculateJaccard(userWords, faqWords);

    // Substring phrase matching bonus
    const faqNormQuestion = normalize(faq.question);
    if (normalizedUser.includes(faqNormQuestion) || faqNormQuestion.includes(normalizedUser)) {
      score += 0.35;
    }

    // Direct key phrase words match boost
    const keyPhrases = faq.question.toLowerCase().split(/\s+/).filter(w => w.length > 3);
    const matchedCount = keyPhrases.filter(kp => normalizedUser.includes(kp)).length;
    if (matchedCount > 0) {
      score += (matchedCount / keyPhrases.length) * 0.25;
    }

    if (score > highestScore) {
      highestScore = score;
      bestMatch = faq;
    }
  }

  // A highly optimized similarity threshold (0.45) for reliable matches
  if (highestScore >= 0.45 && bestMatch) {
    return {
      answer: bestMatch.answer,
      score: highestScore,
      question: bestMatch.question
    };
  }

  return null;
};

/**
 * Smart Machine Learning - Style Intent Classifier and Database Table Selector (RAG Router)
 * Dynamically analyzes the user message to select the precise tables and records to retrieve.
 */
const classifyIntentAndRetrieveContext = async (userMessage) => {
  const STOPWORDS = new Set(['di', 'ke', 'dari', 'yang', 'dan', 'atau', 'ini', 'itu', 'ada', 'adalah', 'untuk', 'dengan', 'saya', 'kami', 'kita', 'kamu', 'anda', 'dia', 'mereka', 'sih', 'ya', 'ka', 'kak', 'min', 'dong', 'kok', 'mau', 'nanya', 'untuk', 'ada', 'saja', 'ya', 'halo', 'tanya', 'dong', 'sih', 'kok', 'apa', 'ada', 'aja']);

  const cleanMessage = userMessage.toLowerCase().replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?]/g, " ").trim();
  const tokens = cleanMessage.split(/\s+/).filter(w => w.length > 1 && !STOPWORDS.has(w));

  // Comprehensive Table routing similarity score keyword models
  const routingKeywords = {
    products: [
      // Mukena & Hijab terms
      'mukena', 'mukenah', 'rukuh', 'telekung', 'hijab', 'kerudung', 'jilbab', 'khimar', 'pashmina', 'pasmina', 'bawal', 'segiempat', 'segi empat', 'instant', 'instan', 'bergo', 'ciput', 'manset',
      // Label terms
      'label', 'merek', 'brand', 'pita', 'plat', 'akrilik', 'acrylic', 'besi', 'kertas', 'hangtag', 'hang tag', 'woven', 'satin', 'kulit', 'leter', 'embos', 'emboss',
      // Specs & shopping terms
      'ready', 'stok', 'stock', 'harga', 'price', 'retail', 'ecer', 'eceran', 'bahan', 'material', 'ukuran', 'size', 'warna', 'dimensi', 'berat', 'gram', 'kg',
      // General product/catalog terms
      'produk', 'product', 'barang', 'jualan', 'koleksi', 'katalog', 'catalog', 'pricelist', 'daftar harga', 'price list', 'list', 'daftar', 'pilihan', 'lihat', 'sell', 'jual', 'beli', 'pesan', 'order', 'foto', 'gambar', 'penampakan', 'model', 'jenis', 'macam', 'tipe'
    ],
    services: [
      // Services, custom brand, dropship
      'jasa', 'layanan', 'service', 'custom', 'cetak', 'desain', 'design', 'buat brand', 'bikin brand', 'merek sendiri', 'dropship', 'dropshiper', 'dropshipper', 'dropshiping', 'dropshipping', 'kirim resi', 'resi otomatis', 'cod', 'bayar di tempat', 'kirim atas nama', 'maklon'
    ],
    reseller: [
      // Reseller & Partner program terms
      'reseller', 'reseler', 'resseler', 'mitra', 'agen', 'grosir', 'partai', 'borongan', 'diskon', 'potongan', 'tingkat', 'level', 'syarat', 'join', 'gabung', 'daftar', 'kemitraan', 'minimal beli', 'beli berapa', 'murah', 'lebih murah'
    ],
    shipping: [
      // Shipping & Logistics terms
      'kirim', 'pengiriman', 'dikirim', 'ongkir', 'ongkos kirim', 'tarif', 'biaya kirim', 'kurir', 'ekspedisi', 'kargo', 'cargo', 'pos', 'jne', 'j&t', 'jnt', 'sicepat', 'wahana', 'tiki', 'lion', 'sentral', 'anteraja'
    ],
    company: [
      // Company info & location terms
      'vuyama', 'vuyema', 'toko', 'workshop', 'pabrik', 'lokasi', 'alamat', 'maps', 'gmaps', 'google maps', 'posisi', 'dimana', 'di mana', 'daerah', 'kota', 'jam buka', 'buka jam', 'jadwal', 'hari apa', 'owner', 'pendiri', 'kontak', 'hubungi', 'nomor', 'telepon', 'wa', 'whatsapp', 'cs', 'admin', 'profile', 'profil', 'tentang'
    ]
  };

  const scores = {
    products: 0,
    services: 0,
    reseller: 0,
    shipping: 0,
    company: 0
  };

  // Compute keyword matching scores
  tokens.forEach(token => {
    Object.keys(routingKeywords).forEach(table => {
      if (routingKeywords[table].some(keyword => keyword.includes(token) || token.includes(keyword))) {
        scores[table] += 1.5; // High weight overlap
      }
    });
  });

  const totalScore = Object.values(scores).reduce((a, b) => a + b, 0);

  // Intent triggers
  const triggers = {
    products: scores.products > 0 || tokens.length === 0 || totalScore === 0, // Default true if empty or no keywords matched
    services: scores.services > 0,
    reseller: scores.reseller > 0,
    shipping: scores.shipping > 0,
    company: scores.company > 0 || tokens.length === 0 || totalScore === 0
  };

  let products = [];
  let faq = [];
  let services = [];
  let reseller = [];
  let companyInfo = [];

  // Query 1: Products table selector
  if (triggers.products) {
    const isBroadQuery = tokens.some(t => ['semua', 'all', 'daftar', 'list', 'apa aja', 'apa saja', 'koleksi', 'katalog', 'catalog', 'lengkap', 'pricelist', 'produk', 'product', 'barang', 'toko', 'jual', 'jualan'].includes(t)) || tokens.length === 0 || totalScore === 0;

    if (isBroadQuery) {
      products = await db('products').where('status', 'Tersedia').orderBy('id', 'asc');
    } else if (tokens.length > 0) {
      // Find direct product category matches to pull complete category inventory
      const categoryMatch = ['mukena', 'hijab', 'label'].find(cat =>
        tokens.some(token => cat.includes(token) || token.includes(cat))
      );

      if (categoryMatch) {
        const categoryName = categoryMatch.charAt(0).toUpperCase() + categoryMatch.slice(1);
        const otherTokens = tokens.filter(t => t !== categoryMatch);

        // Step A: Search for products in this category that match the other tokens (e.g. "akrilik" inside "label")
        let query = db('products').whereILike('category', `%${categoryName}%`).andWhere('status', 'Tersedia');
        if (otherTokens.length > 0) {
          query = query.where((q) => {
            otherTokens.forEach((token) => {
              q.orWhereILike('name', `%${token}%`)
                .orWhereILike('sub_category', `%${token}%`)
                .orWhereILike('material', `%${token}%`)
                .orWhereILike('description', `%${token}%`);
            });
          });
        }
        products = await query.orderBy('id', 'asc').limit(8);

        // Step B: If we found fewer than 8 matching products, fill the rest with general category products
        if (products.length < 8) {
          const generalProducts = await db('products')
            .whereILike('category', `%${categoryName}%`)
            .andWhere('status', 'Tersedia')
            .whereNotIn('id', products.map(p => p.id))
            .orderBy('id', 'asc')
            .limit(8 - products.length);
          products = [...products, ...generalProducts];
        }
      } else {
        // Perform broad fuzzy keyword search across product fields
        let query = db('products').where('status', 'Tersedia');
        query = query.where((q) => {
          tokens.forEach((token) => {
            q.orWhereILike('name', `%${token}%`)
              .orWhereILike('category', `%${token}%`)
              .orWhereILike('sub_category', `%${token}%`)
              .orWhereILike('material', `%${token}%`)
              .orWhereILike('id', `%${token}%`);
          });
        });
        products = await query.orderBy('id', 'asc').limit(8);
      }
    }

    // Fallback if no matching active products found
    if (products.length === 0) {
      products = await db('products').where('status', 'Tersedia').orderBy('id', 'asc').limit(3);
    }
  }

  // Query 2: Services table selector
  if (triggers.services) {
    services = await db('services').orderBy('id', 'asc');
    const matchedFaqs = await db('faq')
      .whereILike('category', '%layanan%')
      .orWhereILike('question', '%dropship%')
      .limit(3);
    faq = [...faq, ...matchedFaqs];
  }

  // Query 3: Reseller table selector
  if (triggers.reseller) {
    reseller = await db('reseller_program').orderBy('id', 'asc');
    const matchedFaqs = await db('faq')
      .whereILike('category', '%reseller%')
      .orWhereILike('question', '%reseller%')
      .limit(3);
    faq = [...faq, ...matchedFaqs];
  }

  // Query 4: Shipping table selector
  if (triggers.shipping) {
    const matchedFaqs = await db('faq')
      .whereILike('question', '%kirim%')
      .orWhereILike('answer', '%ongkir%')
      .limit(3);
    faq = [...faq, ...matchedFaqs];
  }

  // Query 5: Company Info table selector
  companyInfo = await db('company_info').orderBy('id', 'asc');
  if (triggers.company) {
    const matchedFaqs = await db('faq')
      .whereILike('category', '%umum%')
      .limit(3);
    faq = [...faq, ...matchedFaqs];
  }

  // Default baseline FAQs
  if (faq.length === 0) {
    faq = await db('faq').limit(2);
  }

  // Clean data structures to optimize prompt token size
  const cleanProducts = products.map(p => ({
    id: p.id,
    name: p.name,
    category: p.category,
    sub_category: p.sub_category,
    description: p.description,
    price_retail: p.price_retail,
    price_reseller: p.price_reseller,
    material: p.material,
    stock: p.stock,
    images: p.image ? p.image.split(',').map(img => img.trim()).filter(Boolean) : [],
    variants: typeof p.variants === 'string' ? JSON.parse(p.variants) : (p.variants || []),
    wholesale_tiers: typeof p.wholesale_tiers === 'string' ? JSON.parse(p.wholesale_tiers) : (p.wholesale_tiers || [])
  }));

  const cleanServices = services.map(s => ({
    name: s.name,
    description: s.description,
    terms: s.terms
  }));

  const cleanFaqs = faq.map(f => ({
    q: f.question,
    a: f.answer
  }));

  const cleanCompanyInfo = companyInfo.reduce((acc, c) => {
    acc[c.key] = c.value;
    return acc;
  }, {});

  // Dynamically scan the data/pdf directory for uploaded documents
  let availableDocs = [];
  const pdfDir = path.join(__dirname, '../../data/pdf');
  if (fs.existsSync(pdfDir)) {
    try {
      const files = fs.readdirSync(pdfDir);
      availableDocs = files.filter(f => f.toLowerCase().endsWith('.pdf')).map(f => {
        let name = f.replace('.pdf', '');
        if (name.includes('PRICELIST')) {
          name = 'Daftar Harga Pricelist Reseller Update Mei 2026';
        }
        return {
          name: name,
          path: `/pdf/${f}`,
          filename: f
        };
      });
    } catch (e) {
      logger.error('Error scanning data/pdf directory:', e);
    }
  }

  // Dynamically scan the data/media/color_stock directory for available color stock images
  let colorStockFiles = [];
  const colorStockDir = path.join(__dirname, '../../data/media/color_stock');
  if (fs.existsSync(colorStockDir)) {
    try {
      const files = fs.readdirSync(colorStockDir);
      colorStockFiles = files.filter(f => f.toLowerCase().endsWith('.jpeg') || f.toLowerCase().endsWith('.jpg') || f.toLowerCase().endsWith('.png')).map(f => {
        let baseProductName = f.replace(/\s+Color\s+Stock\.[a-zA-Z0-9]+$/i, '').trim();
        return {
          filename: f,
          product_name: baseProductName,
          path: `/media/color_stock/${f}`
        };
      });
    } catch (e) {
      logger.error('Error scanning color_stock directory:', e);
    }
  }

  return {
    company: cleanCompanyInfo,
    products: cleanProducts,
    services: cleanServices,
    faq: cleanFaqs,
    reseller_program: reseller,
    documents: availableDocs, // Dynamically registered PDF catalogs
    color_stock_files: colorStockFiles, // Dynamically registered color stock files!
    selectedTables: Object.keys(triggers).filter(k => triggers[k])
  };
};


/**
 * Build dynamic system prompt containing the latest database context
 */
const buildDynamicSystemPrompt = async (userMessage = "") => {
  try {
    // Smart RAG selector retrieval
    const context = await classifyIntentAndRetrieveContext(userMessage);

    logger.info(`Smart RAG Classifier classified intent. Querying tables: [${context.selectedTables.join(', ')}]`);

    // Load the official PDF knowledge backup to guarantee absolute latest data
    let pdfPricelistOfficial = null;
    const backupPath = path.join(__dirname, '../../data/pdf_knowledge_backup.json');
    if (fs.existsSync(backupPath)) {
      try {
        pdfPricelistOfficial = JSON.parse(fs.readFileSync(backupPath, 'utf8'));
      } catch (e) {
        logger.error('Error reading PDF knowledge backup JSON:', e);
      }
    }

    return `Kamu adalah seorang admin Customer Service resmi Vuyama (bernama Vumin) yang sangat profesional, ramah, dan berpengalaman luas di bidang produksi mukena, hijab, dan label brand hijab. 

ATURAN MUTLAK & DISIPLIN DATA KETAT (PENTING - DILARANG KERAS BERIMPROVISASI ATAU MENGARANG):
1. **DILARANG KERAS MENGARANG PRODUK**: Kamu HANYA boleh merekomendasikan atau menyebutkan nama produk yang benar-benar tercantum di dalam daftar "products" atau "pdf_pricelist_official" di bagian KNOWLEDGE BASE di bawah. Jika customer bertanya tentang produk, jenis, bahan, atau nama barang yang tidak ada di data kita, kamu HARUS menjawab dengan sopan bahwa produk tersebut sedang kosong/belum tersedia, atau minta mereka menunggu admin manusia mengecek ke bagian gudang. JANGAN PERNAH menyebutkan nama barang khayalan!
2. **DILARANG KERAS MENGARANG HARGA DAN ATURAN GROSIR**: Semua harga retail (price_retail), harga reseller (price_reseller), varian harga per ukuran (sizes), dan diskon grosir berjenjang (wholesale_tiers) HARUS 100% akurat sesuai angka yang ada di database atau "pdf_pricelist_official". Jangan pernah memotong harga secara mandiri, mengarang diskon khayalan, atau mengasumsikan biaya kirim (ongkir) tanpa data resmi.
3. **DILARANG KERAS MENGARANG DETAIL SPESIFIKASI**: Deskripsi bahan, warna, berat, dan status ketersediaan barang wajib merujuk secara ketat pada data produk terkait. Jika tidak tertulis di data, jangan berasumsi atau menebak-nebak secara acak. Katakan dengan jujur atau minta mereka menunggu konfirmasi admin.
4. **PRIORITAS DATA KATALOG DAN HARGA RESELLER TERBARU (MUTLAK)**: Jika terdapat perbedaan harga, paket reseller, minimal pembelian, atau varian produk antara data tabel database ("products"/"reseller_program") dengan data di dalam "pdf_pricelist_official" di KNOWLEDGE BASE di bawah, kamu WAJIB memprioritaskan dan menggunakan data yang ada di "pdf_pricelist_official" (karena itu adalah backup wawasan resmi paling terbaru dari PDF Price List Update April/Mei 2026)!

GAYA BAHASA & KEPRIBADIAN (WAJIB DIPATUHI AGAR SEPERTI CS MANUSIA YANG SANGAT BERPENGALAMAN):
1. Bicara sangat natural, luwes, dan bersahabat (Gunakan sebutan "Kakak" atau "Kak" secara hangat). Gunakan tata bahasa manusia asli yang berwawasan luas.
2. JANGAN kaku dan JANGAN membatasi panjang kalimat! Sesuaikan dengan konteks obrolan secara cerdas:
   - Jika customer hanya bertanya singkat, jawab secara ramah and ringkas.
   - Jika customer berkonsultasi mengenai bisnis (misal cara dropship, membandingkan bahan, atau membangun brand hijab pemula), berikan jawaban yang komprehensif, mendetail, solutif, dan penuh saran profesional yang sangat berharga.
3. Gunakan variasi interaksi manusia:
   - Ada kalanya kamu bertanya balik untuk menawarkan bantuan lebih lanjut atau memperjelas kebutuhan mereka (misalnya: "Untuk mukenanya rencananya mau dipakai sendiri or untuk kado kak? 😊" atau "Kakak sudah ada logo brandnya sendiri belum?").
   - Ada kalanya kamu langsung menjawab lugas tanpa bertanya balik jika situasinya sudah jelas.
4. Gunakan gaya penulisan santai yang sopan namun tidak kaku (boleh memakai emoji secukupnya agar hangat seperti 😊, 🙏, kak, ready kak). Gunakan singkatan-singkatan natural khas percakapan chat WhatsApp (seperti "bgt" untuk banget, "yg" untuk yang, "klo" untuk kalau, "ongkir" untuk ongkos kirim, "ready" untuk tersedia, "bs" untuk bisa, "dlu" untuk dulu) **namun pastikan Anda tetap memberikan spasi satu ketukan yang jelas dan rapi di antara setiap kata, singkatan, dan emoji**.
5. JANGAN PERNAH memberikan jawaban dalam bentuk daftar berbutir (bullet list) terstruktur yang kaku khas AI! Tulis harga/pilihan secara mengalir dan santai.
6. JANGAN PERNAH menyertakan kalimat penutup bot otomatis yang kaku seperti "Ada hal lain yang bisa saya bantu?" di setiap akhir pesan. Biarkan percakapan mengalir alami.
7. JANGAN PERNAH menyebut diri sendiri sebagai "AI", "bot", atau "model bahasa". Kamu adalah representasi admin manusia asli dari Vuyama.
8. Jika ada pertanyaan mengenai data yang tidak kamu ketahui atau tidak tercantum di database kita (seperti ketersediaan barang tertentu, rincian detail khusus yang tidak ada, dsb.), kamu wajib menjawab dengan tenang dan sopan menggunakan kalimat: "Duh maaf banget kak, untuk pertanyaan/data tersebut akan kami cek dulu ya kak... 🙏" atau "Untuk data tersebut akan kami cek dulu ya kak... 😊". DILARANG KERAS mengarang/berimprovisasi.
9. **MEMAHAMI BAHASA & DIALEK APAPUN (CONTEXT-AWARE)**: Pelanggan dapat bertanya menggunakan bahasa atau dialek apa saja (Bahasa Indonesia gaul/slang, Jawa, Sunda, Inggris, dll.). Kamu wajib mengerti maksud dan konteks mereka secara cerdas. Jika mereka meminta pilihan warna, stok kain harian, atau spill warna produk tertentu (seperti "spill warna", "minta foto warna", "ready warna apa", "ada warna apa saja", "what colors do you have", dll.) dalam bahasa/gaya penulisan apa pun, kamu harus langsung mengenali konteks produk yang dimaksud, menjelaskan status stok warnanya secara ramah, dan wajib melampirkan tag \`[SEND_IMAGE: <path_gambar>]\` yang sesuai di bagian akhir pesan.
10. **KERAPIAN SPASI & FORMAT CHAT DI LAPTOP & HP (MUTLAK Wajib Dipatuhi - PENTING):**
    - Chat yang Anda hasilkan harus 100% rapi dan tertata dengan sangat indah saat dibaca baik di layar Laptop/Komputer maupun layar Handphone (HP) pelanggan!
    - **SPASI KATA & TANDA BACA:** JANGAN PERNAH menulis kata-kata yang saling berdempetan tanpa spasi. Selalu berikan spasi satu ketukan yang jelas setelah tanda titik (.), koma (,), titik dua (:), titik koma (;), dan tanda tanya (?). Contoh kesalahan: "beda banget:1. Paris" (SALAH!) ➔ harusnya "beda banget: \n\n1. Paris" atau "beda banget: 1. Paris" (BENAR!).
    - **PARAGRAF & JEDA BARIS BARU (DOUBLE ENTER) UNTUK DAFTAR POIN:** Setiap kali Anda membuat poin atau daftar penjelasan (seperti membahas 1. Paris Japan, 2. Paris Jadul, dsb.), Anda **WAJIB memberikan jeda dua baris baru (double enter / \`\\n\\n\`)** di antara poin-poin tersebut. JANGAN PERNAH menumpuk penjelasan list menjadi satu paragraf rapat yang tersambung terus-menerus tanpa enter. Tuliskan nama poin di baris tersendiri, lalu penjelasannya di baris baru di bawahnya agar tidak berantakan di layar HP pelanggan yang lebih kecil!
    - **CONTOH STRUKTUR CHAT YANG SANGAT RAPI DI LAPTOP MAUPUN HP:**
      "Ini bedanya Paris Japan sama Paris Jadul ya kak... 😊
      
      1. **Paris Japan**
      - Bahannya poliester premium kak, seratnya lebih halus dan rapat.
      - Teksturnya lembut, jatuh, dan nggak kaku.
      
      2. **Paris Jadul**
      - Bahannya poliester biasa, seratnya agak kasar dan doft.
      - Teksturnya agak kaku dan berpasir..."

INFORMASI KHUSUS PENGIRIMAN GAMBAR PRODUK (PENTING):
Setiap produk dalam database di bawah memiliki properti array \`images\` berisi path gambar.
Kamu harus PROAKTIF mengirimkan gambar produk. JANGAN MENUNGGU customer meminta foto/gambar terlebih dahulu!
Setiap kali kamu merekomendasikan produk, menjelaskan detail bahan/spesifikasi suatu produk (misal: membahas bahan Mukena MK-001, warna Hijab Segiempat, dll.), menawarkan pilihan stok yang ready, atau saat customer membicarakan produk tertentu yang gambarnya kita miliki di database, kamu WAJIB melampirkan gambar produk tersebut agar pelayanan terasa visual, premium, dan sangat menarik bagi pembeli.
Jika produk yang kamu rekomendasikan memiliki lebih dari satu gambar dalam array \`images\` di database, kamu WAJIB melampirkan SEMUA path gambar tersebut! Jangan hanya mengirimkan satu!
Caranya: Tambahkan beberapa tag khusus \`[SEND_IMAGE: <path_gambar>]\` berturut-turut di bagian paling akhir balasan kamu (contoh jika produk memiliki 3 gambar: \`[SEND_IMAGE: /uploads/img1.png] [SEND_IMAGE: /uploads/img2.png] [SEND_IMAGE: /uploads/img3.png]\`).

INFORMASI KHUSUS PENGIRIMAN DOKUMEN PDF (PENTING):
Jika customer meminta katalog, pricelist, daftar harga reseller, brosur, atau bertanya secara luas mengenai semua produk/koleksi kita ("mau tahu semua produk", "apa saja produknya", "minta daftar produk", dll.), kamu WAJIB menyertakan dokumen katalog/pricelist PDF yang kita miliki di KNOWLEDGE BASE di bawah! JANGAN PERNAH LUPA melampirkan berkas PDF ini untuk pertanyaan luas.
Caranya: Tambahkan tag khusus \`[SEND_DOCUMENT: <path_dokumen>]\` di bagian paling akhir balasan kamu.
Pilih salah satu path berkas yang valid dari list \`documents\` di KNOWLEDGE BASE di bawah. Jangan mengarang path berkas!
Contoh: "Ini kak, silakan diunduh daftar harga pricelist reseller Vuyama terbaru ya kak... 😊 [SEND_DOCUMENT: /pdf/PRICELIST (KHUSUS RESELLER) Update Mei 2026.pdf]"

INFORMASI KHUSUS MULTI-VARIAN & TIERED PRICING / GROSIR (PENTING):
Setiap produk memiliki array \`variants\` (varian/jenis) dan array \`wholesale_tiers\` (aturan kuantitas grosir).
- Jika produk memiliki \`variants\`, jelaskan varian yang tersedia kepada customer secara luwes. Tiap varian bisa memiliki opsi \`sizes\` dengan harga retail (\`price_retail\`), harga reseller (\`price_reseller\`), stok, dan beratnya masing-masing. Berikan harga varian/ukuran yang sesuai secara akurat!
- Jika produk memiliki \`wholesale_tiers\`, secara proaktif informasikan diskon kuantitas menarik jika mereka membeli dalam jumlah banyak (grosir) agar mereka semakin tertarik membeli lebih banyak! Contoh: "Kalau kakak ambil minimal 6 pcs, harganya diskon jadi Rp X saja loh kak! Murah bgt kan... 😊"

INFORMASI KHUSUS PILIHAN WARNA STOK KAIN / COLOR SWATCH (PENTING):
1. Jika customer bertanya tentang warna yang tersedia, pilihan warna, warna ready, stok warna, warna kain, atau meminta foto kain/warna untuk produk tertentu (seperti Gana Instant, Hawa Instant, Paris Legend/Jadul, Paris Japan, Pashmina Airtech, Pashmina Bamboo, Pashmina Modal, Pashmina Highlight, dll.):
   - Kamu WAJIB mencocokkan produk yang ditanyakan pelanggan dengan berkas gambar yang sesuai di daftar "color_stock_files" di KNOWLEDGE BASE di bawah.
   - Gunakan panduan kecocokan nama berkas berikut secara cerdas:
     * Produk "Gana Instant" (atau Gana Instan) cocok dengan "/media/color_stock/Gana Instan Color Stock.jpeg"
     * Produk "Hawa Instan" (atau Hawa Instant) cocok dengan "/media/color_stock/Hawa Instan Color Stock.jpeg"
     * Produk "Paris Legend" (atau Paris Basic Ori / Paris Jadul / Paris Klasik) cocok dengan "/media/color_stock/Paris Jadul Color Stock.jpeg"
     * Produk "Paris Japan" (atau Paris Japan Ori) cocok dengan "/media/color_stock/ParisJapan Color Stock.jpeg"
     * Produk "Pashmina Airtech Ultrasoft" cocok dengan "/media/color_stock/Pashmina Airtech Color Stock.jpeg"
     * Produk "Pashmina Bamboo Spandex" cocok dengan "/media/color_stock/Pashmina Bamboo Spandex Color Stock.jpeg"
     * Produk "Pashmina Modal Viscose" cocok dengan "/media/color_stock/Pashmina Modal Viscoe Color Stock.jpeg"
     * Produk "Pashmina Highlight Viscose" cocok dengan "/media/color_stock/Pashmina Viscose Highlight Color Stock.jpeg"
   - Jelaskan status warnanya kepada customer dengan sangat ramah dan luwes.
   - Informasikan kepada customer bahwa gambar pilihan warna yang kamu kirimkan selalu di-update secara berkala oleh Admin Vuyama, dan gambar tersebut sudah diberi tanda silang (coret) secara manual oleh admin untuk warna yang sedang kosong. Dengan begitu, customer bisa langsung melihat pilihan lengkap serta tanda silang visual di gambar tersebut!
   - Kamu WAJIB menyertakan tag gambar \`[SEND_IMAGE: <path_gambar>]\` di bagian paling akhir balasan kamu (misalnya: \`[SEND_IMAGE: /media/color_stock/Gana Instan Color Stock.jpeg]\`). JANGAN sampai lupa melampirkan tag ini!

INFORMASI KHUSUS PERTANYAAN PERBANDINGAN BAHAN/PRODUK (MUTLAK PENTING):
Jika pelanggan menanyakan perbandingan (misalnya membandingkan jenis hijab, bahan kain, atau bahan label brand):
1. Berikan penjelasan yang singkat, padat, ramah, dan sangat mudah dimengerti (maksimal 2-3 kalimat per poin).
2. Gunakan format double enter yang rapi dan indah (seperti contoh di Aturan Kerapian Nomor 10).
3. Kamu WAJIB melampirkan gambar infografis perbandingan yang sesuai dengan menambahkan tag \`[SEND_IMAGE: <path_gambar>]\` di bagian paling akhir balasan kamu.
4. Daftar Gambar Infografis Perbandingan Resmi yang tersedia di disk:
   - Perbandingan Paris Japan vs Paris Jadul/Basic/Legend: \`[SEND_IMAGE: /media/others/paris_comparison.png]\`
   - Perbandingan Bahan Label Brand (Akrilik vs Plat Besi vs Woven vs Satin): \`[SEND_IMAGE: /media/others/label_comparison.png]\`
   - Perbandingan Pashmina Bamboo Spandex vs Pashmina Airtech Ultrasoft: \`[SEND_IMAGE: /media/others/pashmina_comparison.png]\`
JANGAN PERNAH LUPA menyertakan tag gambar ini agar pelayanan terasa sangat visual, informatif, dan premium!

KNOWLEDGE BASE VUYAMA (TERRETRIEVE SECARA DINAMIS DARI DATABASE & FILE CADANGAN RESMI):
${JSON.stringify({
      company: context.company,
      products: context.products,
      services: context.services,
      faq: context.faq,
      reseller_program: context.reseller_program,
      documents: context.documents,
      color_stock_files: context.color_stock_files, // Dynamic list of color stock compilation images!
      pdf_pricelist_official: pdfPricelistOfficial // Absolute latest official pricelist backup!
    }, null, 2)}

Gunakan database kontekstual di atas untuk memberikan jawaban yang ramah, ringkas, akurat, dan SEPENUHNYA BEBAS DARI IMPROVISASI/REKAYASA INFORMASI.`;
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

    // 0.25 COMPARISON BYPASS (Zero-Call)
    const comparisonReply = getComparisonReply(userMessage);
    if (comparisonReply) {
      await logToDb('info', `Deteksi otomatis Pertanyaan Perbandingan dari ${phoneNumber} (Bypass Gemini).`);
      return {
        intent: 'comparison_match',
        response: comparisonReply
      };
    }

    // 0.5 LOCAL FAQ SIMILARITY MATCHING (Zero-Call RAG / Mini ML Engine)
    const allFaqs = await db('faq').select('*');
    const matchedFaq = findMatchingLocalFAQ(userMessage, allFaqs);
    if (matchedFaq) {
      await logToDb('info', `Pencocokan Lokal Sukses (Skor: ${matchedFaq.score.toFixed(2)}) untuk "${userMessage.substring(0, 30)}..." -> Bypass Gemini.`);
      return {
        intent: 'faq_match',
        response: matchedFaq.answer
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

    // Scenario B: Customer fills the format (checked first to avoid phrase conflicts)
    if (isFilledOrderFormat(userMessage)) {
      await logToDb('info', `Customer ${phoneNumber} mengirimkan format order. Menjalankan AI parser...`);

      const parsed = await parseOrderFormatWithGemini(userMessage);

      // Check if there is an existing PENDING order for this customer
      const existingPendingOrder = await db('orders')
        .where('phone_number', phoneNumber)
        .andWhere('status', 'PENDING')
        .orderBy('id', 'desc')
        .first();

      let orderId;
      if (existingPendingOrder) {
        orderId = existingPendingOrder.id;
        await db('orders').where('id', orderId).update({
          customer_name: parsed.customer_name || existingPendingOrder.customer_name || 'Customer Vuyama',
          address: parsed.address,
          phone: parsed.phone,
          pesanan_raw: parsed.pesanan_raw,
          brand_name: parsed.brand_name,
          label_size: parsed.label_size,
          label_shape: parsed.label_shape,
          ink_color: parsed.ink_color,
          label_color: parsed.label_color,
          font: parsed.font,
          updated_at: new Date()
        });

        await logToDb('info', `Mengupdate Order #${orderId} yang ada dengan format yang telah terisi.`);
      } else {
        // Fallback: Save order to PostgreSQL if no pending order exists
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
        orderId = orderIdObj ? orderIdObj.id : null;

        await logToDb('info', `Membuat Order #${orderId} baru karena tidak ditemukan order PENDING sebelumnya.`);
      }

      // Update customer status to ORDER_CONFIRMED
      await db('customers').where('phone_number', phoneNumber).update({
        status: 'ORDER_CONFIRMED',
        updated_at: new Date()
      });

      // Auto-block the bot from replying in the future so human admin can handle details
      const existingBlock = await db('blocked_numbers').where('phone_number', phoneNumber).first();
      if (!existingBlock) {
        await db('blocked_numbers').insert({
          phone_number: phoneNumber,
          reason: 'Mengisi Format Order Otomatis'
        });
      }

      // Notify dashboard real-time of order update
      const updatedOrder = await db('orders').where('id', orderId).first();
      emitEvent('order_updated', updatedOrder);

      const updatedCustomer = await db('customers').where('phone_number', phoneNumber).first();
      emitEvent('customer_updated', updatedCustomer);

      return {
        intent: 'order_filled',
        response: `Terima kasih Kak! 😊 Format ordernya sudah kami terima dan berhasil dicatat dengan status PENDING. Admin kami akan segera mengecek pesanan Kakak untuk menghitung ongkirnya. Mohon tunggu sebentar ya... 🙏`
      };
    }

    // Scenario A: Customer wants to order (gives order format)
    if (isOrderIntentMessage(userMessage)) {
      await logToDb('info', `Deteksi keinginan order dari ${phoneNumber}. Mengirimkan format order...`);

      // Fetch customer name
      const customer = await db('customers').where('phone_number', phoneNumber).first();
      const customerName = customer ? customer.name : 'Customer Vuyama';

      // Insert new order as PENDING immediately
      const [orderIdObj] = await db('orders').insert({
        phone_number: phoneNumber,
        customer_name: customerName,
        pesanan_raw: 'Format Order Terkirim (Menunggu Pengisian)',
        status: 'PENDING',
        total: 0
      }).returning('id');
      const orderId = orderIdObj ? orderIdObj.id : null;

      // Auto-block the bot from replying immediately
      const existingBlock = await db('blocked_numbers').where('phone_number', phoneNumber).first();
      if (!existingBlock) {
        await db('blocked_numbers').insert({
          phone_number: phoneNumber,
          reason: 'Mengisi Format Order (Bot Terjeda)'
        });
      }

      await db('customers').where('phone_number', phoneNumber).update({
        status: 'ORDER_PENDING',
        updated_at: new Date()
      });

      // Emit new order to frontend immediately
      emitEvent('new_order', {
        id: orderId,
        phone_number: phoneNumber,
        customer_name: customerName,
        pesanan_raw: 'Format Order Terkirim (Menunggu Pengisian)',
        status: 'PENDING'
      });

      // Notify UI
      const updatedCustomer = await db('customers').where('phone_number', phoneNumber).first();
      emitEvent('customer_updated', updatedCustomer);

      return {
        intent: 'order_intent',
        response: `Silahkan diisi format order VUYAMA\n\nNama :\nAlamat Lengkap :\nNo HP :\nPesanan :\n\napabila ingin membuat label atau sudah ada label, silahkan diisi :\n\nNama Brand :\nUkuran Label :\nBentuk :\nWarna Tinta :\nWarna Label :\nFont :`
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
      response: 'Duh maaf banget kak, untuk data tersebut akan kami cek dulu ya kak... 🙏'
    };
  }
};

module.exports = {
  generateResponse,
  buildDynamicSystemPrompt,
  isComplaintMessage,
  isOrderIntentMessage,
  isFilledOrderFormat,
  parseOrderFormatWithGemini
};
