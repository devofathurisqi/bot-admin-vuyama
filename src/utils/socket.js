const socketIo = require('socket.io');
let io = null;

/**
 * Initialize Socket.IO with a running HTTP server
 * @param {object} server - HTTP Server instance
 * @returns {object} - Socket.IO instance
 */
const initSocket = (server) => {
  io = socketIo(server, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST', 'PUT', 'DELETE']
    }
  });

  io.on('connection', (socket) => {
    // Emit initial status to newly connected clients
    const { getBotStatus } = require('../bot_state');
    socket.emit('bot_status_update', getBotStatus());

    socket.on('disconnect', () => {
      // Disconnect handling
    });
  });

  return io;
};

/**
 * Get active Socket.IO server instance
 * @returns {object}
 */
const getIo = () => io;

/**
 * Helper to emit a WebSocket event to all connected dashboard clients
 * @param {string} event - Event name
 * @param {any} data - Event payload
 */
const emitEvent = (event, data) => {
  if (io) {
    io.emit(event, data);
  }
};

module.exports = {
  initSocket,
  getIo,
  emitEvent
};
