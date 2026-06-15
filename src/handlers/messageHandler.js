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
 * Check if the message arrives outside business hours (Monday-Saturday, 08:00 - 17:00 WIB)
 */
const checkBusinessHours = async () => {
  try {
    const alwaysReplyRow = await db('company_info').where('key', 'ai_always_reply').first();
    const alwaysReply = alwaysReplyRow ? alwaysReplyRow.value === 'true' : false;
    if (alwaysReply) {
      return true; // AI always replies, so bypass the off-hours check
    }

    const startRow = await db('company_info').where('key', 'business_hours_start').first();
    const endRow = await db('company_info').where('key', 'business_hours_end').first();
    const workdaysRow = await db('company_info').where('key', 'business_workdays').first();

    const startHour = startRow ? parseInt(startRow.value) || 8 : 8;
    const endHour = endRow ? parseInt(endRow.value) || 17 : 17;
    const workdays = workdaysRow ? workdaysRow.value.split(',').map(d => parseInt(d.trim())) : [1, 2, 3, 4, 5, 6];

    const now = new Date();
    const wibString = now.toLocaleString("en-US", { timeZone: "Asia/Jakarta" });
    const wibDate = new Date(wibString);
    const day = wibDate.getDay();
    const hours = wibDate.getHours();

    const isWorkingDay = workdays.includes(day);
    const isWorkingTime = isWorkingDay && (hours >= startHour && hours < endHour);
    return isWorkingTime;
  } catch (error) {
    logger.error('Error checking business hours from database:', error);
    // Fallback to Monday-Saturday 08-17
    const now = new Date();
    const wibString = now.toLocaleString("en-US", { timeZone: "Asia/Jakarta" });
    const wibDate = new Date(wibString);
    const day = wibDate.getDay();
    const hours = wibDate.getHours();
    return day !== 0 && (hours >= 8 && hours < 17);
  }
};

/**
 * Build dynamic system prompt containing the latest database context
 */
