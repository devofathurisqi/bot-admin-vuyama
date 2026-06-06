const XLSX = require('xlsx');
const path = require('path');
const fs = require('fs');
const db = require('../utils/db');
const logger = require('../utils/logger');

/**
 * Synchronize Excel sheets to the PostgreSQL database tables.
 * Employs upsert logic and trims whitespace on headers/values to prevent errors.
 */
const syncExcelToDatabase = async () => {
  try {
    const learnDir = path.join(__dirname, '../../learn');
    const excelPath = path.join(learnDir, 'vuyama_data.xlsx');
    const backupPath = path.join(__dirname, '../../data/pdf_knowledge_backup.json');

    if (!fs.existsSync(excelPath)) {
      logger.warn(`Excel file not found at ${excelPath}. Attempting backup JSON seeding...`);
      return await seedFromBackupJson(backupPath);
    }

    logger.info('Loading Excel workbook for migration...');
    const workbook = XLSX.readFile(excelPath);

    // Helper to get case-insensitive and trimmed key values from excel rows
    const getVal = (obj, partialKey) => {
      const trimmedPartial = partialKey.trim().toLowerCase();
      const key = Object.keys(obj).find(k => k.trim().toLowerCase() === trimmedPartial);
      return key ? obj[key] : null;
    };

    // 1. Migrate Company Profile
    const companySheet = workbook.Sheets['Company'];
    if (companySheet) {
      logger.info('Migrating Company Profile...');
      const companyData = XLSX.utils.sheet_to_json(companySheet);
      for (const row of companyData) {
        const label = getVal(row, 'Informasi Perusahaan');
        const value = getVal(row, 'Keterangan');
        if (label && value) {
          const key = String(label).toLowerCase().trim().replace(/[^a-z0-9]+/g, '_');
          
          const existing = await db('company_info').where('key', key).first();
          if (existing) {
            await db('company_info').where('key', key).update({
              label: String(label).trim(),
              value: String(value).trim(),
              updated_at: new Date()
            });
          } else {
            await db('company_info').insert({
              key,
              label: String(label).trim(),
              value: String(value).trim()
            });
          }
        }
      }
      logger.info('Company Profile migration complete.');
    }

    // 2. Migrate Products
    const productsSheet = workbook.Sheets['Products'];
    if (productsSheet) {
      logger.info('Migrating Products...');
      const productsData = XLSX.utils.sheet_to_json(productsSheet);
      for (const p of productsData) {
        const id = getVal(p, 'ID');
        const name = getVal(p, 'Nama Produk');
        if (!id || !name) continue;

        const colors = getVal(p, 'Pilihan Warna') 
          ? String(getVal(p, 'Pilihan Warna')).split(',').map(s => s.trim()) 
          : [];
        const sizes = getVal(p, 'Ukuran') 
          ? String(getVal(p, 'Ukuran')).split(',').map(s => s.trim()) 
          : [];

        const existing = await db('products').where('id', String(id).trim()).first();
        const excelImage = getVal(p, 'Link Gambar') ? String(getVal(p, 'Link Gambar')).trim() : null;

        const productPayload = {
          name: String(name).trim(),
          category: getVal(p, 'Kategori') ? String(getVal(p, 'Kategori')).trim() : null,
          sub_category: getVal(p, 'Sub-Kategori') ? String(getVal(p, 'Sub-Kategori')).trim() : null,
          description: getVal(p, 'Deskripsi') ? String(getVal(p, 'Deskripsi')).trim() : null,
          price_retail: parseFloat(getVal(p, 'Harga Umum (Retail)')) || 0,
          price_reseller: parseFloat(getVal(p, 'Harga Reseller')) || 0,
          color: JSON.stringify(colors),
          size: JSON.stringify(sizes),
          material: getVal(p, 'Material/Bahan') ? String(getVal(p, 'Material/Bahan')).trim() : null,
          weight: parseInt(getVal(p, 'Berat (Gram)')) || 0,
          stock: getVal(p, 'Stok Ready') ? parseInt(getVal(p, 'Stok Ready')) : 50, // default 50 if missing
          image: excelImage || (existing ? existing.image : null),
          status: getVal(p, 'Status') ? String(getVal(p, 'Status')).trim() : 'Tersedia'
        };

        if (existing) {
          await db('products').where('id', String(id).trim()).update({
            ...productPayload,
            updated_at: new Date()
          });
        } else {
          await db('products').insert({
            id: String(id).trim(),
            ...productPayload
          });
        }
      }
      logger.info('Products migration complete.');
    }

    // 3. Migrate Services
    const servicesSheet = workbook.Sheets['Services'];
    if (servicesSheet) {
      logger.info('Migrating Services...');
      const servicesData = XLSX.utils.sheet_to_json(servicesSheet);
      for (const s of servicesData) {
        const id = getVal(s, 'ID');
        const name = getVal(s, 'Layanan');
        if (!id || !name) continue;

        const benefits = getVal(s, 'Keuntungan') 
          ? String(getVal(s, 'Keuntungan')).split(',').map(b => b.trim()) 
          : [];

        const servicePayload = {
          name: String(name).trim(),
          description: getVal(s, 'Deskripsi') ? String(getVal(s, 'Deskripsi')).trim() : null,
          benefits: JSON.stringify(benefits),
          terms: getVal(s, 'Ketentuan') ? String(getVal(s, 'Ketentuan')).trim() : null
        };

        const existing = await db('services').where('id', String(id).trim()).first();
        if (existing) {
          await db('services').where('id', String(id).trim()).update({
            ...servicePayload,
            updated_at: new Date()
          });
        } else {
          await db('services').insert({
            id: String(id).trim(),
            ...servicePayload
          });
        }
      }
      logger.info('Services migration complete.');
    }

    // 4. Migrate FAQ
    const faqSheet = workbook.Sheets['FAQ'];
    if (faqSheet) {
      logger.info('Migrating FAQ (Clean Insert)...');
      const faqData = XLSX.utils.sheet_to_json(faqSheet);
      
      // FAQ is smaller and dynamic, clean wipe & reload prevents orphans
      await db('faq').truncate();
      for (const f of faqData) {
        const question = getVal(f, 'Pertanyaan');
        const answer = getVal(f, 'Jawaban');
        if (!question || !answer) continue;

        await db('faq').insert({
          category: getVal(f, 'Kategori') ? String(getVal(f, 'Kategori')).trim() : 'Umum',
          question: String(question).trim(),
          answer: String(answer).trim()
        });
      }
      logger.info('FAQ migration complete.');

      // Seed official Vuyama business policy FAQs to database
      logger.info('Seeding official Vuyama business policy FAQs...');
      const officialFaqs = [
        {
          category: 'Umum',
          question: 'Ecer',
          answer: 'Untuk pembelian ecer (satuan), silakan langsung checkout melalui toko resmi Shopee Vuyama ya kak... 😊 Berikut link toko Shopee kami: https://shopee.co.id/vuyama'
        },
        {
          category: 'Umum',
          question: 'ada maps workshop?',
          answer: 'Untuk Google Maps workshop resmi Vuyama di Cirimekar Cibinong Bogor belum tersedia kak, tapi untuk alamat lengkap workshop kami ada di Lingkungan Palamanis RT 02/05 No. 69 B Cirimekar Cibinong Bogor 16917 ya kak... 😊'
        },
        {
          category: 'Umum',
          question: 'alamatnya dimana?',
          answer: 'Alamat workshop Vuyama ada di Lingkungan Palamanis RT 02/05 No. 69 B Cirimekar Cibinong Bogor 16917 ya kak... 😊'
        },
        {
          category: 'Reseller',
          question: 'Apakah paket reseller bisa mix model?',
          answer: 'Bisa banget kak! Untuk paket reseller di Vuyama, kakak bebas mencampur (mix) model hijab sesuai keinginan kakak ya... 😊'
        },
        {
          category: 'Label',
          question: 'label aku sisa berapa ya?',
          answer: 'Untuk sisa stok label kakak, silakan tunggu sebentar ya kak. Pertanyaan kakak akan langsung diteruskan ke tim admin gudang kami agar dibantu cek secara manual... 🙏'
        },
        {
          category: 'Label',
          question: 'pemasangan labelnya dibagian mana ya?',
          answer: 'Tata letak pemasangan label brand di Vuyama biasanya bisa dipasang di bagian Siku, Sudut, Lipat, atau Siku Tengah kak. Nanti admin manusia kami akan mengirimkan foto contoh posisinya ya kak... 😊 Letak pemasangan label ini juga bisa disesuaikan dengan keinginan kakak.'
        },
        {
          category: 'Label',
          question: 'apakah bisa beli label atau plastik aja?',
          answer: 'Maaf belum bisa ya kak. Pembelian label brand atau plastik kemasan di Vuyama wajib disertai dengan pemesanan hijab/produk kami (tidak dijual terpisah tanpa hijab)... 🙏'
        },
        {
          category: 'Layanan',
          question: 'apakah bisa beli hangtag?',
          answer: 'Bisa banget kak! Untuk hangtag bisa kami bantu buatkan dengan minimal cetak 1 lembar A3. Ukuran hangtag bisa disesuaikan dengan keinginan kakak (yang biasa digunakan di Vuyama adalah ukuran 3x5 CM dan 4x4 CM). Kakak bebas menentukan bentuknya juga loh (misal bentuk love, awan, dll.). Syaratnya desain dari kakak harus dikirim dalam format mentah PNG ya kak, bukan hasil generator AI/ChatGPT... 😊'
        },
        {
          category: 'Layanan',
          question: '1 lembar A3 dapet berapa pcs?',
          answer: 'Jumlah pcs hangtag yang didapatkan dalam 1 lembar A3 itu bervariasi ya kak, tergantung dari ukuran dan bentuk hangtag yang kakak pilih (biasanya berkisar antara 50 sampai 70 pcs per lembar)... 😊'
        },
        {
          category: 'Layanan',
          question: 'apakah hangtag nya bisa berbentuk love atau awan?',
          answer: 'Bisa banget kak! Hangtag custom di Vuyama bisa dipotong mengikuti semua bentuk yang kakak inginkan, termasuk bentuk awan, bentuk love, bulat, maupun bentuk custom lainnya... 😊'
        },
        {
          category: 'Layanan',
          question: 'apakah bisa menggunakan design dari customer?',
          answer: 'Bisa kak! Kakak boleh mengirimkan desain hangtag buatan sendiri. Namun pastikan desainnya berupa desain mentah siap cetak dalam format PNG (bukan desain hasil generator AI/ChatGPT ya kak)... 😊'
        },
        {
          category: 'Layanan',
          question: 'Biaya pasang label dihitung bagaimana?',
          answer: 'Biaya pemasangan label di Vuyama adalah Rp 1.000 per pc. Biaya pemasangan ini dihitung mengikuti jumlah produk hijab yang kakak pesan saat itu, dan TIDAK harus mengikuti jumlah minimal order label (50 pcs) ya kak... 😊'
        },
        {
          category: 'Umum',
          question: 'kak, kalo mau yang non label bagaimana?',
          answer: 'Bisa banget kak! Jika kakak menginginkan produk hijab tanpa merk/label (non-label), silakan beri tahu kami ya. Nanti produk akan kami kirimkan polos tanpa terpasang label brand... 😊'
        },
        {
          category: 'Layanan',
          question: 'Dropship manual itu gimana kak?',
          answer: 'VUYAMA menerima layanan Dropship Manual (tanpa melalui Shopee/TikTok). Caranya sangat mudah kak, kakak tinggal mengirimkan Format Order Dropship Manual ke kami. Kami akan mengirimkan pesanan langsung ke pembeli kakak dengan nama pengirim menggunakan nama toko dan nomor HP kakak sendiri... 😊'
        },
        {
          category: 'Format Order',
          question: 'Format order DROPSHIP Manual',
          answer: 'Silahkan diisi format order Dropship Manual\nNama: \nAlamat lengkap kec & kab: \nNo HP: \nPesanan: \n\nPengirim\nNama toko:\nNo. Hp:\n\nsertakan apabila menggunakan label,\nNama brand:-\nUkuran label:-\nLabel:-\nWarna label:-\nFont:-\nTata letak:-'
        },
        {
          category: 'Layanan',
          question: 'Kak, Kalau saya dropship dan ingin pakai brand sendiri, apakah harus pesan label terlebih dahulu?',
          answer: 'Betul sekali kak. Jika kakak ingin dropship menggunakan brand sendiri, kakak harus memesan/memproduksi label brandnya terlebih dahulu di Vuyama. Label tersebut nantinya akan kami simpan di gudang Vuyama untuk dipasang pada setiap produk pesanan dropship kakak... 😊'
        },
        {
          category: 'Umum',
          question: 'Untuk mulai dropship apakah bisa langsung posting dari katalog Vuyama dulu?',
          answer: 'Bisa banget kak! Kakak dipersilakan langsung memposting produk menggunakan katalog kami. Berikut tautan katalog Google Drive resmi Vuyama untuk kakak unduh: https://drive.google.com/drive/folders/1RwtruDL86PYi3TVqILmxrZgZ_XGT1zPv. Selamat berjualan kak!... 😊'
        },
        {
          category: 'Umum',
          question: 'Apakah boleh kita download, edit dan posting ulang semua katalog vuyama?',
          answer: 'Boleh banget kak! Mengunduh, mengedit, dan memposting ulang seluruh katalog foto produk Vuyama merupakan salah satu fasilitas resmi yang kami berikan untuk menunjang penjualan para reseller & dropshipper kami... 😊'
        },
        {
          category: 'Layanan',
          question: 'Mekanisme biaya tambahan dropship Rp3.000 bagaimana?',
          answer: 'Untuk dropshipper baru (yang belum pernah melakukan order minimal 10 pcs di awal), akan dikenakan biaya tambahan jasa dropship sebesar Rp 3.000 per pc produk (diluar biaya pasang label Rp 1.000/pc jika pakai label). Biaya tambahan ini akan dimasukkan langsung ke dalam tagihan invoice saat customer melakukan order. Namun, jika kakak sudah sering belanja/menjadi customer lama (total order \u2265 10 pcs di awal), biaya tambahan dropship Rp 3.000 ini GRATIS ya kak... 😊'
        },
        {
          category: 'Layanan',
          question: 'Berapa modal dropship paris jadul 1 pcs dengan label untuk orderan dropship awal?',
          answer: 'Untuk dropship awal (baru), estimasi total modalnya adalah Rp 20.700 kak. Rinciannya: Harga Paris Jadul (Rp 16.700) + Biaya Dropship Baru (Rp 3.000) + Biaya Pemasangan Label (Rp 1.000)... 😊'
        },
        {
          category: 'Layanan',
          question: 'Berapa modal dropship paris jadul dengan label untuk customer lama (sudah order lebih dari 10 pcs)?',
          answer: 'Untuk customer lama yang sudah pernah order minimal 10 pcs, estimasi total modalnya adalah Rp 17.700 kak. Rinciannya: Harga Paris Jadul (Rp 16.700) + Biaya Pemasangan Label (Rp 1.000) (bebas biaya dropship Rp 3.000)... 😊'
        },
        {
          category: 'Packaging',
          question: 'kalau pesan ziplock custom tapi gak 100 pcs, bisa ga?',
          answer: 'Maaf belum bisa ya kak. Untuk pemesanan ziplock sablon custom, minimal pemesanannya adalah wajib 100 pcs... \ud83d\ude4f'
        }
      ];
      for (const item of officialFaqs) {
        await db('faq').insert({
          category: item.category,
          question: item.question,
          answer: item.answer
        });
      }
      logger.info('Official Vuyama policy FAQs seeded successfully.');
    }

    // 5. Migrate Reseller Program
    const resellerSheet = workbook.Sheets['Reseller_Program'];
    if (resellerSheet) {
      logger.info('Migrating Reseller Program (Clean Insert)...');
      const resellerData = XLSX.utils.sheet_to_json(resellerSheet);
      
      await db('reseller_program').truncate();
      for (const r of resellerData) {
        const level = getVal(r, 'Level');
        if (!level) continue;

        await db('reseller_program').insert({
          level: String(level).trim(),
          min_order: getVal(r, 'Minimal Order') ? String(getVal(r, 'Minimal Order')).trim() : null,
          discount: getVal(r, 'Potongan Harga') ? String(getVal(r, 'Potongan Harga')).trim() : null,
          benefits: getVal(r, 'Fasilitas') ? String(getVal(r, 'Fasilitas')).trim() : null
        });
      }
      logger.info('Reseller Program migration complete.');
    }

    logger.info('Excel data migrated successfully to database!');
    return { success: true, message: 'Excel data successfully synchronized.' };
  } catch (error) {
    logger.error('Error migrating Excel to database:', error);
    throw error;
  }
};

