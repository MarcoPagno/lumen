const path = require("node:path");
const dotenv = require("dotenv");
const { Pool } = require("pg");
const bcrypt = require("bcryptjs");

const isProduction = process.env.NODE_ENV === "production";

if (!isProduction) {
  dotenv.config({ path: path.join(__dirname, "..", "..", ".env.development") });
}

const pepper = process.env.PEPPER_PASSWORD || "";
const bcryptRounds = isProduction ? 14 : 1;

async function hashPassword(password) {
  return bcrypt.hash(password + pepper, bcryptRounds);
}

const ALL_FEATURES = require("../../models/features.json");

const db = new Pool({
  host: process.env.POSTGRES_HOST,
  port: process.env.POSTGRES_PORT,
  database: process.env.POSTGRES_DB,
  user: process.env.POSTGRES_USER,
  password: process.env.POSTGRES_PASSWORD,
  ssl: process.env.POSTGRES_CA ? { ca: process.env.POSTGRES_CA } : isProduction,
});

async function seed() {
  if (isProduction) {
    await seedProductionAdmin();
  } else {
    await seedDevelopmentDemo();
  }
}

async function seedProductionAdmin() {
  const { SEED_ADMIN_USERNAME, SEED_ADMIN_EMAIL, SEED_ADMIN_PASSWORD } =
    process.env;

  if (!SEED_ADMIN_USERNAME || !SEED_ADMIN_EMAIL || !SEED_ADMIN_PASSWORD) {
    console.log(
      "⚠️  Nenhum SEED_ADMIN_USERNAME/SEED_ADMIN_EMAIL/SEED_ADMIN_PASSWORD definido, pulando seed de produção.",
    );
    return;
  }

  const hashedPassword = await hashPassword(SEED_ADMIN_PASSWORD);

  const result = await db.query({
    text: `
      INSERT INTO users (username, email, password, features)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (email) DO NOTHING
      RETURNING id, email;`,
    values: [
      SEED_ADMIN_USERNAME,
      SEED_ADMIN_EMAIL,
      hashedPassword,
      ALL_FEATURES,
    ],
  });

  if (result.rowCount === 0) {
    console.log("⚠️  Usuário admin já existe, pulando...");
    return;
  }

  console.log("✅ Usuário admin criado:", result.rows[0].email);
}

async function seedDevelopmentDemo() {
  const username = process.env.SEED_DEMO_USERNAME || "admin";
  const email = process.env.SEED_DEMO_EMAIL || "admin@test.com";
  const password = process.env.SEED_DEMO_PASSWORD || "senha1";

  const hashedPassword = await hashPassword(password);

  const userResult = await db.query({
    text: `
      INSERT INTO users (username, email, password, features)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (email) DO NOTHING
      RETURNING id, email;`,
    values: [username, email, hashedPassword, ALL_FEATURES],
  });

  if (userResult.rowCount === 0) {
    console.log("⚠️  Usuário de teste já existe, pulando...");
    return;
  }

  const user = userResult.rows[0];
  console.log(`✅ Usuário de teste criado: ${user.email} / senha: ${password}`);

  await seedDemoTopic(user.id);
}

async function seedDemoTopic(userId) {
  const today = new Date().toISOString().slice(0, 10);

  const topicResult = await db.query({
    text: `
      INSERT INTO topics (user_id, title, source, studied_at)
      VALUES ($1, $2, $3, $4)
      RETURNING id;`,
    values: [userId, "Tema de exemplo", "Fonte de exemplo", today],
  });

  const topicId = topicResult.rows[0].id;

  await db.query({
    text: `
      INSERT INTO reviews (topic_id, type, scheduled_date, completed_at, content)
      VALUES ($1, 'initial_study', $2, timezone('utc', now()), $3);`,
    values: [
      topicId,
      today,
      "Explicação inicial de exemplo, escrita de memória.",
    ],
  });

  await db.query({
    text: `
      INSERT INTO reviews (topic_id, type, scheduled_date)
      VALUES ($1, 'daily', $2);`,
    values: [topicId, today],
  });

  console.log("✅ Tema de exemplo criado com uma revisão diária vencida hoje");
}

seed()
  .catch((error) => {
    console.error("❌ Erro ao rodar o seed:", error.message);
  })
  .finally(async () => {
    await db.end();
  });
