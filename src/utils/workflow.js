const db = require('./db');
const logger = require('./logger');
const { emitEvent } = require('./socket');

/**
 * Mutes the bot and pauses automatic AI replies for a specific customer
 * when the human admin manually sends a message.
 * @param {string} phoneNumber - Customer's WhatsApp phone number
 * @param {string} reason - Reason for pausing (e.g. 'Intervensi Live Chat Dashboard')
 */
const pauseBotForCustomer = async (phoneNumber, reason) => {
  if (!phoneNumber) return;
  
  try {
    // 1. Add number to blocked_numbers if not already blocked
    const existingBlock = await db('blocked_numbers').where('phone_number', phoneNumber).first();
    if (!existingBlock) {
      await db('blocked_numbers').insert({
        phone_number: phoneNumber,
        reason: reason || 'Intervensi Manual Admin',
        created_at: new Date()
      });
      emitEvent('number_blocked', { phone_number: phoneNumber, reason });
      logger.info(`[Workflow Manual Override] Bot blocked/muted for ${phoneNumber}. Reason: ${reason}`);
    }

    // 2. Set customer status to WAITING_HUMAN in CRM
    const customer = await db('customers').where('phone_number', phoneNumber).first();
    if (customer) {
      await db('customers').where('phone_number', phoneNumber).update({
        status: 'WAITING_HUMAN',
        updated_at: new Date()
      });
      
      const updatedCustomer = await db('customers').where('phone_number', phoneNumber).first();
      emitEvent('customer_updated', updatedCustomer);
      logger.info(`[Workflow Manual Override] Customer ${phoneNumber} status updated to WAITING_HUMAN`);
    }
  } catch (err) {
    logger.error(`[Workflow Manual Override] Failed to pause bot for customer ${phoneNumber}:`, err);
  }
};

module.exports = {
  pauseBotForCustomer
};
