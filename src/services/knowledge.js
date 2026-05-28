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

    if (!fs.existsSync(excelPath)) {
      throw new Error(`Excel knowledge file not found at: ${excelPath}`);
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
          image: getVal(p, 'Link Gambar') ? String(getVal(p, 'Link Gambar')).trim() : null,
          status: getVal(p, 'Status') ? String(getVal(p, 'Status')).trim() : 'Tersedia'
        };

        const existing = await db('products').where('id', String(id).trim()).first();
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
  getFAQCategories
};
