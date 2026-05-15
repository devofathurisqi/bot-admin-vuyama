const fs = require('fs');
const path = require('path');
const config = require('./config');

// Ensure data directory exists
const ensureDataDir = () => {
  if (!fs.existsSync(config.dataDir)) {
    fs.mkdirSync(config.dataDir, { recursive: true });
  }
};

// Get file path for a data type
const getFilePath = (type) => {
  ensureDataDir();
  return path.join(config.dataDir, `${type}.json`);
};

// Initialize data file if doesn't exist
const initFile = (type, defaultData = []) => {
  const filePath = getFilePath(type);
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, JSON.stringify(defaultData, null, 2));
  }
};

// Read data from file
const read = (type) => {
  initFile(type);
  const filePath = getFilePath(type);
  try {
    const data = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    console.error(`Error reading ${type}:`, error);
    return [];
  }
};

// Write data to file
const write = (type, data) => {
  initFile(type);
  const filePath = getFilePath(type);
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
  } catch (error) {
    console.error(`Error writing ${type}:`, error);
  }
};

// Add record to file with rotation for conversations
const add = (type, record) => {
  const data = read(type);
  record.id = record.id || Date.now().toString();
  record.timestamp = record.timestamp || new Date().toISOString();
  data.push(record);

  // Rotation logic for conversations to prevent huge files
  if (type === 'conversations' && data.length > 1000) {
    const archivePath = path.join(config.dataDir, 'conversations_archive.json');
    let archive = [];
    if (fs.existsSync(archivePath)) {
      try {
        archive = JSON.parse(fs.readFileSync(archivePath, 'utf-8'));
      } catch (e) {
        console.error('Error reading archive:', e);
      }
    }
    
    // Move oldest 500 records to archive
    const toArchive = data.splice(0, 500);
    archive.push(...toArchive);
    
    try {
      fs.writeFileSync(archivePath, JSON.stringify(archive, null, 2));
      console.log(`Archived 500 old conversations to conversations_archive.json`);
    } catch (e) {
      console.error('Error writing archive:', e);
    }
  }

  write(type, data);
  return record;
};

// Get record by ID
const getById = (type, id) => {
  const data = read(type);
  return data.find(item => item.id === id);
};

// Get records by field
const getByField = (type, field, value) => {
  const data = read(type);
  return data.filter(item => item[field] === value);
};

// Update record
const update = (type, id, updates) => {
  const data = read(type);
  const index = data.findIndex(item => item.id === id);
  if (index !== -1) {
    data[index] = { ...data[index], ...updates };
    write(type, data);
    return data[index];
  }
  return null;
};

module.exports = {
  read,
  write,
  add,
  getById,
  getByField,
  update,
  ensureDataDir
};
