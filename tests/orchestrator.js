import { faker } from "@faker-js/faker";
import retry from "async-retry";
import userModel from "models/user.js";
import migrator from "models/migrator.js";
import sessionModel from "models/session.js";
import activationModel from "models/activation.js";
import topicModel from "models/topic.js";
import reviewModel from "models/review.js";
import authorModel from "models/author.js";
import readingModel from "models/reading.js";
import database from "infra/database.js";
import webserver from "infra/webserver.js";

const emailHttpUrl = `http://${process.env.EMAIL_HTTP_HOST}:${process.env.EMAIL_HTTP_PORT}`;

async function waitForAllServices() {
  await waitForWebServer();
  await waitForEmailServer();

  async function waitForWebServer() {
    return retry(fetchStatusPage, {
      retries: 100,
      maxTimeout: 1000,
    });

    async function fetchStatusPage() {
      const response = await fetch(`${webserver.origin}/api/v1/status`);

      if (response.status !== 200) {
        throw Error();
      }
    }
  }

  async function waitForEmailServer() {
    return retry(fetchEmailPage, {
      retries: 100,
      maxTimeout: 1000,
    });

    async function fetchEmailPage() {
      const response = await fetch(emailHttpUrl);

      if (response.status !== 200) {
        throw Error();
      }
    }
  }
}

async function clearDatabase() {
  await database.query("drop schema public cascade; create schema public;");
}

async function runPendingMigrations() {
  await migrator.runPendingMigrations();
}

async function createUser(userObject) {
  return await userModel.createNewUser({
    username:
      userObject?.username || faker.internet.username().replace(/[_.-]/g, ""),
    email: userObject?.email || faker.internet.email(),
    password: userObject?.password || "validPassword",
  });
}

async function createSession(user) {
  return await sessionModel.create(user.id);
}

async function activateUser(inactiveUser) {
  return await activationModel.activateUserbyUserId(inactiveUser.id);
}

async function createUserActivateAndReturnSession() {
  let user = await createUser();
  user = await activateUser(user);
  const session = await createSession(user);
  return { user, session };
}

async function addFeaturesToUser(userObject, features) {
  const updatedUser = await userModel.addFeatures(userObject.id, features);
  return updatedUser;
}

async function createTopic(user, topicData) {
  const topic = await topicModel.create(user.id, topicData);
  await reviewModel.scheduleInitialCycle(
    topic,
    topicData.initial_explanation || "Explicação inicial de teste",
  );
  return topic;
}

async function findReviewsByTopic(topicId) {
  const result = await database.query({
    text: `
      SELECT reviews.*, to_char(scheduled_date, 'YYYY-MM-DD') AS scheduled_date
      FROM reviews
      WHERE topic_id = $1
      ORDER BY reviews.scheduled_date ASC;`,
    values: [topicId],
  });
  return result.rows;
}

async function setReviewScheduledDate(reviewId, dateOnlyString) {
  await database.query({
    text: `UPDATE reviews SET scheduled_date = $2 WHERE id = $1;`,
    values: [reviewId, dateOnlyString],
  });
}

async function createAuthor(authorObject) {
  const slug =
    authorObject?.slug || faker.string.alphanumeric(12).toLowerCase();
  return await authorModel.upsert(
    {
      slug,
      name: authorObject?.name || faker.person.fullName(),
      birth_year: authorObject?.birth_year ?? 1850,
      death_year: authorObject?.death_year ?? 1920,
    },
    {
      bio: authorObject?.bio ?? "Biografia de teste.",
      image_url: authorObject?.image_url ?? null,
      wikipedia_url: authorObject?.wikipedia_url ?? null,
    },
  );
}

async function createReading(author, readingObject) {
  return await readingModel.insertProcessed(
    author.id,
    readingObject?.source || "wikisource",
    {
      external_id: readingObject?.external_id || faker.string.uuid(),
      title: readingObject?.title || faker.lorem.words(3),
      url: readingObject?.url || "https://pt.wikisource.org/wiki/Teste",
      status: readingObject?.status || "ready",
      content: readingObject?.content ?? "<p>Conteúdo da leitura.</p>",
      excerpt: "Conteúdo da leitura.",
      word_count: 200,
      reading_minutes: readingObject?.reading_minutes ?? 1,
      kind: readingObject?.kind || "conto",
      area: readingObject?.area || "literatura",
      tone: readingObject?.tone || "leve",
      themes: readingObject?.themes || [],
      series_id: readingObject?.series_id ?? null,
      part_number: readingObject?.part_number ?? null,
      part_total: readingObject?.part_total ?? null,
    },
  );
}

async function deleteAllReadings() {
  await database.query("DELETE FROM readings; DELETE FROM authors;");
}

async function createBook(user, bookObject) {
  const result = await database.query({
    text: `
      INSERT INTO books (user_id, title, author_name, themes, status)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *;`,
    values: [
      user.id,
      bookObject?.title || faker.lorem.words(3),
      bookObject?.author_name ?? null,
      bookObject?.themes || [],
      bookObject?.status || "reading",
    ],
  });
  return result.rows[0];
}

async function deleteAllEmails() {
  await fetch(`${emailHttpUrl}/messages`, {
    method: "DELETE",
  });
}

async function getLastEmail() {
  const emailListResponse = await fetch(`${emailHttpUrl}/messages`);
  const emailListBody = await emailListResponse.json();
  const lastEmailItem = emailListBody.pop();

  if (!lastEmailItem) return null;

  const emailTextResponse = await fetch(
    `${emailHttpUrl}/messages/${lastEmailItem.id}.plain`,
  );
  lastEmailItem.text = await emailTextResponse.text();

  return lastEmailItem;
}

function extractUUID(text) {
  const match = text.match(/[0-9a-fA-F-]{36}/);
  return match ? match[0] : null;
}

const orchestrator = {
  waitForAllServices,
  clearDatabase,
  runPendingMigrations,
  createUser,
  activateUser,
  addFeaturesToUser,
  createSession,
  createUserActivateAndReturnSession,
  deleteAllEmails,
  getLastEmail,
  extractUUID,
  createTopic,
  findReviewsByTopic,
  setReviewScheduledDate,
  createAuthor,
  createReading,
  deleteAllReadings,
  createBook,
};

export default orchestrator;
