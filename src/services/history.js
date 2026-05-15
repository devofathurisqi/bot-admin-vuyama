const db = require('../utils/db');
const config = require('../utils/config');

// Add message to history
const addMessage = async (phoneNumber, message, sender = 'customer', type = 'text') => {
  return db('conversations').insert({
    phone_number: phoneNumber,
    message,
    sender, // 'customer', 'bot', or 'agent'
    message_type: type, // 'text', 'image', 'order', etc
    status: 'received',
    timestamp: new Date().toISOString()
  });
};

// Get conversation history for a customer
const getHistory = async (phoneNumber, limit = config.contextMessagesLimit) => {
  return db('conversations')
    .where('phone_number', phoneNumber)
    .orderBy('timestamp', 'asc')
    .limit(limit);
};

// Get recent messages for context
const getContext = async (phoneNumber, limit = 5) => {
  const history = await getHistory(phoneNumber, limit);
  return history.map(h => ({
    role: h.sender === 'customer' ? 'user' : 'assistant',
    content: h.message,
    timestamp: h.timestamp
  }));
};

// Get all conversations
const getAllConversations = async () => {
  return db('conversations').orderBy('timestamp', 'desc');
};

// Get conversations by status
const getConversationsByStatus = async (status) => {
  return db('conversations').where('status', status);
};

// Update conversation status
const updateConversationStatus = async (id, status) => {
  return db('conversations').where('id', id).update({ status });
};

// Get orders for a customer
const getOrders = async (phoneNumber) => {
  return db('orders').where('phone_number', phoneNumber);
};

// Create order
const createOrder = async (phoneNumber, products, total, notes = '') => {
  return db('orders').insert({
    phone_number: phoneNumber,
    products: JSON.stringify(products),
    total,
    notes,
    status: 'pending', // pending, confirmed, paid, shipped, delivered
    created_at: new Date().toISOString()
  });
};

// Update order
const updateOrder = async (orderId, updates) => {
  if (updates.products) {
    updates.products = JSON.stringify(updates.products);
  }
  return db('orders').where('id', orderId).update(updates);
};

// Create escalation
const createEscalation = async (phoneNumber, reason, conversationId) => {
  return db('escalations').insert({
    phone_number: phoneNumber,
    reason,
    conversation_id: conversationId,
    status: 'open', // open, assigned, resolved
    created_at: new Date().toISOString()
  });
};

// Get escalations
const getEscalations = async () => {
  return db('escalations').where('status', 'open');
};

// Update escalation
const updateEscalation = async (escalationId, updates) => {
  return db('escalations').where('id', escalationId).update(updates);
};

module.exports = {
  addMessage,
  getHistory,
  getContext,
  getAllConversations,
  getConversationsByStatus,
  updateConversationStatus,
  getOrders,
  createOrder,
  updateOrder,
  createEscalation,
  getEscalations,
  updateEscalation
};
