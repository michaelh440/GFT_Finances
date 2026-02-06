// src/lib/db.js
import postgres from 'postgres';
import { DATABASE_URL } from '$env/static/private';

const sql = postgres(DATABASE_URL, {
  max: 10,
  idle_timeout: 20,
  connect_timeout: 10,
});

export default sql;