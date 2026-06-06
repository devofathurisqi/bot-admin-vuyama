const fs = require('fs');
const path = require('path');
const knowledge = require('../services/knowledge');
const history = require('../services/history');
const gemini = require('../services/gemini');
const memory = require('../services/memory');
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

  // List of comparative/choice keywords (Strict comparison check)
  const isComparisonQuery = /\b(vs|beda|bedanya|perbedaan|banding|bandingkan|perbandingan|selisih|kelebihan|kekurangan|bagusan mana|mending mana|pilih mana|lebih bagus|lebih laku|lebih laris)\b/i.test(normalized);

  // 1. Paris Japan vs Paris Jadul
  const hasJapan = /japan/i.test(normalized);
  const hasJadul = /(jadul|legend|klasik|basic|ori)/i.test(normalized);
  const hasParis = /paris/i.test(normalized);

  let replyText = null;

  if (
    (hasParis && isComparisonQuery) ||
    (hasJapan && hasJadul) ||
    (hasParis && (hasJapan || hasJadul) && isComparisonQuery)
  ) {
    // If specifically asking which is more popular / sells better
    if (/(laku|laris|populer|banyak|beli|jual)/i.test(normalized)) {
      replyText = `Untuk Vuyama, **Paris Japan** jauh lebih banyak dipilih dan gampang laku kak! Karena bahannya premium, super lembut, tegak di dahi, dan feedback customernya sangat memuaskan... 😊\n\nSedangkan **Paris Jadul** biasanya dipilih untuk market massal karena harganya yang sangat murah & ekonomis.`;
    } else {
      // Default comparison
      replyText = `Ini perbandingan singkat antara Paris Japan dan Paris Jadul ya kak... 😊\n\n- **Paris Japan**: Bahan premium, serat rapat, super lembut, flowy, dan tegak di dahi (nggak kaku).\n- **Paris Jadul**: Bahan standar, serat renggang, tekstur agak kaku khas retro/vintage, sangat ekonomis.`;
    }
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
    !replyText && (
      (hasLabel && isComparisonQuery) ||
      (labelMatchCount >= 2) ||
      ((hasAklik || hasPlat || hasWoven || hasSatin) && hasLabel && isComparisonQuery)
    )
  ) {
    if (/(laku|laris|populer|best|seller|bagusan|mending|pilih)/i.test(normalized)) {
      replyText = `Bahan label paling laris (*best seller*) kami adalah **Akrilik** (kesan mewah mengkilap) and **Woven** (rajutan benang super awet) kak... 😊\n\nSetiap bahan memiliki keunikan masing-masing untuk menaikkan kelas brand hijab kakak.`;
    } else {
      replyText = `Berikut ringkasan singkat 4 bahan label brand best seller kami kak... 😊\n\n- **Akrilik**: Kesan modern & super mewah (efek kaca mengkilap).\n- **Plat Besi/Logam**: Sangat premium, kokoh, memberi kesan eksklusif & mahal.\n- **Woven**: Rajutan benang detail tinggi, awet, & bernuansa klasik.\n- **Satin**: Lembut di kulit, lentur, dan sangat ekonomis.`;
    }
  }

  // 3. Pashmina Bamboo vs Pashmina Airtech
  const hasBamboo = /bamboo/i.test(normalized);
  const hasAirtech = /airtech/i.test(normalized);
  const hasPashmina = /pashmina/i.test(normalized);

  if (
    !replyText && (
      (hasPashmina && isComparisonQuery) ||
      (hasBamboo && hasAirtech) ||
      (hasPashmina && (hasBamboo || hasAirtech) && isComparisonQuery)
    )
  ) {
    if (/(laku|laris|populer|bagusan|mending|pilih)/i.test(normalized)) {
      replyText = `Kedua pashmina ini sangat laris dengan keunggulannya masing-masing kak... 😊\n\n- Pilih **Bamboo Spandex** jika mencari kenyamanan ekstra (sangat adem & ada *cooling effect* serat bambu alami).\n- Pilih **Airtech Ultrasoft** jika mencari pashmina yang sangat ringan, mudah menyerap keringat (*quick-dry*), dan pas untuk luar ruangan.`;
    } else {
      replyText = `Perbedaan singkat Pashmina Bamboo vs Pashmina Airtech kak... 😊\n\n- **Pashmina Bamboo**: Serat bambu alami, super lembut, adem dingin (*cooling effect*), & jatuh banget.\n- **Pashmina Airtech**: Sangat ringan, ada sirkulasi udara mikro (*micro-ventilation*), menyerap keringat, & *quick-dry*.`;
    }
  }

  if (replyText) {
    return `[COMPARISON_SHEET]${replyText}\n\nkami akan cari data perbandingan kami (gambar / pdf), jika ada kami akan kirim ke kakak. jika tidak ada tidak akan kami follow up tapi kaka boleh kok tanya tanya lagi hehe`;
  }

  return null;
};




