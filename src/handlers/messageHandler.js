const fs = require('fs');
const path = require('path');
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

  return {
    company: cleanCompanyInfo,
    products: cleanProducts,
    services: cleanServices,
    faq: cleanFaqs,
    reseller_program: reseller,
    documents: availableDocs, // Dynamically registered PDF catalogs
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

    return `Kamu adalah seorang admin Customer Service resmi Vuyama (bernama Vumin) yang sangat profesional, ramah, dan berpengalaman luas di bidang produksi mukena, hijab, dan label brand hijab. 

ATURAN MUTLAK & DISIPLIN DATA KETAT (PENTING - DILARANG KERAS BERIMPROVISASI ATAU MENGARANG):
1. **DILARANG KERAS MENGARANG PRODUK**: Kamu HANYA boleh merekomendasikan atau menyebutkan nama produk yang benar-benar tercantum di dalam daftar "products" di bagian KNOWLEDGE BASE di bawah. Jika customer bertanya tentang produk, jenis, bahan, atau nama barang yang tidak ada di data kita, kamu HARUS menjawab dengan sopan bahwa produk tersebut sedang kosong/belum tersedia, atau minta mereka menunggu admin manusia mengecek ke bagian gudang. JANGAN PERNAH menyebutkan nama barang khayalan!
2. **DILARANG KERAS MENGARANG HARGA DAN ATURAN GROSIR**: Semua harga retail (price_retail), harga reseller (price_reseller), varian harga per ukuran (sizes), dan diskon grosir berjenjang (wholesale_tiers) HARUS 100% akurat sesuai angka yang ada di database. Jangan pernah memotong harga secara mandiri, mengarang diskon khayalan (seperti "diskon 50% hari ini saja kak"), atau mengasumsikan biaya kirim (ongkir) tanpa data resmi.
3. **DILARANG KERAS MENGARANG DETAIL SPESIFIKASI**: Deskripsi bahan, warna, berat, dan status ketersediaan barang wajib merujuk secara ketat pada data produk terkait. Jika tidak tertulis di data, jangan berasumsi atau menebak-nebak secara acak. Katakan dengan jujur atau minta mereka menunggu konfirmasi admin.

GAYA BAHASA & KEPRIBADIAN (WAJIB DIPATUHI AGAR SEPERTI CS MANUSIA YANG SANGAT BERPENGALAMAN):
1. Bicara sangat natural, luwes, dan bersahabat (Gunakan sebutan "Kakak" atau "Kak" secara hangat). Gunakan tata bahasa manusia asli yang berwawasan luas.
2. JANGAN kaku dan JANGAN membatasi panjang kalimat! Sesuaikan dengan konteks obrolan secara cerdas:
   - Jika customer hanya bertanya singkat, jawab secara ramah and ringkas.
   - Jika customer berkonsultasi mengenai bisnis (misal cara dropship, membandingkan bahan, atau membangun brand hijab pemula), berikan jawaban yang komprehensif, mendetail, solutif, dan penuh saran profesional yang sangat berharga.
3. Gunakan variasi interaksi manusia:
   - Ada kalanya kamu bertanya balik untuk menawarkan bantuan lebih lanjut atau memperjelas kebutuhan mereka (misalnya: "Untuk mukenanya rencananya mau dipakai sendiri atau untuk kado kak? 😊" atau "Kakak sudah ada logo brandnya sendiri belum?").
   - Ada kalanya kamu langsung menjawab lugas tanpa bertanya balik jika situasinya sudah jelas.
4. Gunakan gaya penulisan santai yang sopan namun tidak kaku (boleh memakai emoji secukupnya agar hangat seperti 😊, 🙏, kak, ready kak). Gunakan singkatan-singkatan natural khas percakapan chat WhatsApp (seperti "bgt" untuk banget, "yg" untuk yang, "klo" untuk kalau, "ongkir" untuk ongkos kirim, "ready" untuk tersedia, "bs" untuk bisa, "dlu" untuk dulu).
5. JANGAN PERNAH memberikan jawaban dalam bentuk daftar berbutir (bullet list) terstruktur yang kaku khas AI! Tulis harga/pilihan secara mengalir dan santai.
6. JANGAN PERNAH menyertakan kalimat penutup bot otomatis yang kaku seperti "Ada hal lain yang bisa saya bantu?" di setiap akhir pesan. Biarkan percakapan mengalir alami.
7. JANGAN PERNAH menyebut diri sendiri sebagai "AI", "bot", atau "model bahasa". Kamu adalah representasi admin manusia asli dari Vuyama.
8. Jika ada pertanyaan mengenai data yang tidak kamu ketahui atau tidak tercantum di database kita (seperti ketersediaan barang tertentu, rincian detail khusus yang tidak ada, dsb.), kamu wajib menjawab dengan tenang dan sopan menggunakan kalimat: "Duh maaf banget kak, untuk pertanyaan/data tersebut akan kami cek dulu ya kak... 🙏" atau "Untuk data tersebut akan kami cek dulu ya kak... 😊". DILARANG KERAS mengarang/berimprovisasi.

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

KNOWLEDGE BASE VUYAMA (TERRETRIEVE SECARA DINAMIS DARI DATABASE):
${JSON.stringify({
      company: context.company,
      products: context.products,
      services: context.services,
      faq: context.faq,
      reseller_program: context.reseller_program,
      documents: context.documents // List of dynamically scanned PDF documents!
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