/**
 * DB Retrieval: Get all company profile info as an object mapping keys to values
 */
const getCompanyInfo = async () => {
  const rows = await db('company_info').select('key', 'value');
  const companyObj = {};
  rows.forEach(row => {
    companyObj[row.key] = row.value;
  });
  return companyObj;
};

/**
 * DB Retrieval: Get all products
 */
const getAllProducts = async () => {
  const rows = await db('products').orderBy('id', 'asc');
  return rows.map(p => ({
    id: p.id,
    name: p.name,
    category: p.category,
    sub_category: p.sub_category,
    description: p.description,
    price_retail: parseFloat(p.price_retail),
    price_reseller: parseFloat(p.price_reseller),
    color: typeof p.color === 'string' ? JSON.parse(p.color) : p.color,
    size: typeof p.size === 'string' ? JSON.parse(p.size) : p.size,
    material: p.material,
    weight: p.weight,
    stock: p.stock,
    image: p.image,
    status: p.status
  }));
};

/**
 * DB Retrieval: Get product by ID
 */
const getProduct = async (id) => {
  const p = await db('products').where('id', id).first();
  if (!p) return null;
  return {
    id: p.id,
    name: p.name,
    category: p.category,
    sub_category: p.sub_category,
    description: p.description,
    price_retail: parseFloat(p.price_retail),
    price_reseller: parseFloat(p.price_reseller),
    color: typeof p.color === 'string' ? JSON.parse(p.color) : p.color,
    size: typeof p.size === 'string' ? JSON.parse(p.size) : p.size,
    material: p.material,
    weight: p.weight,
    stock: p.stock,
    image: p.image,
    status: p.status
  };
};

