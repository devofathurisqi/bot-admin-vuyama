const knowledge = require('../services/knowledge');
const history = require('../services/history');
const gemini = require('../services/gemini');
const config = require('../utils/config');
const logger = require('../utils/logger');

// System prompt untuk AI
const SYSTEM_PROMPT = `Kamu adalah admin customer service resmi Vuyama, perusahaan penjual mukena dan kerudung untuk reseller.

INSTRUKSI PENTING:
1. Bicara natural, ramah, dan santai seperti admin manusia profesional
2. Gunakan emoji untuk friendly tone (😊 👍 🎉 🙏 dll)
3. Sesuaikan gaya bicara dengan customer:
   - Jika customer formal → jawab formal
   - Jika customer santai → jawab santai
   - Jika customer bercanda → boleh friendly
4. Jawab langsung inti pertanyaan, jangan bertele-tele
5. Jika tanya produk, sebutkan nama, harga, warna, dan deskripsi
6. Jika mau order, minta detail: produk, jumlah, warna, ukuran
7. Jika komplain, utamakan empati dan solusi
8. Jangan pernah bilang "Saya adalah AI" - posisi diri sebagai admin manusia
9. Jika tidak yakin jawaban, tanya lebih detail atau katakan akan dicek tim

KNOWLEDGE BASE VUYAMA:
${JSON.stringify({
  company: knowledge.getCompanyInfo(),
  products: knowledge.getAllProducts(),
  services: knowledge.getServices(),
  faq: knowledge.getFAQByCategory(''),
  reseller_program: knowledge.getResellerProgram()
}, null, 2)}

Gunakan informasi di atas untuk jawab pertanyaan customer dengan akurat.`;

// Check if needs escalation
const needsEscalation = (message) => {
  const msg = message.toLowerCase();
  return config.escalationKeywords.some(keyword => msg.includes(keyword));
};

// Build context dari chat history
const buildContextString = async (phoneNumber) => {
  const chatHistory = await history.getHistory(phoneNumber, config.contextMessagesLimit);

  if (chatHistory.length === 0) {
    return '';
  }

  let contextStr = '\nChat history:\n';
  chatHistory.forEach(msg => {
    const sender = msg.sender === 'customer' ? 'Customer' : 'Admin';
    contextStr += `${sender}: ${msg.message}\n`;
  });

  return contextStr;
};

// Generate bot response using AI
const generateResponse = async (phoneNumber, userMessage) => {
  try {
    // Check for escalation first
    if (needsEscalation(userMessage)) {
      return {
        intent: 'escalation',
        response: `Baik kak 🙏 Saya sambungkan ke tim kami untuk membantu lebih lanjut. Mohon tunggu sebentar...`,
        shouldEscalate: true
      };
    }

    // Build prompt dengan context
    const contextStr = await buildContextString(phoneNumber);
    const prompt = `${SYSTEM_PROMPT}${contextStr}\n\nCustomer: ${userMessage}\n\nAdmin (jangan mulai dengan 'Admin:'):`;

    // Call Gemini AI
    logger.info(`Calling Gemini AI for: ${userMessage}`);
    const response = await gemini.callGemini(prompt);

    // Clean response (remove any prefix)
    let cleanedResponse = response.trim();
    if (cleanedResponse.startsWith('Admin:')) {
      cleanedResponse = cleanedResponse.substring(6).trim();
    }

    return {
      intent: 'ai',
      response: cleanedResponse || 'Maaf, coba lagi sebentar 🙏'
    };
  } catch (error) {
    logger.error('Error generating response:', error);

    // Fallback response jika Ollama error
    return {
      intent: 'error',
      response: 'Maaf kak, ada kendala teknis. Tim kami sedang membantu. Coba lagi dalam beberapa detik ya 🙏'
    };
  }
};

module.exports = {
  generateResponse,
  needsEscalation,
  SYSTEM_PROMPT
};
