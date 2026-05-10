// Importa Pool para manejar conexiones a PostgreSQL
const { Pool } = require("pg");

// Crea el pool usando la variable DATABASE_URL de Render
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,

  // Necesario para conexión con PostgreSQL alojado en Render
  ssl: {
    rejectUnauthorized: false,
  },
});

// Exporta el pool para usarlo en rutas/controladores
module.exports = pool;