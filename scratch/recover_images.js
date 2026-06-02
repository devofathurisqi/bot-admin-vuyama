const fs = require('fs');
const path = require('path');
const db = require('../src/utils/db');

const run = async () => {
  try {
    const imagesDir = path.join(__dirname, '../learn/images');
    if (!fs.existsSync(imagesDir)) {
      console.error(`❌ Folder learn/images tidak ditemukan di: ${imagesDir}`);
      process.exit(1);
    }

    const files = fs.readdirSync(imagesDir);
    console.log(`🔍 Menemukan ${files.length} file di folder learn/images.`);

    const auditLogs = await db('audit_logs')
      .where('action', 'UPDATE_PRODUCT')
      .orderBy('created_at', 'asc');
    
    console.log(`📋 Menemukan ${auditLogs.length} log pembaruan produk di database.`);

    let count = 0;

    for (const file of files) {
      // Pola nama berkas: product-<timestamp>-<rand>.<ext>
      const match = file.match(/^product-(\d+)-/);
      if (!match) continue;

      const fileTimestamp = parseInt(match[1], 10);
      const fileDate = new Date(fileTimestamp);

      // Cari log audit yang cocok dalam rentang ±60 detik
      const matchedLog = auditLogs.find(log => {
        const logDate = new Date(log.created_at);
        return Math.abs(fileDate - logDate) < 60000; // Toleransi 60 detik
      });

      if (matchedLog) {
        // Ekstrak ID produk dari rincian (misal: "Updated product: IN-002")
        const productIdMatch = matchedLog.details.match(/Updated product:\s*(\S+)/);
        if (productIdMatch) {
          const productId = productIdMatch[1].trim();
          const imagePath = `/uploads/${file}`;

          // Ambil produk saat ini untuk penanganan banyak gambar
          const existingProduct = await db('products').where('id', productId).first();
          let finalImagePath = imagePath;
          
          if (existingProduct && existingProduct.image) {
            const paths = existingProduct.image.split(',').map(p => p.trim()).filter(Boolean);
            if (!paths.includes(imagePath)) {
              finalImagePath = [...paths, imagePath].join(', ');
            } else {
              finalImagePath = existingProduct.image;
            }
          }

          // Perbarui kolom image di database
          await db('products').where('id', productId).update({ image: finalImagePath });
          console.log(`✅ Berhasil memulihkan: Product [${productId}] -> ${finalImagePath}`);
          count++;
        }
      }
    }

    console.log(`\n🎉 Proses pemulihan selesai! Berhasil memulihkan ${count} gambar produk.`);
    process.exit(0);
  } catch (err) {
    console.error('❌ Error selama pemulihan:', err);
    process.exit(1);
  }
};

run();
