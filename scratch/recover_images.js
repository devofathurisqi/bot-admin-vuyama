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

    // Ambil semua log UPDATE_PRODUCT sejak jam 7 pagi hari ini (00:00:00 UTC)
    const auditLogs = await db('audit_logs')
      .where('action', 'UPDATE_PRODUCT')
      .andWhere('created_at', '>=', '2026-06-02T00:00:00.000Z')
      .orderBy('created_at', 'asc');
    
    console.log(`📋 Menemukan ${auditLogs.length} log pembaruan produk sejak jam 7 pagi hari ini.`);

    let count = 0;
    const restoredProducts = new Set();

    for (const file of files) {
      // Pola nama berkas: product-<timestamp>-<rand>.<ext>
      const match = file.match(/^product-(\d+)-/);
      if (!match) continue;

      const fileTimestamp = parseInt(match[1], 10);
      const fileDate = new Date(fileTimestamp);

      // Cari log terdekat dalam batas toleransi 15 menit (900.000 ms)
      let closestLog = null;
      let minDiff = 900000; // 15 menit

      auditLogs.forEach(log => {
        const logDate = new Date(log.created_at);
        const diff = Math.abs(fileDate - logDate);
        if (diff < minDiff) {
          minDiff = diff;
          closestLog = log;
        }
      });

      if (closestLog) {
        // Ekstrak ID produk dari rincian (misal: "Updated product: IN-002")
        const productIdMatch = closestLog.details.match(/Updated product:\s*(\S+)/);
        if (productIdMatch) {
          const productId = productIdMatch[1].trim();
          const imagePath = `/uploads/${file}`;

          // Ambil data produk saat ini
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

          // Perbarui di database
          await db('products').where('id', productId).update({ image: finalImagePath });
          console.log(`✅ Berhasil mencocokkan: Product [${productId}] -> ${finalImagePath} (Selisih waktu: ${(minDiff / 1000).toFixed(1)} detik)`);
          restoredProducts.add(productId);
          count++;
        }
      }
    }

    console.log(`\n🎉 Pemulihan selesai!`);
    console.log(`- Total gambar dipulihkan: ${count}`);
    console.log(`- Jumlah produk unik berhasil dipulihkan: ${restoredProducts.size}`);
    console.log(`- ID Produk terpulih: [${Array.from(restoredProducts).join(', ')}]`);
    process.exit(0);
  } catch (err) {
    console.error('❌ Error selama pemulihan:', err);
    process.exit(1);
  }
};

run();
