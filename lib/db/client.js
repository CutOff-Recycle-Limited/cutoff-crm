import pg from "pg";

const { Pool } = pg;

let pool;

export const isDatabaseConfigured = Boolean(process.env.DATABASE_URL);

export function getDb() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required for CRM database access");
  }

  if (!pool) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.NODE_ENV === "production"
        ? { rejectUnauthorized: false }
        : undefined,
    });
  }

  return pool;
}

export function query(text, params = []) {
  return getDb().query(text, params);
}

export async function withTransaction(work) {
  const client = await getDb().connect();

  try {
    await client.query("BEGIN");
    const result = await work(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
