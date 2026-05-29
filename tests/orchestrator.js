import { faker } from "@faker-js/faker";
import retry from "async-retry";
import userModel from "models/user.js";
import migrator from "models/migrator.js";
import sessionModel from "models/session.js";
import activationModel from "models/activation.js";
import database from "infra/database.js";
import webserver from "infra/webserver.js";
import systemActivityTypeModel from "models/system_activity_type";

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

async function createSystemActivityType(systemActivityTypeObject) {
  return await systemActivityTypeModel.createNewSystemActivityType({
    slug:
      systemActivityTypeObject?.slug ||
      faker.internet.username().replace(/[_.]/g, ""),
    name: systemActivityTypeObject?.name || faker.internet.displayName(),
    category: systemActivityTypeObject?.category || "documento",
    color: systemActivityTypeObject?.color || faker.color.rgb(),
    is_default_active:
      systemActivityTypeObject?.is_default_active || faker.datatype.boolean(),
    frequency: systemActivityTypeObject?.frequency || "on_publish",
    expires_after_days:
      systemActivityTypeObject?.expires_after_days ||
      faker.number.int({ max: 9 }),
    source: systemActivityTypeObject?.source || "rss",
    source_url: systemActivityTypeObject?.source_url || "https://google.com",
  });
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
  createSystemActivityType,
};

export default orchestrator;
