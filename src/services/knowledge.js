const XLSX = require('xlsx');
const path = require('path');
const fs = require('fs');

// Load knowledge files
let knowledge = {
  products: [],
  services: [],
  faq: [],
  company: {},
  reseller_program: []
};

const loadKnowledge = () => {
  try {
    const learnDir = path.join(__dirname, '../../learn');
    const excelPath = path.join(learnDir, 'vuyama_data.xlsx');

    if (!fs.existsSync(excelPath)) {
      console.warn('Excel knowledge file not found:', excelPath);
      return;
    }

    const workbook = XLSX.readFile(excelPath);

    // Load Company Info
    const companySheet = workbook.Sheets['Company'];
    if (companySheet) {
      const companyData = XLSX.utils.sheet_to_json(companySheet);
      const companyObj = {};
      companyData.forEach(row => {
        if (row['Informasi Perusahaan'] && row['Keterangan']) {
          const key = row['Informasi Perusahaan'].toLowerCase().replace(/ /g, '_');
          companyObj[key] = row['Keterangan'];
        }
      });
      knowledge.company = companyObj;
    }

    // Load Products
    const productsSheet = workbook.Sheets['Products'];
    if (productsSheet) {
      const productsData = XLSX.utils.sheet_to_json(productsSheet);
      knowledge.products = productsData.map(p => ({
        id: p['ID'],
        name: p['Nama Produk'],
        category: p['Kategori'],
        sub_category: p['Sub-Kategori'],
        description: p['Deskripsi'],
        price_retail: p['Harga Umum (Retail)'],
        price_reseller: p['Harga Reseller'],
        color: p['Pilihan Warna'] ? p['Pilihan Warna'].split(',').map(s => s.trim()) : [],
        size: p['Ukuran'] ? p['Ukuran'].split(',').map(s => s.trim()) : [],
        material: p['Material/Bahan'],
        weight: p['Berat (Gram)'],
        stock: p['Stok Ready'],
        image: p['Link Gambar'],
        status: p['Status']
      }));
    }

    // Load Services
    const servicesSheet = workbook.Sheets['Services'];
    if (servicesSheet) {
      const servicesData = XLSX.utils.sheet_to_json(servicesSheet);
      knowledge.services = servicesData.map(s => ({
        id: s['ID'],
        name: s['Layanan'],
        description: s['Deskripsi'],
        benefits: s['Keuntungan'] ? s['Keuntungan'].split(',').map(s => s.trim()) : [],
        terms: s['Ketentuan']
      }));
    }

    // Load FAQ
    const faqSheet = workbook.Sheets['FAQ'];
    if (faqSheet) {
      const faqData = XLSX.utils.sheet_to_json(faqSheet);
      knowledge.faq_flat = faqData.map(f => ({
        category: f['Kategori'],
        q: f['Pertanyaan'],
        a: f['Jawaban']
      }));

      // Group by category
      const categories = [...new Set(faqData.map(f => f['Kategori']))];
      knowledge.faq = categories.map(cat => ({
        category: cat,
        questions: faqData.filter(f => f['Kategori'] === cat).map(f => ({
          q: f['Pertanyaan'],
          a: f['Jawaban']
        }))
      }));
    }

    // Load Reseller Program
    const resellerSheet = workbook.Sheets['Reseller_Program'];
    if (resellerSheet) {
      knowledge.reseller_program = XLSX.utils.sheet_to_json(resellerSheet);
    }

    console.log('Knowledge base loaded from Excel successfully (Pro Template)');
  } catch (error) {
    console.error('Error loading knowledge base from Excel:', error);
  }
};

// Search products by name, category, or material
const searchProducts = (query) => {
  const q = query.toLowerCase();
  return knowledge.products.filter(p =>
    (p.name && p.name.toLowerCase().includes(q)) ||
    (p.category && p.category.toLowerCase().includes(q)) ||
    (p.sub_category && p.sub_category.toLowerCase().includes(q)) ||
    (p.material && p.material.toLowerCase().includes(q)) ||
    (p.description && p.description.toLowerCase().includes(q))
  );
};

// Get product by ID
const getProduct = (id) => {
  return knowledge.products.find(p => p.id === id);
};

// Get all products
const getAllProducts = () => {
  return knowledge.products;
};

// Get products by category
const getProductsByCategory = (category) => {
  return knowledge.products.filter(p => p.category && p.category.toLowerCase() === category.toLowerCase());
};

// Get FAQ by category
const getFAQByCategory = (category) => {
  if (!category) return knowledge.faq_flat || [];
  const cat = knowledge.faq.find(f => f.category && f.category.toLowerCase() === category.toLowerCase());
  return cat ? cat.questions : [];
};

// Search FAQ
const searchFAQ = (query) => {
  const q = query.toLowerCase();
  if (!knowledge.faq_flat) return [];
  return knowledge.faq_flat.filter(f => 
    (f.q && f.q.toLowerCase().includes(q)) || 
    (f.a && f.a.toLowerCase().includes(q))
  );
};

// Get all FAQ categories
const getFAQCategories = () => {
  return knowledge.faq.map(f => f.category);
};

// Get company info
const getCompanyInfo = () => {
  return knowledge.company;
};

// Get services
const getServices = () => {
  return knowledge.services;
};

// Get reseller program info
const getResellerProgram = () => {
  return knowledge.reseller_program;
};

// Initialize on load
loadKnowledge();

module.exports = {
  loadKnowledge,
  searchProducts,
  getProduct,
  getAllProducts,
  getProductsByCategory,
  searchFAQ,
  getFAQByCategory,
  getFAQCategories,
  getCompanyInfo,
  getServices,
  getResellerProgram
};