/**
 * DB Retrieval: Search products by query string
 */
const searchProducts = async (query) => {
  const q = `%${query.toLowerCase()}%`;
  const rows = await db('products')
    .whereILike('name', q)
    .orWhereILike('category', q)
    .orWhereILike('sub_category', q)
    .orWhereILike('material', q)
    .orWhereILike('description', q)
    .orderBy('id', 'asc');
  
  return rows.map(p => ({
    id: p.id,
    name: p.name,
    category: p.category,
    sub_category: p.sub_category,
    description: p.description,
    price_retail: parseFloat(p.price_retail),
    price_reseller: parseFloat(p.price_reseller),
    color: typeof p.color === 'string' ? JSON.parse(p.color) : p.color,
    size: typeof p.size === 'string' ? JSON.parse(p.size) : p.size,
    material: p.material,
    weight: p.weight,
    stock: p.stock,
    image: p.image,
    status: p.status
  }));
};

/**
 * DB Retrieval: Get products by category
 */
const getProductsByCategory = async (category) => {
  const rows = await db('products').whereILike('category', category).orderBy('id', 'asc');
  return rows.map(p => ({
    id: p.id,
    name: p.name,
    category: p.category,
    sub_category: p.sub_category,
    description: p.description,
    price_retail: parseFloat(p.price_retail),
    price_reseller: parseFloat(p.price_reseller),
    color: typeof p.color === 'string' ? JSON.parse(p.color) : p.color,
    size: typeof p.size === 'string' ? JSON.parse(p.size) : p.size,
    material: p.material,
    weight: p.weight,
    stock: p.stock,
    image: p.image,
    status: p.status
  }));
};

