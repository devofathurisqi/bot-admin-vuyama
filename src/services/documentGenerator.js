const fs = require('fs');
const path = require('path');
const gemini = require('./gemini');
const logger = require('../utils/logger');
const db = require('../utils/db');

/**
 * Generate a PDF document using Puppeteer and cache it on disk
 * @param {object} browser - Puppeteer browser instance
 * @param {string} slug - Unique identifier for caching
 * @param {string} htmlContent - Raw HTML code to render
 * @returns {Promise<string>} - Absolute path to generated PDF
 */
const renderHtmlToPdf = async (browser, slug, htmlContent) => {
  const filename = `${slug}.pdf`;
  const outputPath = path.join(__dirname, '../../data/pdf', filename);

  // Ensure directories exist
  const dir = path.dirname(outputPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  // If already generated, return the path (caching)
  if (fs.existsSync(outputPath)) {
    logger.info(`[PDF CS Vuyama] Retreiving cached document from ${outputPath}`);
    return outputPath;
  }

  if (!browser) {
    throw new Error('Puppeteer browser instance is not active');
  }

  const page = await browser.newPage();
  try {
    await page.setContent(htmlContent, { waitUntil: 'networkidle0' });
    
    // Font loading guard: wait for web fonts to load before printing PDF
    await page.evaluateHandle(() => document.fonts.ready);
    
    await page.pdf({
      path: outputPath,
      format: 'A4',
      printBackground: true,
      margin: { top: '20mm', bottom: '20mm', left: '20mm', right: '20mm' }
    });
    logger.info(`[PDF CS Vuyama] Generated and cached PDF: ${outputPath}`);
    return outputPath;
  } finally {
    await page.close();
  }
};

/**
 * Generate a beautiful product comparison sheet PDF using Gemini HTML layout
 */
const generateComparisonPdf = async (browser, slug, comparisonData) => {
  const prompt = `You are a master document writer and premium graphic designer for Vuyama (premium brand of hijab and brand labels). 
Vuyama is famous for its hyper-minimalist, pristine, and elegant aesthetic: a simple centered logo "V" on a solid white background, neat lines, and high-end typography.

Convert this product comparison data into an outstanding, professional A4 HTML comparison sheet:
"""
${comparisonData}
"""

HTML & CSS Styling Rules (Strict):
- Entire document background must be solid white (#ffffff).
- Font family: Use high-end typography. Import "Inter" (sans-serif) and "Playfair Display" (serif) from Google Fonts. Use Playfair Display for headers and Inter for table content.
- Margins & Spacing: The page must have precise padding (e.g. 40px) and generous margins to fit perfectly on a single A4 page with clean white space.
- Header:
  * A beautifully designed centered capital letter "V" (very large, elegant serif font, size 64px, color #0f172a).
  * A thin letter-spaced sub-header below the logo: "V U Y A M A   O F F I C I A L   C S" (size 12px, letter-spacing 6px, color #64748b).
  * A delicate thin divider line below the header (#e2e8f0).
- Comparison Table:
  * Width must be 100% with border-collapse.
  * Table headers (th): Background must be an ultra-soft slate (#f8fafc), text color #0f172a, bold uppercase, clean letter-spacing, cell padding 14px 18px.
  * Table borders: Very clean, thin borders (#e2e8f0).
  * Table body cells (td): Clean readable font, padding 14px 18px, alternating row colors (white and #f8fafc) for maximum legibility.
- Summary / Footer:
  * Below the table, include a modern, clean highlight card with a left-accent border: "border-left: 3px solid #0f172a; padding: 12px 20px; background-color: #f8fafc; margin-top: 30px; font-style: italic; color: #475569;" containing a clean 1-2 sentence final recommendation or styling tip.
  * A subtle, centered footer at the bottom of the page: "Vuyama Official - Premium Hijab & Brand Label Production" (size 10px, color #94a3b8).
- Do NOT output any markdown fences like \`\`\`html. Return the raw HTML code starting with <!DOCTYPE html>.`;

  logger.info(`[PDF CS Vuyama] Prompting Gemini for product comparison sheet design...`);
  const htmlRaw = await gemini.callGemini(prompt);
  let cleanHtml = htmlRaw.trim();
  if (cleanHtml.startsWith('```html')) cleanHtml = cleanHtml.replace(/^```html/, '');
  if (cleanHtml.startsWith('```')) cleanHtml = cleanHtml.replace(/^```/, '');
  if (cleanHtml.endsWith('```')) cleanHtml = cleanHtml.replace(/```$/, '');
  cleanHtml = cleanHtml.trim();

  return await renderHtmlToPdf(browser, `perbandingan_${slug}`, cleanHtml);
};

/**
 * Generate a premium order invoice summary PDF
 */
const generateInvoicePdf = async (browser, orderId) => {
  const order = await db('orders').where('id', orderId).first();
  if (!order) {
    throw new Error(`Order ID ${orderId} not found`);
  }

  // Fetch bank details from company_info dynamically
  const paymentMethod = await db('company_info').where('key', 'metode_pembayaran').first();
  const paymentInstructions = paymentMethod ? paymentMethod.value : 'Silakan lakukan pembayaran transfer ke rekening resmi Vuyama.';

  // Format currency
  const formatRupiah = (val) => {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(val);
  };

  // Fetch relational order items
  const items = await db('order_items').where('order_id', orderId).orderBy('id', 'asc');
  
  let itemsHtml = '';
  if (items.length > 0) {
    items.forEach(item => {
      const specs = typeof item.custom_specs === 'string' ? JSON.parse(item.custom_specs) : (item.custom_specs || {});
      let specDetails = '';
      if (Object.keys(specs).length > 0 && specs.brand_name) {
        specDetails = `
          <div style="font-size: 11px; color: #64748b; margin-top: 4px; line-height: 1.4;">
            • Brand: ${specs.brand_name || '-'}<br>
            • Size: ${specs.label_size || '-'}<br>
            • Shape: ${specs.label_shape || '-'}<br>
            • Ink/Label Color: ${specs.ink_color || '-'}/${specs.label_color || '-'}<br>
            • Font: ${specs.font || '-'}
          </div>
        `;
      }
      
      itemsHtml += `
        <tr>
          <td>
            <div style="font-weight: 600;">${item.product_name}</div>
            ${specDetails}
          </td>
          <td style="text-align: center; vertical-align: top;">${item.quantity}</td>
          <td style="text-align: right; vertical-align: top;">${formatRupiah(item.price)}</td>
          <td style="text-align: right; font-weight: 600; vertical-align: top;">${formatRupiah(item.subtotal)}</td>
        </tr>
      `;
    });
  } else {
    // Fallback: render draft raw specifications if order items are empty
    itemsHtml = `
      <tr>
        <td>
          <div style="font-weight: 600;">Pemesanan Custom Draft</div>
          <div style="font-size: 12px; color: #475569; white-space: pre-wrap; margin-top: 5px;">${order.pesanan_raw}</div>
        </td>
        <td style="text-align: center; vertical-align: top;">1</td>
        <td style="text-align: right; vertical-align: top;">${formatRupiah(order.total)}</td>
        <td style="text-align: right; font-weight: 600; vertical-align: top;">${formatRupiah(order.total)}</td>
      </tr>
    `;
  }

  const htmlContent = `
<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <title>Vuyama Invoice #${order.id}</title>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;600;700&family=Playfair+Display:ital,wght@0,600;1,400&display=swap" rel="stylesheet">
  <style>
    body {
      font-family: 'Inter', sans-serif;
      margin: 0;
      padding: 0;
      color: #1e293b;
      background-color: #ffffff;
      -webkit-print-color-adjust: exact;
    }
    .invoice-container {
      max-width: 800px;
      margin: 0 auto;
      padding: 40px;
    }
    .header {
      text-align: center;
      margin-bottom: 40px;
    }
    .logo {
      font-family: 'Playfair Display', serif;
      font-size: 56px;
      font-weight: 600;
      color: #0f172a;
      margin: 0;
      line-height: 1;
    }
    .sub-logo {
      font-size: 10px;
      letter-spacing: 5px;
      color: #64748b;
      text-transform: uppercase;
      margin-top: 5px;
    }
    .divider {
      height: 1px;
      background-color: #e2e8f0;
      margin: 20px 0;
    }
    .title {
      font-family: 'Playfair Display', serif;
      font-size: 24px;
      font-style: italic;
      color: #0f172a;
      margin-bottom: 25px;
    }
    .info-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 40px;
      margin-bottom: 40px;
    }
    .info-block h3 {
      font-size: 12px;
      text-transform: uppercase;
      color: #64748b;
      margin: 0 0 8px 0;
      letter-spacing: 1px;
    }
    .info-block p {
      font-size: 14px;
      margin: 0 0 5px 0;
      line-height: 1.5;
    }
    .order-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 40px;
    }
    .order-table th {
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 1px;
      text-align: left;
      background-color: #f8fafc;
      color: #64748b;
      padding: 12px 16px;
      border-bottom: 1px solid #e2e8f0;
    }
    .order-table td {
      padding: 16px;
      font-size: 14px;
      border-bottom: 1px solid #f1f5f9;
      line-height: 1.6;
    }
    .total-block {
      float: right;
      width: 250px;
      margin-bottom: 40px;
    }
    .total-row {
      display: flex;
      justify-content: space-between;
      padding: 8px 0;
      font-size: 14px;
    }
    .total-row.grand-total {
      font-weight: 700;
      font-size: 18px;
      color: #0f172a;
      border-top: 1px solid #e2e8f0;
      padding-top: 12px;
      margin-top: 8px;
    }
    .payment-instructions {
      clear: both;
      background-color: #f8fafc;
      border-left: 3px solid #0f172a;
      padding: 20px;
      margin-top: 40px;
      font-size: 13px;
      line-height: 1.6;
    }
    .payment-instructions h4 {
      margin: 0 0 8px 0;
      color: #0f172a;
      font-size: 14px;
    }
    .footer {
      text-align: center;
      margin-top: 60px;
      font-size: 10px;
      color: #94a3b8;
    }
  </style>
</head>
<body>
  <div class="invoice-container">
    <div class="header">
      <div class="logo">V</div>
      <div class="sub-logo">Vuyama Official Invoice</div>
    </div>
    
    <div class="divider"></div>
    
    <div class="title">Ringkasan Invoice Pesanan</div>
    
    <div class="info-grid">
      <div class="info-block">
        <h3>Kepada Yth.</h3>
        <p><strong>${order.customer_name || 'Pelanggan Vuyama'}</strong></p>
        <p>Telp: ${order.phone || order.phone_number.split('@')[0]}</p>
        <p>Alamat: ${order.address || '-'}</p>
      </div>
      <div class="info-block" style="text-align: right;">
        <h3>No. Invoice</h3>
        <p><strong>#INV-${order.id}</strong></p>
        <h3>Tanggal Pemesanan</h3>
        <p>${new Date(order.created_at).toLocaleDateString('id-ID', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
        <h3>Status Pembayaran</h3>
        <p><strong>${order.status === 'PAID' || order.status === 'COMPLETED' ? 'Lunas' : 'PENDING'}</strong></p>
      </div>
    </div>
    
    <table class="order-table">
      <thead>
        <tr>
          <th>Produk & Keterangan</th>
          <th style="text-align: center; width: 80px;">Qty</th>
          <th style="text-align: right; width: 120px;">Harga Satuan</th>
          <th style="text-align: right; width: 120px;">Subtotal</th>
        </tr>
      </thead>
      <tbody>
        ${itemsHtml}
      </tbody>
    </table>
    
    <div class="total-block">
      <div class="total-row">
        <span>Subtotal</span>
        <span>${formatRupiah(order.total || 0)}</span>
      </div>
      <div class="total-row">
        <span>Ongkos Kirim</span>
        <span>Akan dikonfirmasi Admin</span>
      </div>
      <div class="total-row grand-total">
        <span>Total Akhir</span>
        <span>${formatRupiah(order.total || 0)}</span>
      </div>
    </div>
    
    <div class="payment-instructions">
      <h4>Petunjuk Pembayaran Transfer Bank:</h4>
      ${paymentInstructions.replace(/\n/g, '<br>')}
      <br><br>
      <em>Harap kirimkan bukti transfer ke WhatsApp ini setelah melakukan pembayaran untuk proses pengemasan dan pengiriman segera. Terima kasih kak!</em>
    </div>
    
    <div class="footer">
      Vuyama - Produsen Hijab & Brand Label Premium Indonesia
    </div>
  </div>
</body>
</html>
  `;

  return await renderHtmlToPdf(browser, `invoice_${orderId}`, htmlContent);
};

/**
 * Generate a reseller guide PDF dynamically using Excel RAG and customer profile
 */
const generateWelcomeGuidePdf = async (browser, phoneNumber, resellerLevel) => {
  const programRows = await db('reseller_program').whereILike('level', `%${resellerLevel}%`).first();
  const benefitsText = programRows ? programRows.benefits : 'Fasilitas dan katalog dropship lengkap.';
  const minOrderText = programRows ? programRows.min_order : 'Sesuai ketentuan level.';

  // Fetch company info from database dynamically
  const companyRows = await db('company_info').select('key', 'value');
  const companyInfo = {};
  companyRows.forEach(row => {
    companyInfo[row.key] = row.value;
  });
  const companyInfoString = JSON.stringify(companyInfo, null, 2);

  const prompt = `You are a professional designer for Vuyama. Create a premium A4 Reseller Welcome Guide HTML document.
The customer has joined at the **${resellerLevel}** level.
Minimal Order required: ${minOrderText}
Reseller Benefits & Facilities:
${benefitsText}

Company Contact & Context Information:
${companyInfoString}

SOP & Policies to incorporate beautifully:
1. **Dropship Policy**: Explain how dropshipping works (custom label storage in our warehouse, shipping under their store name, custom invoice billing).
2. **Support & Catalog**: Direct links to catalogs and Shopee ecer checkouts.
3. **Ordering Process**: Provide the steps to order (ask Vumin, fill format, wait for invoice, transfer payment, shipment tracking).

Style Rules:
- Hyper-minimalist elegant black-and-white theme. Font: Playfair Display for headers, Inter for text.
- Standard centered capital "V" header. Sub-header: "R E S E L L E R   W E L C O M E   G U I D E".
- A elegant letter of welcome signed by the Vuyama Operations Manager.
- Tables or bullet highlights showing their custom pricing discounts and shipping schedules.
- Do NOT output any markdown fences like \`\`\`html. Return raw HTML.`;

  logger.info(`[PDF CS Vuyama] Prompting Gemini for reseller welcome guide layout for ${phoneNumber}...`);
  const htmlRaw = await gemini.callGemini(prompt);
  let cleanHtml = htmlRaw.trim();
  if (cleanHtml.startsWith('```html')) cleanHtml = cleanHtml.replace(/^```html/, '');
  if (cleanHtml.startsWith('```')) cleanHtml = cleanHtml.replace(/^```/, '');
  if (cleanHtml.endsWith('```')) cleanHtml = cleanHtml.replace(/```$/, '');
  cleanHtml = cleanHtml.trim();

  const slug = `welcome_${phoneNumber.split('@')[0]}_${resellerLevel.toLowerCase().replace(/\s+/g, '_')}`;
  return await renderHtmlToPdf(browser, slug, cleanHtml);
};

module.exports = {
  generateComparisonPdf,
  generateInvoicePdf,
  generateWelcomeGuidePdf,
  renderHtmlToPdf
};
