const fs = require('fs');
const path = require('path');
const db = require('../utils/db');
const logger = require('../utils/logger');

const recoverImages = async () => {
  try {
    const imagesDir = path.join(__dirname, '../../learn/images');
    if (!fs.existsSync(imagesDir)) {
      logger.warn(`[Image Recovery] Folder learn/images tidak ditemukan di: ${imagesDir}`);
      return;
    }

    const files = fs.readdirSync(imagesDir);
    logger.info(`[Image Recovery] Menemukan ${files.length} file di folder learn/images.`);
    if (files.length === 0) return;

    // Ambil semua log UPDATE_PRODUCT di database
    const auditLogs = await db('audit_logs')
      .where('action', 'UPDATE_PRODUCT')
      .orderBy('created_at', 'asc');
    
    logger.info(`[Image Recovery] Menemukan ${auditLogs.length} log pembaruan produk di database.`);

    let count = 0;
    const restoredProducts = new Set();

    for (const file of files) {
      // Pola nama berkas: product-<timestamp>-<rand>.<ext>
      const match = file.match(/^product-(\d+)-/);
      if (!match) continue;

      const fileTimestamp = parseInt(match[1], 10);
      const fileDate = new Date(fileTimestamp);

      // Cari log terdekat dengan batas toleransi 12 jam (untuk memastikan pemetaan maksimal)
      let closestLog = null;
      let minDiff = 12 * 60 * 60 * 1000; // 12 jam

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
          logger.info(`[Image Recovery] Matched: Product [${productId}] -> ${finalImagePath} (Time diff: ${(minDiff / 1000).toFixed(1)}s)`);
          restoredProducts.add(productId);
          count++;
        }
      }
    }

    logger.info(`[Image Recovery] Pemulihan selesai! Total gambar dipulihkan: ${count}, Produk unik: [${Array.from(restoredProducts).join(', ')}]`);
  } catch (err) {
    logger.error('[Image Recovery] Gagal selama pemulihan gambar:', err);
  }
};

module.exports = { recoverImages };