/**
 * Build dynamic system prompt containing the latest database context
 */
const buildDynamicSystemPrompt = async (userMessage = "", phoneNumber = null, memoryAnalysis = null) => {
  try {
    // If we have memory context, prepend the 3-day summary to the classifier string to solve coreference context loss
    const classificationText = memoryAnalysis ? `${memoryAnalysis.summary} ${userMessage}` : userMessage;
    
    // Smart RAG selector retrieval with context awareness
    const context = await knowledge.retrieveKnowledgeContext(classificationText, phoneNumber);

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

INFORMASI PERCAKAPAN SAAT INI (Konteks Ringkasan dari ChatGPT):
- Ringkasan percakapan 3 hari terakhir: ${memoryAnalysis ? memoryAnalysis.summary : 'Belum ada obrolan sebelumnya.'}
- Intent/Niat terdeteksi saat ini: ${memoryAnalysis ? memoryAnalysis.extracted_intent : 'OTHER'}
- Status Alur Percakapan: ${memoryAnalysis ? memoryAnalysis.conversation_state : 'idle'}

ATURAN MUTLAK & DISIPLIN DATA KETAT (PENTING - DILARANG KERAS BERIMPROVISASI ATAU MENGARANG):
1. **DILARANG KERAS MENGARANG PRODUK**: Kamu HANYA boleh merekomendasikan atau menyebutkan nama produk yang benar-benar tercantum di dalam daftar "products" atau "pdf_pricelist_official" di bagian KNOWLEDGE BASE di bawah. Jika customer bertanya tentang produk, jenis, bahan, atau nama barang yang tidak ada di data kita, kamu HARUS menjawab dengan sopan bahwa produk tersebut sedang kosong/belum tersedia, atau minta mereka menunggu admin manusia mengecek ke bagian gudang. JANGAN PERNAH menyebutkan nama barang khayalan!
2. **DILARANG KERAS MENGARANG HARGA DAN ATURAN GROSIR**: Semua harga retail (price_retail), harga reseller (price_reseller), varian harga per ukuran (sizes), dan diskon grosir berjenjang (wholesale_tiers) HARUS 100% akurat sesuai angka yang ada di database atau "pdf_pricelist_official". Jangan pernah memotong harga secara mandiri, mengarang diskon khayalan, atau mengasumsikan biaya kirim (ongkir) tanpa data resmi.
3. **DILARANG KERAS MENGARANG DETAIL SPESIFIKASI**: Deskripsi bahan, warna, berat, and status ketersediaan barang wajib merujuk secara ketat pada data produk terkait. Jika tidak tertulis di data, jangan berasumsi atau menebak-nebak secara acak. Katakan dengan jujur atau minta mereka menunggu konfirmasi admin.
4. **PRIORITAS DATA KATALOG DAN HARGA RESELLER TERBARU (MUTLAK)**: Jika terdapat perbedaan harga, paket reseller, minimal pembelian, atau varian produk antara data tabel database ("products"/"reseller_program") dengan data di dalam "pdf_pricelist_official" di KNOWLEDGE BASE di bawah, kamu WAJIB memprioritaskan dan menggunakan data yang ada di "pdf_pricelist_official" (karena itu adalah backup wawasan resmi paling terbaru dari PDF Price List Update April/Mei 2026)!
5. **PEMICU DOKUMEN KOMPARASI PDF (MUTLAK PENTING)**: Jika customer secara eksplisit meminta perbandingan produk/bahan (seperti "paris japan vs jadul bagusan mana ya", "apa bedanya akrilik sama woven", dsb.), kamu WAJIB menyertakan tag khusus \`[COMPARISON_SHEET]\` di awal atau di akhir balasanmu agar sistem kita otomatis mencetak PDF A4 perbandingan resmi. Jika customer hanya bertanya hal umum, jangan sertakan tag tersebut!
6. **PEMICU INVOICE DRAFT PDF (MUTLAK PENTING)**: Jika customer sepakat untuk melakukan pembelian, setuju dengan rincian pesanan, atau menanyakan total tagihan/invoice untuk ditransfer, sertakan tag \`[INVOICE_SHEET]\` di bagian akhir balasanmu agar sistem kita mencetak PDF invoice ringkasan tagihan secara otomatis.
7. **PEMICU DOKUMEN WELCOME RESELLER (MUTLAK PENTING)**: Jika customer setuju bergabung, bertanya rincian panduan, atau menanyakan SOP untuk program reseller dengan tingkatan tertentu (seperti Silver, Gold, Legend, Sultan), sertakan tag \`[WELCOME_GUIDE: Level]\` (contoh: \`[WELCOME_GUIDE: Silver]\`, \`[WELCOME_GUIDE: Sultan]\`) di akhir balasanmu agar sistem kita otomatis mencetak PDF guide selamat datang yang sesuai.

ATURAN KHUSUS OPERASIONAL BISNIS VUYAMA (MUTLAK Wajib Dipatuhi):
- **Ecer**: Pembelian ecer (satuan) hanya bisa dilakukan dengan checkout via toko resmi Shopee Vuyama di: https://shopee.co.id/vuyama.
- **Paket Reseller Mix Model**: Paket reseller BISA mix/campur model hijab sesuka hati customer (di data pricelist hanya contoh kombinasi standar saja).
- **Tanya Stok/Sisa Label Pribadi**: Jika customer menanyakan sisa stok label mereka (e.g. "label aku sisa berapa ya?"), jawab secara sopan bahwa hal tersebut akan dicek terlebih dahulu secara manual di gudang oleh admin manusia. Bot tidak boleh menebak jumlah sisa label!
- **Pemasangan Label**: Posisi pasang label bisa di Siku, Sudut, Lipat, atau Siku Tengah. Jika ditanya letaknya, sebutkan pilihan-pilihan posisi ini dengan ramah.
- **Beli Label/Plastik Saja**: Tidak boleh membeli label atau plastik saja tanpa membeli produk hijab Vuyama. Pembelian label/kemasan wajib disertai produk hijab.
- **Hangtag Custom**: Hangtag bisa dibantu cetakkan dengan minimal pemesanan 1 lembar A3 (isi sekitar 50-70 pcs tergantung bentuk & ukuran). Bentuk hangtag bebas (bisa awan, love, dll.). Ukuran standar Vuyama adalah 3x5 CM dan 4x4 CM namun ukuran bebas disesuaikan keinginan customer. Desain wajib format PNG mentah dari customer (dilarang desain hasil AI/ChatGPT).
- **Biaya Pasang Label**: Biaya pasang label adalah Rp 1.000 per pc. Biaya pasang ini dihitung per pc hijab yang dibeli saat order tersebut, BUKAN mengikuti jumlah minimal order label (50 pcs).
- **Non-Label**: Boleh order polos/tanpa label. Hijab akan dikirimkan polos tanpa terpasang label brand.
- **Dropship Manual (Tanpa Marketplace)**:
  - Vuyama menerima dropship manual. Dropshipper mengisi Format Order Dropship Manual. Pengirim akan dicantumkan atas nama nama toko & nomor HP dropshipper sendiri.
  - Format order Dropship Manual wajib diberikan persis seperti ini:
    Silahkan diisi format order Dropship Manual
    Nama: 
    Alamat lengkap kec & kab: 
    No HP: 
    Pesanan: 

    Pengirim
    Nama toko:
    No. Hp:

    sertakan apabila menggunakan label:
    Nama brand:-
    Ukuran label:-
    Label:- 
    Warna label:-
    Font:-
    Tata letak:-
  - Jika dropship ingin pakai brand sendiri, wajib memesan label brand terlebih dahulu di Vuyama dan label tersebut akan disimpan di gudang Vuyama.
- **Katalog Vuyama**: Dropshipper baru diperbolehkan memposting produk menggunakan katalog resmi Vuyama terlebih dahulu. Berikut link Google Drive katalog resmi Vuyama: https://drive.google.com/drive/folders/1RwtruDL86PYi3TVqILmxrZgZ_XGT1zPv. Mengunduh, mengedit, dan memposting ulang katalog merupakan fasilitas resmi reseller Vuyama.
- **Skema Biaya Tambahan Dropship (Rp 3.000/pc)**:
  - Dropshipper baru (belum pernah belanja minimal 10 pcs di awal) dikenakan biaya tambahan jasa dropship Rp 3.000/pc produk (di luar biaya pasang label Rp 1.000/pc). Biaya ini dibayar saat customer order (masuk tagihan).
  - Dropshipper lama (sudah pernah belanja total >= 10 pcs di awal) BEBAS biaya tambahan dropship Rp 3.000/pc ini (gratis, hanya bayar harga produk + Rp 1.000 pasang label jika pakai label).
  - *Contoh Perhitungan Kasus A (Dropshipper Baru)*: Pesan 1 pc Paris Jadul + Pasang Label ➔ Paris Jadul (16.700) + Biaya Dropship (3.000) + Pasang Label (1.000) = Rp 20.700.
  - *Contoh Perhitungan Kasus B (Customer Lama/Belanja > 10 pcs)*: Pesan 1 pc Paris Jadul + Pasang Label ➔ Paris Jadul (16.700) + Pasang Label (1.000) = Rp 17.700.
- **Ziplock Sablon Custom**: Wajib minimal order 100 pcs. Tidak bisa di bawah 100 pcs.

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
9. **MEMAHAMI BAHASA & DIALEK APUPUN (CONTEXT-AWARE)**: Pelanggan dapat bertanya menggunakan bahasa atau dialek apa saja (Bahasa Indonesia gaul/slang, Jawa, Sunda, Inggris, dll.). Kamu wajib mengerti maksud dan konteks mereka secara cerdas. Jika mereka meminta pilihan warna, stok kain harian, atau spill warna produk tertentu (seperti "spill warna", "minta foto warna", "ready warna apa", "ada warna apa saja", "what colors do you have", dll.) dalam bahasa/gaya penulisan apa pun, kamu harus langsung mengenali konteks produk yang dimaksud, menjelaskan status stok warnanya secara ramah, dan wajib melampirkan tag \`[SEND_IMAGE: <path_gambar>]\` yang sesuai di bagian akhir pesan.
10. **KERAPIAN SPASI & FORMAT CHAT DI LAPTOP & HP (MUTLAK Wajib Dipatuhi - PENTING):**
    - Chat yang Anda hasilkan harus 100% rapi dan tertata dengan sangat indah saat dibaca baik di layar Laptop/Komputer maupun layar Handphone (HP) pelanggan!
    - **SPASI KATA & TANDA BACA:** JANGAN PERNAH menulis kata-kata yang saling berdempetan tanpa spasi. Selalu berikan spasi satu ketukan yang jelas setelah tanda titik (.), koma (,), titik dua (:), titik koma (;), dan tanda tanya (?). Contoh kesalahan: "beda banget:1. Paris" (SALAH!) ➔ harusnya "beda banget: \n\n1. Paris" atau "beda banget: 1. Paris" (BENAR!).
    - **PARAGRAF & JEDA BARIS BARU (DOUBLE ENTER) UNTUK DAFTAR POIN:** Setiap kali Anda membuat poin atau daftar penjelasan (seperti membahas 1. Paris Japan, 2. Paris Jadul, dsb.), Anda **WAJIB memberikan jeda dua baris baru (double enter / \`\\n\\n\`)** di antara poin-poin tersebut. JANGAN PERNAH menumpuk penjelasan list menjadi satu paragraf rapat yang tersambung terus-menerus tanpa enter. Tuliskan nama poin di baris tersendiri, lalu penjelasannya di baris baru di bawahnya agar tidak berantakan di layar HP pelanggan yang lebih kecil!
    - **CONTOH STRUKTUR CHAT YANG SANGAT RAPI DI LAPTOP MAUPUN HP:**
      "Ini bedanya Paris Japan sama Paris Jadul ya kak... 😊
      
      1. **Paris Japan**
      - Bahannya poliester premium kak, seratnya lebih halus and rapat.
      - Teksturnya lembut, jatuh, dan nggak kaku.
      
      2. **Paris Jadul**
      - Bahannya poliester biasa, seratnya agak kasar dan doft.
      - Teksturnya agak kaku dan berpasir..."

INFORMASI KHUSUS PENGIRIMAN GAMBAR PRODUK (PENTING):
Every product in the database has images. Proactively send them. Look at KNOWLEDGE BASE.
If multiple paths exist in images array, send ALL of them using multiple tags: \`[SEND_IMAGE: path1] [SEND_IMAGE: path2]\`.

INFORMASI KHUSUS PENGIRIMAN DOKUMEN PDF (PENTING):
If catalog, reseller pricing or wide catalog lists are asked, attach a catalog PDF.
Use paths from \`documents\` list in knowledge base.
Example: [SEND_DOCUMENT: /pdf/PRICELIST (KHUSUS RESELLER) Update Mei 2026.pdf]

INFORMASI KHUSUS MULTI-VARIAN & TIERED PRICING / GROSIR (PENTING):
Explain variants and tiered pricing if available.

INFORMASI KHUSUS PILIHAN WARNA STOK KAIN / COLOR SWATCH (PENTING):
Match color queries to color_stock_files and attach \`[SEND_IMAGE: path]\`.

INFORMASI KHUSUS PERTANYAAN PERBANDINGAN BAHAN/PRODUK (MUTLAK PENTING):
1. Keep points short (max 2-3 sentences).
2. Use double enter spacing format.
3. End comparing replies with:
   "kami akan cari data perbandingan kami (gambar / pdf), jika ada kami akan kirim ke kakak. jika tidak ada tidak akan kami follow up tapi kaka boleh kok tanya tanya lagi hehe"

KNOWLEDGE BASE VUYAMA (TERRETRIEVE SECARA DINAMIS DARI DATABASE & FILE CADANGAN RESMI):
${JSON.stringify({
      company: context.company,
      products: context.products,
      services: context.services,
      faq: context.faq,
      reseller_program: context.reseller_program,
      documents: context.documents,
      color_stock_files: context.color_stock_files,
      pdf_pricelist_official: pdfPricelistOfficial
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
    'kembalikan uang', 'salah kirim', 'cacat', 'rusak', 'pecah',
    'robek', 'bolong', 'kotor', 'kurang'
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
 * Context string builder from customer message history (restricted to last 3 days)
 */
const buildContextString = async (phoneNumber) => {
  const chatHistory = await history.getConversationsWithinDays(phoneNumber, 3);
  if (chatHistory.length === 0) return '';

  let contextStr = '\nRiwayat chat terakhir (3 hari terakhir):\n';
  chatHistory.forEach(msg => {
    const sender = msg.sender === 'customer' ? 'Customer' : msg.sender === 'agent' ? 'Admin' : 'Bot';
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

    // 0.3 RETAIL/ECER BYPASS (Zero-Call)
    const isRetailQuery = (msgText) => {
      const normalized = msgText.toLowerCase();
      return normalized.includes('ecer') || normalized.includes('satuan') || normalized.includes('retail') || /\b(1\s*(pcs|pc|buah|biji))\b/.test(normalized);
    };

    if (isRetailQuery(userMessage)) {
      await logToDb('info', `Deteksi otomatis Pertanyaan Ecer/Satuan dari ${phoneNumber} (Bypass ke Shopee).`);
      return {
        intent: 'retail_shopee',
        response: 'Untuk pembelian ecer (satuan), silakan langsung checkout melalui toko resmi Shopee Vuyama ya kak... 😊 Berikut link toko Shopee kami: https://shopee.co.id/vuyama'
      };
    }

    // 0.5 LOCAL FAQ SIMILARITY MATCHING (Zero-Call RAG / Smart TF-IDF ML Engine)
    const matchedFaq = await knowledge.findMatchingFaq(userMessage);
    if (matchedFaq) {
      await logToDb('info', `Pencocokan Lokal Sukses (Skor: ${matchedFaq.score.toFixed(2)}) untuk "${userMessage.substring(0, 30)}..." -> Bypass Gemini.`);
      return {
        intent: 'faq_match',
        response: matchedFaq.answer
      };
    }

    // 1. UPDATE/FETCH CONVERSATION MEMORY (Event-driven background gatekeeper)
    logger.info(`Updating 3-day time-based memory for customer ${phoneNumber}`);
    const memoryAnalysis = await memory.updateMemory(phoneNumber, userMessage);

    // 2. COMPLAINT DETECTION FLOW (Hybrid: Keyword + ChatGPT/Gemini extracted intent)
    const isComplaint = isComplaintMessage(userMessage) || memoryAnalysis.extracted_intent === 'COMPLAINT';
    if (isComplaint) {
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

    // 3. ORDER CONFIRMATION FLOW (Hybrid: Format or ChatGPT Intent)
    const isFilledFormat = isFilledOrderFormat(userMessage) || 
      (memoryAnalysis.extracted_intent === 'ORDER_FORMAT' && 
       ['nama', 'alamat', 'pesanan'].every(k => userMessage.toLowerCase().includes(k)));
    if (isFilledFormat) {
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

    const isOrderIntent = isOrderIntentMessage(userMessage) || memoryAnalysis.extracted_intent === 'ORDER_INTENT';
    if (isOrderIntent) {
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

    // 4. CHECK INTENT CLARITY (Clarification Gatekeeper - runs only if not order or complaint)
    if (!memoryAnalysis.is_intent_clear) {
      await logToDb('info', `Customer ${phoneNumber} intent unclear. Asking clarifying question...`);
      return {
        intent: 'clarification',
        response: memoryAnalysis.clarification_question
      };
    }

    // 5. NORMAL AI CHAT FLOW (USING DYNAMIC KNOWLEDGE AND DYNAMIC SYSTEM PROMPT)
    const contextStr = await buildContextString(phoneNumber);
    const systemPrompt = await buildDynamicSystemPrompt(userMessage, phoneNumber, memoryAnalysis);
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
