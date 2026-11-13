import orchestrator from "tests/orchestrator.js";
import webserver from "infra/webserver.js";
import date from "infra/date.js";

beforeAll(async () => {
  await orchestrator.waitForAllServices();
  await orchestrator.clearDatabase();
  await orchestrator.runPendingMigrations();
});

async function postEntry(session, body) {
  return await fetch(`${webserver.origin}/api/v1/diary`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(session && { Cookie: `session_id=${session.token}` }),
    },
    body: JSON.stringify(body),
  });
}

describe("/api/v1/diary", () => {
  describe("Anonymous user", () => {
    test("receives 403 on GET", async () => {
      const response = await fetch(`${webserver.origin}/api/v1/diary`);
      expect(response.status).toBe(403);
    });

    test("receives 403 on POST", async () => {
      const response = await postEntry(null, { content: "Olá" });
      expect(response.status).toBe(403);
    });
  });

  describe("Authenticated user", () => {
    test("POST creates an entry dated today", async () => {
      const { session } =
        await orchestrator.createUserActivateAndReturnSession();

      const response = await postEntry(session, {
        content: "  Hoje li um sermão de Vieira.  ",
      });
      expect(response.status).toBe(201);

      const responseBody = await response.json();
      expect(responseBody.content).toBe("Hoje li um sermão de Vieira.");
      expect(responseBody.entry_date).toBe(date.getTodayDateOnly());
    });

    test("POST with empty content returns 400", async () => {
      const { session } =
        await orchestrator.createUserActivateAndReturnSession();

      const response = await postEntry(session, { content: "   " });
      expect(response.status).toBe(400);
    });

    test("GET returns only the user's entries, newest first", async () => {
      const { session } =
        await orchestrator.createUserActivateAndReturnSession();
      const { session: otherSession } =
        await orchestrator.createUserActivateAndReturnSession();

      await postEntry(session, { content: "Primeira" });
      await postEntry(session, { content: "Segunda" });
      await postEntry(otherSession, { content: "De outra pessoa" });

      const response = await fetch(`${webserver.origin}/api/v1/diary`, {
        headers: { Cookie: `session_id=${session.token}` },
      });
      expect(response.status).toBe(200);

      const responseBody = await response.json();
      expect(responseBody.map((entry) => entry.content)).toEqual([
        "Segunda",
        "Primeira",
      ]);
    });
  });
});
