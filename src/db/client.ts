import * as SQLite from 'expo-sqlite';

const db = SQLite.openDatabaseSync('mekha.db');

export default db;
