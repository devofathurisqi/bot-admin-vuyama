let botStatus = 'disconnected'; // disconnected, scanning, authenticated, connected
let qrCode = null;

/**
 * Returns the current bot status and cached QR code (if scanning)
 * @returns {object} { status, qr }
 */
const getBotStatus = () => {
  return {
    status: botStatus,
    qr: qrCode
  };
};

/**
 * Set the current bot status and update connected WebSocket clients
 * @param {string} status - 'disconnected', 'scanning', 'authenticated', 'connected'
 * @param {string|null} qr - The base64 QR code or raw text if available
 */
const setBotStatus = (status, qr = null) => {
  botStatus = status;
  if (qr !== undefined) {
    qrCode = qr;
  }
  
  // Dynamic import to prevent circular dependency
  const { emitEvent } = require('./utils/socket');
  emitEvent('bot_status_update', { status: botStatus, qr: qrCode });
};

module.exports = {
  getBotStatus,
  setBotStatus
};
