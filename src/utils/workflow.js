const db = require('./db');
const logger = require('./logger');
const { emitEvent } = require('./socket');

/**
 * Mutes the bot and pauses automatic AI replies for a specific customer
 * by setting their paused_until timestamp in the customers table.
 * @param {string} phoneNumber - Customer's WhatsApp phone number
 * @param {number} durationHours - Hours to pause the bot (default 12 hours)
 */
const pauseBotForCustomer = async (phoneNumber, durationHours = 12) => {
  if (!phoneNumber) return;
  
  try {
    const pausedUntil = new Date(Date.now() + durationHours * 60 * 60 * 1000);
    
    // 1. Update customer status to WAITING_HUMAN and set paused_until in CRM
    const customer = await db('customers').where('phone_number', phoneNumber).first();
    if (customer) {
      await db('customers').where('phone_number', phoneNumber).update({
        status: 'WAITING_HUMAN',
        paused_until: pausedUntil,
        updated_at: new Date()
      });
      
      const updatedCustomer = await db('customers').where('phone_number', phoneNumber).first();
      emitEvent('customer_updated', updatedCustomer);
      logger.info(`[Workflow Manual Override] Bot paused/muted for ${phoneNumber} until ${pausedUntil.toISOString()}. Status set to WAITING_HUMAN`);
    } else {
      // If customer doesn't exist, we can register them as WAITING_HUMAN
      await db('customers').insert({
        phone_number: phoneNumber,
        name: 'Customer',
        status: 'WAITING_HUMAN',
        paused_until: pausedUntil,
        created_at: new Date(),
        updated_at: new Date()
      });
      logger.info(`[Workflow Manual Override] Registered new customer ${phoneNumber} as WAITING_HUMAN (paused)`);
    }
  } catch (err) {
    logger.error(`[Workflow Manual Override] Failed to pause bot for customer ${phoneNumber}:`, err);
  }
};

/**
 * Resumes bot automatic replies for a customer by clearing paused_until and resetting status to NORMAL.
 * @param {string} phoneNumber - Customer's WhatsApp phone number
 */
const resumeBotForCustomer = async (phoneNumber) => {
  if (!phoneNumber) return;
  
  try {
    const customer = await db('customers').where('phone_number', phoneNumber).first();
    if (customer) {
      await db('customers').where('phone_number', phoneNumber).update({
        status: 'NORMAL',
        paused_until: null,
        updated_at: new Date()
      });
      
      const updatedCustomer = await db('customers').where('phone_number', phoneNumber).first();
      emitEvent('customer_updated', updatedCustomer);
      logger.info(`[Workflow Manual Override] Bot resumed/unmuted for ${phoneNumber}. Status set to NORMAL`);
    }
  } catch (err) {
    logger.error(`[Workflow Manual Override] Failed to resume bot for customer ${phoneNumber}:`, err);
  }
};

module.exports = {
  pauseBotForCustomer,
  resumeBotForCustomer
};