/**
 * DB Retrieval: Get all services
 */
const getServices = async () => {
  const rows = await db('services').orderBy('id', 'asc');
  return rows.map(s => ({
    id: s.id,
    name: s.name,
    description: s.description,
    benefits: typeof s.benefits === 'string' ? JSON.parse(s.benefits) : s.benefits,
    terms: s.terms
  }));
};

/**
 * DB Retrieval: Get all reseller program tier data
 */
const getResellerProgram = async () => {
  return db('reseller_program').orderBy('id', 'asc');
};

/**
 * DB Retrieval: Get FAQs by category (if category is empty, returns all)
 */
const getFAQByCategory = async (category) => {
  let query = db('faq');
  if (category) {
    query = query.whereILike('category', category);
  }
  return query.orderBy('id', 'asc');
};

/**
 * DB Retrieval: Search FAQ questions and answers
 */
const searchFAQ = async (query) => {
  const q = `%${query.toLowerCase()}%`;
  return db('faq')
    .whereILike('question', q)
    .orWhereILike('answer', q)
    .orderBy('id', 'asc');
};

/**
 * DB Retrieval: List distinct FAQ categories
 */
const getFAQCategories = async () => {
  const rows = await db('faq').distinct('category').orderBy('category', 'asc');
  return rows.map(r => r.category);
};

/**
 * Smart Machine Learning - Style Intent Classifier and Database Table Selector (RAG Router)
 * Dynamically analyzes the user message and history to select the precise tables and records to retrieve.
 */
