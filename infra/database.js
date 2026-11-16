import { Client, Pool } from "pg";
import { ServiceError } from "./errors.js";

async function query(queryObject) {
  try {
    return await getPool().query(queryObject);
  } catch (error) {
    const serviceErrorObject = new ServiceError({
      message: "Error on connection with Database or on Query",
      cause: error,
    });
    throw serviceErrorObject;
  }
}

function getPool() {
  if (!globalThis.lumenDatabasePool) {
    const pool = new Pool({
      ...getConnectionValues(),
      max: 5,
      idleTimeoutMillis: 10000,
      allowExitOnIdle: true,
    });
    pool.on("error", (error) => {
      console.error("Idle database connection error:", error.message);
    });
    globalThis.lumenDatabasePool = pool;
  }

  return globalThis.lumenDatabasePool;
}

async function getNewClient() {
  const client = new Client(getConnectionValues());

  await client.connect();
  return client;
}

function getConnectionValues() {
  return {
    host: process.env.POSTGRES_HOST,
    port: process.env.POSTGRES_PORT,
    user: process.env.POSTGRES_USER,
    database: process.env.POSTGRES_DB,
    password: process.env.POSTGRES_PASSWORD,
    ssl: getSSLValues(),
  };
}

const database = {
  query,
  getNewClient,
};

export default database;

function getSSLValues() {
  if (process.env.POSTGRES_CA) {
    return {
      ca: process.env.POSTGRES_CA,
    };
  }
  return process.env.NODE_ENV == "production" ? true : false;
}
