const knex = require('knex');
require('dotenv').config();

const db = knex({
  client: 'pg',
  connection: {
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL && process.env.DATABASE_URL.includes('supabase') 
      ? { rejectUnauthorized: false } 
      : false
  },
  pool: { min: 0, max: 7 }
});

module.exports = db;