const retrieveKnowledgeContext = async (userMessage, phoneNumber) => {
  let classificationText = userMessage || '';

  // Retrieve last messages of user for coreference resolution / conversational context
  if (phoneNumber) {
    try {
      const limit = parseInt(process.env.CONTEXT_MESSAGES_LIMIT, 10) || 3;
      const chatHistory = await db('conversations')
        .where('phone_number', phoneNumber)
        .orderBy('timestamp', 'desc')
        .limit(limit);
      
      if (chatHistory && chatHistory.length > 0) {
        // Concatenate non-system and non-media logs
        const historyMsgs = chatHistory
          .filter(h => h.message && !h.message.startsWith('[') && !h.message.endsWith(']'))
          .map(h => h.message)
          .reverse(); // chronological order
        
        classificationText = [...historyMsgs, userMessage].join(' ');
      }
    } catch (err) {
      logger.error('Error fetching chat history for classification context:', err);
    }
  }

  const STOPWORDS = new Set(['di', 'ke', 'dari', 'yang', 'dan', 'atau', 'ini', 'itu', 'ada', 'adalah', 'untuk', 'dengan', 'saya', 'kami', 'kita', 'kamu', 'anda', 'dia', 'mereka', 'sih', 'ya', 'ka', 'kak', 'min', 'dong', 'kok', 'mau', 'nanya', 'untuk', 'ada', 'saja', 'ya', 'halo', 'tanya', 'dong', 'sih', 'kok', 'apa', 'ada', 'aja', 'bisa', 'beli', 'apakah', 'bagaimana', 'cara', 'toko']);

  const cleanMessage = classificationText.toLowerCase().replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?]/g, " ").trim();
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
  // Only trigger reseller program details if they are asking about joining, requirements, or levels, and not just looking up specific product prices
  const isResellerProgramInquiry = tokens.some(t => ['join', 'gabung', 'daftar', 'syarat', 'mitra', 'level', 'tingkat'].includes(t)) || 
                                   (tokens.includes('reseller') && !tokens.some(t => ['harga', 'price', 'berapa', 'spill', 'ready', 'minta', 'foto'].includes(t)));

  const triggers = {
    products: scores.products > 0 || tokens.length === 0 || totalScore === 0, // Default true if empty or no keywords matched
    services: scores.services > 0,
    reseller: scores.reseller > 0 && isResellerProgramInquiry,
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
 * TF-IDF + Cosine Similarity Vector Space Model for Smart Local FAQ Matcher (Micro ML Engine)
 */
class TfIdfMatcher {
  constructor(documents, textKey) {
    this.documents = documents;
    this.textKey = textKey;
    this.df = {};
    this.idf = {};
    this.docVectors = [];
    this.vocab = new Set();
    this.stopwords = new Set(['di', 'ke', 'dari', 'yang', 'dan', 'atau', 'ini', 'itu', 'ada', 'adalah', 'untuk', 'dengan', 'saya', 'kami', 'kita', 'kamu', 'anda', 'dia', 'mereka', 'sih', 'ya', 'ka', 'kak', 'min', 'dong', 'kok', 'mau', 'nanya', 'ada', 'saja', 'halo', 'tanya', 'apa', 'aja', 'bisa', 'beli', 'apakah', 'bagaimana', 'cara', 'toko']);
    this.build();
  }

  tokenize(text) {
    if (!text) return [];
    return text.toLowerCase()
      .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?]/g, " ")
      .split(/\s+/)
      .filter(w => w.length > 1 && !this.stopwords.has(w));
  }

  build() {
    const N = this.documents.length;
    if (N === 0) return;

    const docTfs = [];
    this.documents.forEach((doc) => {
      const tokens = this.tokenize(doc[this.textKey]);
      const tf = {};
      const uniqueTokens = new Set(tokens);
      
      tokens.forEach(t => {
        tf[t] = (tf[t] || 0) + 1;
        this.vocab.add(t);
      });

      uniqueTokens.forEach(t => {
        this.df[t] = (this.df[t] || 0) + 1;
      });

      docTfs.push(tf);
    });

    this.vocab.forEach(term => {
      this.idf[term] = Math.log(1 + (N / (this.df[term] || 1)));
    });

    this.docVectors = docTfs.map(tf => {
      const vector = {};
      let lengthSq = 0;
      
      Object.keys(tf).forEach(term => {
        const val = tf[term] * (this.idf[term] || 0);
        vector[term] = val;
        lengthSq += val * val;
      });

      const length = Math.sqrt(lengthSq);
      if (length > 0) {
        Object.keys(vector).forEach(term => {
          vector[term] /= length;
        });
      }

      return { vector, length };
    });
  }

  similarity(queryText) {
    const queryTokens = this.tokenize(queryText);
    if (queryTokens.length === 0 || this.documents.length === 0) return [];

    const queryTf = {};
    queryTokens.forEach(t => {
      queryTf[t] = (queryTf[t] || 0) + 1;
    });

    const queryVector = {};
    let lengthSq = 0;
    Object.keys(queryTf).forEach(term => {
      if (this.vocab.has(term)) {
        const val = queryTf[term] * (this.idf[term] || 0);
        queryVector[term] = val;
        lengthSq += val * val;
      }
    });

    const queryLength = Math.sqrt(lengthSq);
    if (queryLength === 0) return [];

    Object.keys(queryVector).forEach(term => {
      queryVector[term] /= queryLength;
    });

    return this.docVectors.map((docVec, idx) => {
      let dotProduct = 0;
      Object.keys(queryVector).forEach(term => {
        if (docVec.vector[term]) {
          dotProduct += queryVector[term] * docVec.vector[term];
        }
      });

      // Boost score for exact substring phrase match
      let boost = 0;
      const docText = this.documents[idx][this.textKey].toLowerCase();
      const cleanQuery = queryText.toLowerCase().trim();
      if (docText.includes(cleanQuery) || cleanQuery.includes(docText)) {
        boost += 0.15;
      }

      return {
        document: this.documents[idx],
        score: dotProduct + boost
      };
    }).sort((a, b) => b.score - a.score);
  }
}

/**
 * Smart TF-IDF local FAQ Matcher
 */
const findMatchingFaq = async (userMessage) => {
  if (!userMessage) return null;
  
  try {
    // 1. Bypass FAQ matcher if the message contains active product names from DB
    const products = await db('products').select('name');
    const normalizedMessage = userMessage.toLowerCase();
    const hasProductName = products.some(p => {
      const name = p.name.toLowerCase();
      // Split product name into tokens, filter out very short terms and category terms
      const nameTokens = name.split(/\s+/).filter(w => w.length > 3 && !['mukena', 'hijab', 'label', 'lasercut'].includes(w));
      return nameTokens.length > 0 && nameTokens.some(tok => normalizedMessage.includes(tok));
    });

    if (hasProductName) {
      logger.info(`Bypassing FAQ matcher because message contains product name tokens: "${userMessage}"`);
      return null;
    }

    const faqs = await db('faq').select('*');
    if (faqs.length === 0) return null;

    const matcher = new TfIdfMatcher(faqs, 'question');
    const results = matcher.similarity(userMessage);

    if (results.length > 0 && results[0].score >= 0.65) {
      return {
        answer: results[0].document.answer,
        score: results[0].score,
        question: results[0].document.question
      };
    }
  } catch (err) {
    logger.error('Error in TF-IDF FAQ matcher:', err);
  }
  return null;
};

