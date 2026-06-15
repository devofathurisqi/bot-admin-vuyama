const fs = require('fs');
const path = require('path');
const db = require('../utils/db');
const logger = require('../utils/logger');

let cachedContext = null;

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
  if (cachedContext) {
    return cachedContext;
  }
  try {
    logger.info('Compiling knowledge context (Cache Miss)...');
    // Query all database catalog tables
    const companyInfo = await db('company_info').orderBy('id', 'asc');
    const products = await db('products').orderBy('id', 'asc');
    const services = await db('services').orderBy('id', 'asc');
    const reseller = await db('reseller_program').orderBy('id', 'asc');
    const faq = await db('faq').orderBy('id', 'asc');
    const stockColors = await db('stock_colors').orderBy('id', 'asc');
    const mediaGallery = await db('media_gallery').orderBy('created_at', 'desc');

    // Clean and structure the retrieved data
    const cleanCompanyInfo = companyInfo.reduce((acc, c) => {
      acc[c.key] = c.value;
      return acc;
    }, {});

    const cleanProducts = products.map(p => ({
      id: p.id,
      name: p.name,
      category: p.category,
      sub_category: p.sub_category,
      description: p.description,
      price_retail: parseFloat(p.price_retail),
      price_reseller: parseFloat(p.price_reseller),
      material: p.material,
      stock: p.stock,
      status: p.status,
      color: typeof p.color === 'string' ? JSON.parse(p.color) : (p.color || []),
      size: typeof p.size === 'string' ? JSON.parse(p.size) : (p.size || []),
      images: p.image ? p.image.split(',').map(img => img.trim()).filter(Boolean) : [],
      variants: typeof p.variants === 'string' ? JSON.parse(p.variants) : (p.variants || []),
      wholesale_tiers: typeof p.wholesale_tiers === 'string' ? JSON.parse(p.wholesale_tiers) : (p.wholesale_tiers || [])
    }));

    const cleanServices = services.map(s => ({
      name: s.name,
      description: s.description,
      benefits: typeof s.benefits === 'string' ? JSON.parse(s.benefits) : (s.benefits || []),
      terms: s.terms
    }));

    const cleanReseller = reseller.map(r => ({
      level: r.level,
      min_order: r.min_order,
      price: parseFloat(r.price),
      benefits: r.benefits
    }));

    const cleanFaqs = faq.map(f => ({
      q: f.question,
      a: f.answer
    }));

    const cleanStockColors = stockColors.map(c => ({
      color_name: c.color_name,
      category: c.category,
      image_path: c.image_path,
      is_ready: c.is_ready,
      product_id: c.product_id || null
    }));

    const cleanMedia = mediaGallery.map(m => ({
      name: m.original_name,
      filepath: m.filepath,
      mime_type: m.mime_type,
      tag: m.tag || 'general'
    }));

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

    // Alias mapping database product IDs to specific color stock physical paths
    const productAliases = {
      'paris-legend': '/media/color_stock/Paris Jadul Color Stock.png',
      'pashmina-modal': '/media/color_stock/Pashmina Modal Viscoe Color Stock.png'
    };

    cachedContext = {
      company: cleanCompanyInfo,
      products: cleanProducts,
      services: cleanServices,
      faq: cleanFaqs,
      reseller_program: cleanReseller,
      documents: availableDocs,
      color_stock_files: colorStockFiles,
      stock_colors: cleanStockColors,
      media_gallery: cleanMedia,
      product_aliases: productAliases
    };

    return cachedContext;
  } catch (error) {
    logger.error('Error compiling consolidated knowledge context:', error);
    return {
      company: {},
      products: [],
      services: [],
      faq: [],
      reseller_program: [],
      documents: [],
      color_stock_files: [],
      stock_colors: [],
      media_gallery: [],
      product_aliases: {}
    };
  }
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

const invalidateKnowledgeCache = () => {
  cachedContext = null;
  logger.info('Knowledge cache invalidated.');
};

module.exports = {
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
  findMatchingFaq,
  invalidateKnowledgeCache
};