const buildDynamicSystemPrompt = async (userMessage = "", phoneNumber = null, memoryAnalysis = null) => {
  try {
    // Prepend 3-day summary to the classifier string to solve coreference context loss
    const classificationText = memoryAnalysis ? `${memoryAnalysis.summary} ${userMessage}` : userMessage;
    
    // Smart RAG selector retrieval (loads unified database context)
    const context = await knowledge.retrieveKnowledgeContext(classificationText, phoneNumber);

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

INFORMASI KHUSUS PENGIRIMAN GAMBAR PRODUK (PENTING):
Every product in the database has images. Proactively send them. Look at KNOWLEDGE BASE.
If multiple paths exist in images array, send ALL of them using multiple tags: \`[SEND_IMAGE: path1] [SEND_IMAGE: path2]\`.

INFORMASI KHUSUS PENGIRIMAN DOKUMEN PDF & PROMO GAMBAR/KONTEN (PENTING):
If catalog, reseller pricing, promos, or other marketing files are asked, you can send them using:
- [SEND_DOCUMENT: filepath] (if PDF)
- [SEND_IMAGE: filepath] (if Image)
Use paths from both \`documents\` and \`media_gallery\` lists in the KNOWLEDGE BASE.
Example: [SEND_DOCUMENT: /pdf/PRICELIST (KHUSUS RESELLER) Update Mei 2026.pdf] or [SEND_DOCUMENT: /media/others/katalog_promo.pdf]

INFORMASI KHUSUS MULTI-VARIAN & TIERED PRICING / GROSIR (PENTING):
Explain variants and tiered pricing if available.

INFORMASI KHUSUS PILIHAN WARNA STOK KAIN / COLOR SWATCH (PENTING):
Match color queries to color_stock_files, stock_colors and product_aliases, and attach \`[SEND_IMAGE: path]\`.

INFORMASI KHUSUS PERTANYAAN PERBANDINGAN BAHAN/PRODUK (MUTLAK PENTING):
1. Keep points short (max 2-3 sentences).
2. Use double enter spacing format.
3. End comparing replies with:
   "Berikut Vumin lampirkan rincian perbandingan dan juga info stok warna terbarunya ya kak... 😊"

KNOWLEDGE BASE VUYAMA (TERRETRIEVE SECARA DINAMIS DARI DATABASE & FILE CADANGAN RESMI):
${JSON.stringify({
      company: context.company,
      products: context.products,
      services: context.services,
      faq: context.faq,
      reseller_program: context.reseller_program,
      documents: context.documents,
      color_stock_files: context.color_stock_files,
      stock_colors: context.stock_colors,
      media_gallery: context.media_gallery,
      product_aliases: context.product_aliases,
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
 * Main function to generate bot response
 */
const generateResponse = async (phoneNumber, userMessage, customerState, imageBuffer = null, imageMime = null) => {
  try {
    // 1. Calculate business hours check and prepend notice if outside hours
    const isWorkingHours = await checkBusinessHours();
    let offHoursNotice = "";
    if (!isWorkingHours) {
      const startRow = await db('company_info').where('key', 'business_hours_start').first();
      const endRow = await db('company_info').where('key', 'business_hours_end').first();
      const startHour = startRow ? startRow.value : '08';
      const endHour = endRow ? endRow.value : '17';
      offHoursNotice = `*(Pesan Otomatis Di Luar Jam Kerja)*\nHalo Kak! Saat ini CS kami sedang di luar jam operasional (Senin - Sabtu, ${startHour}:00 - ${endHour}:00). Kakak tetap bisa bertanya atau mengisi format order, dan asisten AI kami (Vumin) akan membantu menjawab sementara ya kak... 😊 Kami akan memproses dan mem-follow up chat Kakak secara manual setelah jam operasional aktif kembali. Terima kasih atas pengertiannya Kak! 🙏\n\n`;
    }

    // 2. Update/fetch memory
    logger.info(`Updating 3-day time-based memory for customer ${phoneNumber}`);
    const memoryAnalysis = await memory.updateMemory(phoneNumber, userMessage);

    // Short-circuit: if intent is not clear, reply with pre-drafted clarification question
    if (memoryAnalysis && memoryAnalysis.is_intent_clear === false && memoryAnalysis.clarification_question) {
      await logToDb('info', `Customer intent unclear for ${phoneNumber}. Replying with clarification question.`);
      return {
        intent: 'clarification',
        response: offHoursNotice + memoryAnalysis.clarification_question
      };
    }

    // 3. COMPLAINT DETECTION FLOW (Keyword + intent)
    const isComplaint = isComplaintMessage(userMessage) || memoryAnalysis.extracted_intent === 'COMPLAINT';
    if (isComplaint) {
      await logToDb('warn', `Deteksi otomatis Komplain dari ${phoneNumber}: "${userMessage.substring(0, 40)}..."`);
      
      const existingBlock = await db('blocked_numbers').where('phone_number', phoneNumber).first();
      if (!existingBlock) {
        await db('blocked_numbers').insert({
          phone_number: phoneNumber,
          reason: 'Terdeteksi Komplain Otomatis'
        });
      }
      
      await db('customers').where('phone_number', phoneNumber).update({
        status: 'WAITING_HUMAN',
        updated_at: new Date()
      });
      
      emitEvent('new_complaint', {
        phone_number: phoneNumber,
        message: userMessage
      });
      
      const updatedCustomer = await db('customers').where('phone_number', phoneNumber).first();
      emitEvent('customer_updated', updatedCustomer);
      
      return {
        intent: 'complaint',
        response: `Maaf banget atas ketidaknyamanannya ya Kak 🙏 Keluhan Kakak sudah dicatat oleh tim kami. Sebentar ya kak, kami bantu cek detail keluhan Kakak dan segera kami kabari. Mohon ditunggu sebentar ya Kak... 😊`
      };
    }

    // 4. ORDER CONFIRMATION FLOW (Format order filled)
    const isFilledFormat = isFilledOrderFormat(userMessage) || 
      (memoryAnalysis.extracted_intent === 'ORDER_FORMAT' && 
       ['nama', 'alamat', 'pesanan'].every(k => userMessage.toLowerCase().includes(k)));
       
    if (isFilledFormat) {
      await logToDb('info', `Customer ${phoneNumber} mengirimkan format order. Menjalankan AI parser...`);
      const parsed = await parseOrderFormatWithGemini(userMessage);

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
        await logToDb('info', `Mengupdate Order #${orderId} yang ada dengan format yang telah terisi.`);
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
        await logToDb('info', `Membuat Order #${orderId} baru karena tidak ditemukan order PENDING sebelumnya.`);
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

      emitEvent('order_updated', updatedOrder);
      const updatedCustomer = await db('customers').where('phone_number', phoneNumber).first();
      emitEvent('customer_updated', updatedCustomer);

      return {
        intent: 'order_filled',
        response: offHoursNotice + `Terima kasih Kak! 😊 Format ordernya sudah kami terima dan berhasil dicatat dengan status PENDING. Admin kami akan segera mengecek pesanan Kakak untuk menghitung ongkirnya. Mohon tunggu sebentar ya... 🙏`
      };
    }

    const isOrderIntent = isOrderIntentMessage(userMessage) || memoryAnalysis.extracted_intent === 'ORDER_INTENT';
    if (isOrderIntent) {
      await logToDb('info', `Deteksi keinginan order dari ${phoneNumber}. Mengirimkan format order...`);
      
      const customer = await db('customers').where('phone_number', phoneNumber).first();
      const customerName = customer ? customer.name : 'Customer Vuyama';

      const [orderIdObj] = await db('orders').insert({
        phone_number: phoneNumber,
        customer_name: customerName,
        pesanan_raw: 'Format Order Terkirim (Menunggu Pengisian)',
        status: 'PENDING',
        total: 0
      }).returning('id');
      const orderId = orderIdObj ? orderIdObj.id : null;

      await db('customers').where('phone_number', phoneNumber).update({
        status: 'ORDER_PENDING',
        updated_at: new Date()
      });

      emitEvent('new_order', {
        id: orderId,
        phone_number: phoneNumber,
        customer_name: customerName,
        pesanan_raw: 'Format Order Terkirim (Menunggu Pengisian)',
        status: 'PENDING'
      });

      const updatedCustomer = await db('customers').where('phone_number', phoneNumber).first();
      emitEvent('customer_updated', updatedCustomer);

      return {
        intent: 'order_intent',
        response: offHoursNotice + `Silahkan diisi format order VUYAMA\n\nNama :\nAlamat Lengkap :\nNo HP :\nPesanan :\n\napabila ingin membuat label atau sudah ada label, silahkan diisi :\n\nNama Brand :\nUkuran Label :\nBentuk :\nWarna Tinta :\nWarna Label :\nFont :`
      };
    }

    // 5. Normal AI chat flow
    const systemPrompt = await buildDynamicSystemPrompt(userMessage, phoneNumber, memoryAnalysis);
    
    // Add instruction to system prompt if image is supplied
    let activePrompt = systemPrompt;
    if (imageBuffer && imageMime) {
      activePrompt += `\n\n[SISTEM AESTHETICS - ANALISIS GAMBAR]: Pelanggan melampirkan sebuah gambar. Gambar tersebut mungkin berupa bukti transfer pembayaran, swatch/pilihan warna kain, logo brand, atau sampel produk. Harap analisis gambar tersebut dengan cerdas dan hubungkan dengan data katalog Vuyama di atas. Jawab pertanyaan mereka dengan mengaitkan temuan dari gambar tersebut.`;
    }

    const prompt = `${activePrompt}\n\nCustomer: ${userMessage}\n\nAdmin (jangan mulai dengan 'Admin:'):`;

    logger.info(`Calling Gemini AI for customer ${phoneNumber}`);
    const response = await gemini.callGemini(prompt, imageBuffer, imageMime);

    let cleanedResponse = response.trim();
    if (cleanedResponse.startsWith('Admin:')) {
      cleanedResponse = cleanedResponse.substring(6).trim();
    }

    return {
      intent: 'ai_reply',
      response: offHoursNotice + (cleanedResponse || 'Boleh kak, ada yang bisa dibantu? 😊')
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
  parseOrderFormatWithGemini,
  checkBusinessHours
};