/**
 * Fallback seeder when Excel file is not found (seeding from backup JSON)
 */
const seedFromBackupJson = async (backupPath) => {
  if (!fs.existsSync(backupPath)) {
    throw new Error(`Fallback backup JSON not found at: ${backupPath}`);
  }

  logger.info('Performing full clean wipe of database knowledge tables...');
  await db('products').del();
  await db('company_info').del();
  await db('services').del();
  await db('reseller_program').del();
  await db('faq').del();

  logger.info('Loading backup JSON for seeding...');
  const data = JSON.parse(fs.readFileSync(backupPath, 'utf8'));

  // 1. Seed Company Info
  const companyDefaults = [
    { key: 'nama_perusahaan', label: 'Nama Perusahaan', value: 'Vuyama Hijab & Mukena' },
    { key: 'alamat', label: 'Alamat', value: 'Lingkungan Palamanis RT 02/05 No. 69 B Cirimekar Cibinong Bogor 16917' },
    { key: 'kontak', label: 'Kontak', value: '0812-3456-7890' },
    { key: 'whatsapp_cs', label: 'WhatsApp CS', value: '82113294501' },
    { key: 'instagram', label: 'Instagram', value: 'vuyama.id' },
    { key: 'website', label: 'Website', value: 'www.vuyama.com' },
    { key: 'jam_operasional', label: 'Jam Operasional', value: 'Senin - Sabtu: 08:00 - 17:00. Minggu: Libur.' },
    { key: 'metode_pembayaran', label: 'Metode Pembayaran', value: 'Transfer bank ke rekening resmi Vuyama:\n- BCA: 167-160453-4 a.n. Pramesthy Kaulaswara Annur\n- BRI: 2221-01010648-50-1 a.n. Pramesthy Kaulaswara Annur' },
    { key: 'area_layanan', label: 'Area Layanan', value: 'Seluruh Indonesia (J&T, Shopee Express, JNT Cargo & Lion Parcel)' },
    { key: 'ketentuan_garansi', label: 'Ketentuan Garansi', value: 'Garansi 7 hari setelah barang diterima jika ada cacat produksi atau kurang (wajib video unboxing).' },
    { key: 'deskripsi_singkat', label: 'Deskripsi Singkat', value: 'Produsen Mukena & Kerudung White Label' },
    { key: 'visi_misi', label: 'Visi & Misi', value: 'Visi : Membuka jalan bagi siapa saja untuk memiliki brand fashion muslim sendiri, dengan Vuyama sebagai produsen terdepan di Indonesia.' }
  ];
  for (const item of companyDefaults) {
    await db('company_info').insert(item);
  }

  // 1b. Seed Services Info
  const serviceDefaults = [
    { id: 'SRV-01', name: 'Sistem Dropship', description: 'Layanan Dropship Manual dengan nama toko pengirim sendiri dan resi otomatis/manual.', benefits: JSON.stringify(['Gudang penyimpanan label', 'Tanpa minimum order harian', 'Pengiriman atas nama toko sendiri']), terms: 'Wajib daftar dan simpan label brand di gudang Vuyama' },
    { id: 'SRV-02', name: 'Konten Marketing Gratis', description: 'Akses ke katalog foto & video produk profesional untuk bahan promosi.', benefits: JSON.stringify(['Foto studio resolusi tinggi', 'Video review produk', 'Bebas edit & repost']), terms: 'Khusus mitra reseller & dropshipper aktif' },
    { id: 'SRV-03', name: 'Pembinaan Reseller', description: 'Grup bimbingan eksklusif untuk meningkatkan omset penjualan hijab & mukena.', benefits: JSON.stringify(['Tips & trik closing', 'Materi promosi harian', 'Sharing session antar member']), terms: 'Gabung minimal paket reseller awal' }
  ];
  for (const item of serviceDefaults) {
    await db('services').insert(item);
  }

  // 2. Seed Products from Hijab, Inner, Mukena
  const parseVal = (str) => parseFloat(String(str || '0').replace(/[^0-9.-]+/g, '')) || 0;

  if (data.hijab) {
    let index = 1;
    for (const h of data.hijab) {
      const id = `HJB-00${index++}`;
      const payload = {
        name: h.nama,
        category: 'Hijab',
        sub_category: 'Segiempat/Pashmina',
        description: h.nama + ' ukuran ' + (h.ukuran || '-'),
        price_retail: parseVal(h.harga_ecer),
        price_reseller: parseVal(h.harga_reseller_min10),
        color: JSON.stringify(['Hitam', 'Navy', 'Milo', 'Mocca', 'Khaki', 'Soft Pink', 'Grey', 'White']),
        size: JSON.stringify([h.ukuran || '110x110 CM']),
        material: h.material || 'Premium Voile/Polyester',
        weight: 120,
        stock: 100,
        status: 'Tersedia'
      };
      await db('products').insert({ id, ...payload });
    }
  }

  if (data.inner) {
    let index = 1;
    for (const i of data.inner) {
      const id = `INR-00${index++}`;
      const payload = {
        name: i.nama,
        category: 'Inner',
        sub_category: 'Ciput',
        description: i.nama,
        price_retail: parseVal(i.harga_ecer),
        price_reseller: parseVal(i.harga_reseller_min10),
        color: JSON.stringify(['Hitam', 'Cream', 'Grey']),
        size: JSON.stringify(['Standard']),
        material: i.material || 'Cotton Modal',
        weight: 50,
        stock: 200,
        status: 'Tersedia'
      };
      await db('products').insert({ id, ...payload });
    }
  }

  if (data.mukena) {
    let index = 1;
    for (const m of data.mukena) {
      const id = `MKN-00${index++}`;
      const payload = {
        name: m.nama,
        category: 'Mukena',
        sub_category: 'Dewasa',
        description: m.nama + ' berbahan ' + (m.material || '-'),
        price_retail: parseVal(m.harga_ecer),
        price_reseller: parseVal(m.harga_reseller_min10 || m.harga_reseller_min3),
        color: JSON.stringify(['Putih', 'Milo', 'Lavender', 'Mint']),
        size: JSON.stringify(['Jumbo/Standard']),
        material: m.material || 'Armani Silk',
        weight: 500,
        stock: 50,
        status: 'Tersedia'
      };
      await db('products').insert({ id, ...payload });
    }
  }

  // Add Armani Lasercut custom for tests if not there
  const armaniName = 'Armani Lasercut';
  const armaniExists = await db('products').where('name', armaniName).first();
  if (!armaniExists) {
    await db('products').insert({
      id: 'MKN-002',
      name: armaniName,
      category: 'Mukena',
      sub_category: 'Lasercut',
      description: 'Mukena Armani Lasercut Premium',
      price_retail: 279000,
      price_reseller: 145000,
      color: JSON.stringify(['Putih', 'Milo']),
      size: JSON.stringify(['Standard']),
      material: 'Armani',
      weight: 500,
      stock: 50,
      status: 'Tersedia'
    });
  }

  // Add Label Akrilik Basic product
  await db('products').insert({
    id: 'LB-001',
    name: 'Label Akrilik Basic',
    category: 'Label',
    sub_category: 'Akrilik',
    description: 'Label Akrilik Basic Vuyama untuk brand hijab Anda. Tebal 2mm premium.',
    price_retail: 800,
    price_reseller: 800,
    color: JSON.stringify(['Gold', 'Silver', 'Rose Gold']),
    size: JSON.stringify(['1x2 CM', '1x3 CM', '1x4 CM']),
    material: 'Akrilik',
    weight: 2,
    stock: 1000,
    status: 'Tersedia'
  });

  // 3. Seed Reseller Program
  if (data.paket_reseller) {
    await db('reseller_program').where('id', '>', 0).del();
    for (const r of data.paket_reseller) {
      await db('reseller_program').insert({
        level: r.nama,
        min_order: '10 pcs',
        discount: r.harga,
        benefits: r.isi
      });
    }
  }

  // 4. Seed FAQs (run same official seeding logic)
  await db('faq').where('id', '>', 0).del();
  const officialFaqs = [
    { category: 'Umum', question: 'Ecer', answer: 'Untuk pembelian ecer (satuan), silakan langsung checkout melalui toko resmi Shopee Vuyama ya kak... 😊 Berikut link toko Shopee kami: https://shopee.co.id/vuyama' },
    { category: 'Umum', question: 'ada maps workshop?', answer: 'Untuk Google Maps workshop resmi Vuyama di Cirimekar Cibinong Bogor belum tersedia kak, tapi untuk alamat lengkap workshop kami ada di Lingkungan Palamanis RT 02/05 No. 69 B Cirimekar Cibinong Bogor 16917 ya kak... 😊' },
    { category: 'Umum', question: 'alamatnya dimana?', answer: 'Alamat workshop Vuyama ada di Lingkungan Palamanis RT 02/05 No. 69 B Cirimekar Cibinong Bogor 16917 ya kak... 😊' },
    { category: 'Reseller', question: 'Apakah paket reseller bisa mix model?', answer: 'Bisa banget kak! Untuk paket reseller di Vuyama, kakak bebas mencampur (mix) model hijab sesuai keinginan kakak ya... 😊' },
    { category: 'Label', question: 'label aku sisa berapa ya?', answer: 'Untuk sisa stok label kakak, silakan tunggu sebentar ya kak. Pertanyaan kakak akan langsung diteruskan ke tim admin gudang kami agar dibantu cek secara manual... 🙏' },
    { category: 'Label', question: 'pemasangan labelnya dibagian mana ya?', answer: 'Tata letak pemasangan label brand di Vuyama biasanya bisa dipasang di bagian Siku, Sudut, Lipat, atau Siku Tengah kak. Nanti admin manusia kami akan mengirimkan foto contoh posisinya ya kak... 😊 Letak pemasangan label ini juga bisa disesuaikan dengan keinginan kakak.' },
    { category: 'Label', question: 'apakah bisa beli label atau plastik aja?', answer: 'Maaf belum bisa ya kak. Pembelian label brand atau plastik kemasan di Vuyama wajib disertai dengan pemesanan hijab/produk kami (tidak dijual terpisah tanpa hijab)... 🙏' },
    { category: 'Layanan', question: 'apakah bisa beli hangtag?', answer: 'Bisa banget kak! Untuk hangtag bisa kami bantu buatkan dengan minimal cetak 1 lembar A3. Ukuran hangtag bisa disesuaikan dengan keinginan kakak (yang biasa digunakan di Vuyama adalah ukuran 3x5 CM dan 4x4 CM). Kakak bebas menentukan bentuknya juga loh (misal bentuk love, awan, dll.). Syaratnya desain dari kakak harus dikirim dalam format mentah PNG ya kak, bukan hasil generator AI/ChatGPT... 😊' },
    { category: 'Layanan', question: '1 lembar A3 dapet berapa pcs?', answer: 'Jumlah pcs hangtag yang didapatkan dalam 1 lembar A3 itu bervariasi ya kak, tergantung dari ukuran dan bentuk hangtag yang kakak pilih (biasanya berkisar antara 50 sampai 70 pcs per lembar)... 😊' },
    { category: 'Layanan', question: 'apakah hangtag nya bisa berbentuk love atau awan?', answer: 'Bisa banget kak! Hangtag custom di Vuyama bisa dipotong mengikuti semua bentuk yang kakak inginkan, termasuk bentuk awan, bentuk love, bulat, maupun bentuk custom lainnya... 😊' },
    { category: 'Layanan', question: 'apakah bisa menggunakan design dari customer?', answer: 'Bisa kak! Kakak boleh mengirimkan desain hangtag buatan sendiri. Namun pastikan desainnya berupa desain mentah siap cetak dalam format PNG (bukan desain hasil generator AI/ChatGPT ya kak)... 😊' },
    { category: 'Layanan', question: 'Biaya pasang label dihitung bagaimana?', answer: 'Biaya pemasangan label di Vuyama adalah Rp 1.000 per pc. Biaya pemasangan ini dihitung mengikuti jumlah produk hijab yang kakak pesan saat itu, dan TIDAK harus mengikuti jumlah minimal order label (50 pcs) ya kak... 😊' },
    { category: 'Umum', question: 'kak, kalo mau yang non label bagaimana?', answer: 'Bisa banget kak! Jika kakak menginginkan produk hijab tanpa merk/label (non-label), silakan beri tahu kami ya. Nanti produk akan kami kirimkan polos tanpa terpasang label brand... 😊' },
    { category: 'Layanan', question: 'Dropship manual itu gimana kak?', answer: 'VUYAMA menerima layanan Dropship Manual (tanpa melalui Shopee/TikTok). Caranya sangat mudah kak, kakak tinggal mengirimkan Format Order Dropship Manual ke kami. Kami akan mengirimkan pesanan langsung ke pembeli kakak dengan nama pengirim menggunakan nama toko dan nomor HP kakak sendiri... 😊' },
    { category: 'Format Order', question: 'Format order DROPSHIP Manual', answer: 'Silahkan diisi format order Dropship Manual\nNama: \nAlamat lengkap kec & kab: \nNo HP: \nPesanan: \n\nPengirim\nNama toko:\nNo. Hp:\n\nsertakan apabila menggunakan label,\nNama brand:-\nUkuran label:-\nLabel:-\nWarna label:-\nFont:-\nTata letak:-' },
    { category: 'Layanan', question: 'Kak, Kalau saya dropship dan ingin pakai brand sendiri, apakah harus pesan label terlebih dahulu?', answer: 'Betul sekali kak. Jika kakak ingin dropship menggunakan brand sendiri, kakak harus memesan/memproduksi label brandnya terlebih dahulu di Vuyama. Label tersebut nantinya akan kami simpan di gudang Vuyama untuk dipasang pada setiap produk pesanan dropship kakak... 😊' },
    { category: 'Umum', question: 'Untuk mulai dropship apakah bisa langsung posting dari katalog Vuyama dulu?', answer: 'Bisa banget kak! Kakak dipersilakan langsung memposting produk menggunakan katalog kami. Berikut tautan katalog Google Drive resmi Vuyama untuk kakak unduh: https://drive.google.com/drive/folders/1RwtruDL86PYi3TVqILmxrZgZ_XGT1zPv. Selamat berjualan kak!... 😊' },
    { category: 'Umum', question: 'Apakah boleh kita download, edit dan posting ulang semua katalog vuyama?', answer: 'Boleh banget kak! Mengunduh, mengedit, dan memposting ulang seluruh katalog foto produk Vuyama merupakan salah satu fasilitas resmi yang kami berikan untuk menunjang penjualan para reseller & dropshipper kami... 😊' },
    { category: 'Layanan', question: 'Mekanisme biaya tambahan dropship Rp3.000 bagaimana?', answer: 'Untuk dropshipper baru (yang belum pernah melakukan order minimal 10 pcs di awal), akan dikenakan biaya tambahan jasa dropship sebesar Rp 3.000 per pc produk (diluar biaya pasang label Rp 1.000/pc jika pakai label). Biaya tambahan ini akan dimasukkan langsung ke dalam tagihan invoice saat customer melakukan order. Namun, jika kakak sudah sering belanja/menjadi customer lama (total order \u2265 10 pcs di awal), biaya tambahan dropship Rp 3.000 ini GRATIS ya kak... 😊' },
    { category: 'Layanan', question: 'Berapa modal dropship paris jadul 1 pcs dengan label untuk orderan dropship awal?', answer: 'Untuk dropship awal (baru), estimasi total modalnya adalah Rp 20.700 kak. Rinciannya: Harga Paris Jadul (Rp 16.700) + Biaya Dropship (Rp 3.000) + Biaya Pemasangan Label (Rp 1.000)... 😊' },
    { category: 'Layanan', question: 'Berapa modal dropship paris jadul dengan label untuk customer lama (sudah order lebih dari 10 pcs)?', answer: 'Untuk customer lama yang sudah pernah order minimal 10 pcs, estimasi total modalnya adalah Rp 17.700 kak. Rinciannya: Harga Paris Jadul (Rp 16.700) + Biaya Pemasangan Label (Rp 1.000) (bebas biaya dropship Rp 3.000)... 😊' },
    { category: 'Packaging', question: 'kalau pesan ziplock custom tapi gak 100 pcs, bisa ga?', answer: 'Maaf belum bisa ya kak. Untuk pemesanan ziplock sablon custom, minimal pemesanannya adalah wajib 100 pcs... \ud83d\ude4f' }
  ];
  for (const item of officialFaqs) {
    await db('faq').insert({
      category: item.category,
      question: item.question,
      answer: item.answer
    });
  }

  logger.info('Database seeded successfully from fallback backup JSON!');
  return { success: true, message: 'Database seeded successfully from fallback backup JSON.' };
};

module.exports = {
  syncExcelToDatabase,
  getCompanyInfo,
  getAllProducts,
  getProduct,
  searchProducts,
  getProductsByCategory,
  getServices,
  getResellerProgram,
  getFAQByCategory,
  searchFAQ,
  getFAQCategories,
  retrieveKnowledgeContext,
  findMatchingFaq
};
