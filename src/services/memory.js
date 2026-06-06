const db = require('../utils/db');
const history = require('./history');
const analyzer = require('./analyzer');
const logger = require('../utils/logger');

/**
 * Retrieve the conversation memory summary and state for a customer
 * @param {string} phoneNumber - Customer's phone number
 * @returns {Promise<Object|null>} - Memory object
 */
const getMemory = async (phoneNumber) => {
  try {
    return await db('conversation_memories').where('phone_number', phoneNumber).first();
  } catch (error) {
    logger.error(`Error retrieving memory for customer ${phoneNumber}:`, error);
    return null;
  }
};

/**
 * Update the memory for a customer:
 * 1. Fetch conversations from the last 3 days
 * 2. Get current memory
 * 3. Analyze with OpenAI (summarize, extract intent, check clarity, state)
 * 4. Save/update in database
 * 
 * @param {string} phoneNumber - Customer's phone number
 * @param {string} latestMessage - Customer's latest message
 * @returns {Promise<Object>} - The updated memory analysis
 */
const updateMemory = async (phoneNumber, latestMessage) => {
  try {
    // 1. Get raw conversations from the last 3 days
    const activeHistory = await history.getConversationsWithinDays(phoneNumber, 3);
    
    // 2. Get existing memory
    const currentMemory = await getMemory(phoneNumber);
    
    // 3. Analyze with Gemini Analyzer
    const analysis = await analyzer.analyzeConversation(phoneNumber, activeHistory, latestMessage, currentMemory);
    
    // 4. Save or update database
    const memoryPayload = {
      summary: analysis.summary,
      extracted_intent: analysis.extracted_intent,
      conversation_state: analysis.conversation_state,
      last_summarized_at: new Date(),
      updated_at: new Date()
    };
    
    if (currentMemory) {
      await db('conversation_memories')
        .where('phone_number', phoneNumber)
        .update(memoryPayload);
    } else {
      await db('conversation_memories').insert({
        phone_number: phoneNumber,
        ...memoryPayload
      });
    }
    
    logger.info(`Successfully updated memory for customer ${phoneNumber}. Intent: ${analysis.extracted_intent}. State: ${analysis.conversation_state}`);
    
    return {
      phone_number: phoneNumber,
      ...analysis
    };
  } catch (error) {
    logger.error(`Error updating memory for customer ${phoneNumber}:`, error);
    // Return fallback logic
    return {
      phone_number: phoneNumber,
      summary: currentMemory ? currentMemory.summary : 'Error in memory processing.',
      extracted_intent: 'OTHER',
      is_intent_clear: true,
      clarification_question: null,
      conversation_state: currentMemory ? currentMemory.conversation_state : 'idle'
    };
  }
};

/**
 * Reset memory for a customer
 * @param {string} phoneNumber
 */
const clearMemory = async (phoneNumber) => {
  try {
    await db('conversation_memories').where('phone_number', phoneNumber).del();
    logger.info(`Cleared conversation memory for ${phoneNumber}`);
  } catch (error) {
    logger.error(`Failed to clear memory for ${phoneNumber}:`, error);
  }
};

module.exports = {
  getMemory,
  updateMemory,
  clearMemory
};
