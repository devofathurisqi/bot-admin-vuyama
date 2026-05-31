const { GoogleGenerativeAI } = require("@google/generative-ai");
const logger = require('../utils/logger');

// Last updated: 2026-05-31 - Trigger for CI/CD Auto-Deployment Validation

const API_KEY = process.env.GEMINI_API_KEY;
const MODEL_NAME = process.env.GEMINI_MODEL || 'gemini-2.5-flash';

if (!API_KEY) {
  logger.error("GEMINI_API_KEY is not defined in environment variables");
}

const genAI = new GoogleGenerativeAI(API_KEY);

// Fallback models in case the primary model undergoes high demand or outage
const FALLBACK_MODELS = [
  MODEL_NAME,
  'gemini-2.0-flash',
  'gemini-flash-latest' // Stable alias for 1.5-flash
];

/**
 * Call Gemini API with automatic exponential backoff retries and model fallbacks for ultimate resilience
 * @param {string} prompt - The prompt to send to Gemini
 * @returns {Promise<string>} - The generated response
 */
const callGemini = async (prompt) => {
  let lastError = null;

  for (const modelName of FALLBACK_MODELS) {
    const maxRetries = 2;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        if (attempt > 0) {
          const delay = Math.pow(2, attempt) * 400; // 800ms, 1600ms
          await new Promise(resolve => setTimeout(resolve, delay));
          logger.info(`Retrying Gemini call with model ${modelName} (Attempt ${attempt}/${maxRetries})...`);
        }

        const activeModel = genAI.getGenerativeModel({ model: modelName });
        const result = await activeModel.generateContent(prompt);
        const response = await result.response;
        const text = response.text();
        
        if (text) {
          return text;
        }
      } catch (error) {
        lastError = error;
        logger.warn(`Gemini call failed with model ${modelName} on attempt ${attempt}: ${error.message}`);
        
        // If it's an authorization/API key invalidation error, do not retry
        if (error.message && (error.message.includes('API key not valid') || error.message.includes('400'))) {
          break;
        }
      }
    }
    logger.error(`Model ${modelName} failed all retry attempts. Swapping to next fallback model...`);
  }

  logger.error(`All Gemini models failed. Last error: ${lastError ? lastError.message : 'Unknown'}`);
  throw lastError || new Error('All Gemini API models failed');
};

/**
 * Health check for Gemini API (tries primary, then fallback models)
 * @returns {Promise<boolean>}
 */
const healthCheck = async () => {
  try {
    if (!API_KEY) return false;
    
    // Add a 5-second timeout wrapper to prevent indefinite hanging
    const activeModel = genAI.getGenerativeModel({ model: MODEL_NAME });
    const apiCall = activeModel.generateContent("hi");
    const timeout = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Timeout')), 5000)
    );

    await Promise.race([apiCall, timeout]);
    return true;
  } catch (error) {
    // If primary failed, try checking if fallback model is responsive
    try {
      const fallbackModel = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
      await fallbackModel.generateContent("hi");
      return true;
    } catch (err) {
      return false;
    }
  }
};

module.exports = {
  callGemini,
  healthCheck,
  MODEL_NAME
};
