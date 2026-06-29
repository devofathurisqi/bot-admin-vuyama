const db = require('../utils/db');
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
 * Update the memory for a customer with pre-analyzed fields
 * @param {string} phoneNumber - Customer's phone number
 * @param {string} summary - Conversation summary
 * @param {string} intent - Detected intent
 * @param {string} state - Active conversation state
 */
const updateMemory = async (phoneNumber, summary, intent, state) => {
  try {
    const memoryPayload = {
      summary: summary || 'Percakapan sedang berlangsung.',
      extracted_intent: intent || 'OTHER',
      conversation_state: state || 'idle',
      last_summarized_at: new Date(),
      updated_at: new Date()
    };
    
    const currentMemory = await getMemory(phoneNumber);
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
    logger.info(`Successfully updated memory for customer ${phoneNumber}. Intent: ${intent}. State: ${state}`);
  } catch (error) {
    logger.error(`Error updating memory for customer ${phoneNumber}:`, error);
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
