// Archivo: src/config/db.js
// Propósito: crear una conexión reutilizable a PostgreSQL con tiempos límite

const { Pool } = require('pg');
require('dotenv').config();

// Pool de conexiones a PostgreSQL.
// connectionTimeoutMillis evita que el backend parezca congelado si la base no responde.
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
  query_timeout: 10000,
});

module.exports = pool;
