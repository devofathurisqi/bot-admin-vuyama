const { GoogleGenerativeAI } = require("@google/generative-ai");
const logger = require('../utils/logger');

const API_KEY = process.env.GEMINI_API_KEY;
const MODEL_NAME = process.env.GEMINI_MODEL;

if (!API_KEY) {
  logger.error("GEMINI_API_KEY is not defined in environment variables");
}

const genAI = new GoogleGenerativeAI(API_KEY);
const model = genAI.getGenerativeModel({ model: MODEL_NAME });

/**
 * Call Gemini API to generate response
 * @param {string} prompt - The prompt to send to Gemini
 * @returns {Promise<string>} - The generated response
 */
const callGemini = async (prompt) => {
  try {
    const result = await model.generateContent(prompt);
    const response = await result.response;
    return response.text();
  } catch (error) {
    logger.error(`Gemini API error: ${error.message}`);
    throw error;
  }
};

/**
 * Health check for Gemini API (just tries a simple prompt)
 * @returns {Promise<boolean>}
 */
const healthCheck = async () => {
  try {
    if (!API_KEY) return false;
    await model.generateContent("hi");
    return true;
  } catch (error) {
    return false;
  }
};

module.exports = {
  callGemini,
  healthCheck,
  MODEL_NAME
};
