const db = require('../src/utils/db');
const fs = require('fs');
const path = require('path');

async function run() {
  try {
    console.log('Fetching all database records for backup...');
    
    const company = await db('company_info').select('key', 'value');
    const companyObj = {};
    company.forEach(c => {
      companyObj[c.key] = c.value;
    });

    const products = await db('products').orderBy('id', 'asc');
    const productsFormatted = products.map(p => ({
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
      status: p.status,
      variants: typeof p.variants === 'string' ? JSON.parse(p.variants) : p.variants,
      wholesale_tiers: typeof p.wholesale_tiers === 'string' ? JSON.parse(p.wholesale_tiers) : p.wholesale_tiers
    }));

    const reseller_program = await db('reseller_program').orderBy('id', 'asc');
    const resellerFormatted = reseller_program.map(r => ({
      level: r.level,
      min_order: r.min_order,
      price: parseFloat(r.price),
      benefits: r.benefits
    }));

    const services = await db('services').orderBy('id', 'asc');
    const servicesFormatted = services.map(s => ({
      id: s.id,
      name: s.name,
      description: s.description,
      benefits: typeof s.benefits === 'string' ? JSON.parse(s.benefits) : s.benefits,
      terms: s.terms
    }));

    const faq = await db('faq').orderBy('id', 'asc');
    const faqFormatted = faq.map(f => ({
      category: f.category,
      question: f.question,
      answer: f.answer
    }));

    const backupData = {
      metadata: {
        title: "Katalog Resmi Vuyama Hijab & Mukena - Update Mei 2026",
        last_update: new Date().toLocaleDateString('id-ID', { year: 'numeric', month: 'long', day: 'numeric' }),
        status: "Official Database Sync"
      },
      company: companyObj,
      products: productsFormatted,
      reseller_program: resellerFormatted,
      services: servicesFormatted,
      faq: faqFormatted
    };

    const outPath = path.join(__dirname, '../data/pdf_knowledge_backup.json');
    fs.writeFileSync(outPath, JSON.stringify(backupData, null, 2), 'utf8');
    console.log('Successfully written sync data to:', outPath);
  } catch (error) {
    console.error('Error during sync backup:', error);
  } finally {
    await db.destroy();
  }
}

run();
