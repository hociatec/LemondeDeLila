#!/usr/bin/env node
/**
 * Ajoute les colonnes de bannissement à la table users si elles n'existent pas.
 * Utilisation : dans le dossier backend, exécuter `node tools/sql/upgrade-ban-columns.js`
 * Variables d'environnement supportées : DATABASE_URL ou DB_HOST/DB_PORT/DB_USER/DB_PASSWORD/DB_NAME.
 */
const path = require('path');
const mysql = require('mysql2/promise');
require('dotenv').config({ path: path.resolve(__dirname, '..', '..', '.env') });

const {
  DATABASE_URL,
  DB_HOST = '127.0.0.1',
  DB_PORT = '3306',
  DB_USER = 'root',
  DB_PASSWORD = '',
  DB_NAME = 'le_monde_de_lila',
} = process.env;

async function main() {
  const config = DATABASE_URL
    ? { uri: DATABASE_URL }
    : {
        host: DB_HOST,
        port: Number(DB_PORT) || 3306,
        user: DB_USER,
        password: DB_PASSWORD,
        database: DB_NAME,
      };

  const connection = DATABASE_URL
    ? await mysql.createConnection({ uri: config.uri, multipleStatements: true })
    : await mysql.createConnection({ ...config, multipleStatements: true });

  try {
    console.log('Connexion OK. Base :', DATABASE_URL ? '(via DATABASE_URL)' : config.database);
    await ensureColumn(connection, 'banned_until', 'datetime NULL');
    await ensureColumn(connection, 'ban_reason', 'varchar(255) NULL');
    console.log('Mise à jour terminée.');
  } finally {
    await connection.end();
  }
}

async function ensureColumn(connection, columnName, definition) {
  const [rows] = await connection.execute(
    `SELECT COUNT(*) AS c FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'users' AND column_name = ?`,
    [columnName],
  );
  if (rows[0].c > 0) {
    console.log(`- Colonne ${columnName} déjà présente.`);
    return;
  }
  const sql = `ALTER TABLE users ADD COLUMN ${columnName} ${definition}`;
  console.log(`- Ajout de la colonne ${columnName}...`);
  await connection.execute(sql);
}

main().catch((err) => {
  console.error('Erreur lors de la mise à jour des colonnes de ban :', err.message);
  process.exit(1);
});
