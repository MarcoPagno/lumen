import orchestrator from "tests/orchestrator.js";
import webserver from "infra/webserver.js";

beforeAll(async () => {
  await orchestrator.waitForAllServices();
  await orchestrator.clearDatabase();
  await orchestrator.runPendingMigrations();
});

async function postLog(session, body) {
  return await fetch(`${webserver.origin}/api/v1/reading-logs`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: `session_id=${session.token}`,
    },
    body: JSON.stringify(body),
  });
}

describe("/api/v1/reading-logs", () => {
  describe("Anonymous user", () => {
    test("receives 403 on GET", async () => {
      const response = await fetch(`${webserver.origin}/api/v1/reading-logs`);
      expect(response.status).toBe(403);
    });

    test("receives 403 on POST", async () => {
      const response = await fetch(`${webserver.origin}/api/v1/reading-logs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      expect(response.status).toBe(403);
    });
  });

  describe("Authenticated user", () => {
    test("POST registers a read reading with reaction and note", async () => {
      const { session } =
        await orchestrator.createUserActivateAndReturnSession();
      const author = await orchestrator.createAuthor();
      const reading = await orchestrator.createReading(author);

      const response = await postLog(session, {
        reading_id: reading.id,
        status: "read",
        reaction: "liked",
        note: "  Trecho marcante  ",
      });
      expect(response.status).toBe(201);

      const responseBody = await response.json();
      expect(responseBody.reading_id).toBe(reading.id);
      expect(responseBody.status).toBe("read");
      expect(responseBody.reaction).toBe("liked");
      expect(responseBody.note).toBe("Trecho marcante");
    });

    test("POST again updates the same log", async () => {
      const { session } =
        await orchestrator.createUserActivateAndReturnSession();
      const author = await orchestrator.createAuthor();
      const reading = await orchestrator.createReading(author);

      const first = await (
        await postLog(session, { reading_id: reading.id, status: "skipped" })
      ).json();
      const second = await (
        await postLog(session, {
          reading_id: reading.id,
          status: "read",
          reaction: "disliked",
        })
      ).json();

      expect(second.id).toBe(first.id);
      expect(second.status).toBe("read");
      expect(second.reaction).toBe("disliked");
    });

    test("POST with an invalid status returns 400", async () => {
      const { session } =
        await orchestrator.createUserActivateAndReturnSession();
      const author = await orchestrator.createAuthor();
      const reading = await orchestrator.createReading(author);

      const response = await postLog(session, {
        reading_id: reading.id,
        status: "finished",
      });
      expect(response.status).toBe(400);
    });

    test("POST with an invalid reaction returns 400", async () => {
      const { session } =
        await orchestrator.createUserActivateAndReturnSession();
      const author = await orchestrator.createAuthor();
      const reading = await orchestrator.createReading(author);

      const response = await postLog(session, {
        reading_id: reading.id,
        status: "read",
        reaction: "love",
      });
      expect(response.status).toBe(400);
    });

    test("POST for a reading that does not exist returns 404", async () => {
      const { session } =
        await orchestrator.createUserActivateAndReturnSession();

      const response = await postLog(session, {
        reading_id: "00000000-0000-4000-8000-000000000000",
        status: "read",
      });
      expect(response.status).toBe(404);
    });

    test("GET returns only the user's read readings, newest first", async () => {
      const { session } =
        await orchestrator.createUserActivateAndReturnSession();
      const { session: otherSession } =
        await orchestrator.createUserActivateAndReturnSession();
      const author = await orchestrator.createAuthor({
        name: "Carlos de Laet",
      });
      const first = await orchestrator.createReading(author, {
        title: "Primeira",
      });
      const second = await orchestrator.createReading(author, {
        title: "Segunda",
      });
      const skipped = await orchestrator.createReading(author);

      await postLog(session, { reading_id: first.id, status: "read" });
      await postLog(session, { reading_id: second.id, status: "read" });
      await postLog(session, { reading_id: skipped.id, status: "skipped" });
      await postLog(otherSession, { reading_id: first.id, status: "read" });

      const response = await fetch(`${webserver.origin}/api/v1/reading-logs`, {
        headers: { Cookie: `session_id=${session.token}` },
      });
      expect(response.status).toBe(200);

      const responseBody = await response.json();
      expect(responseBody.map((log) => log.title)).toEqual([
        "Segunda",
        "Primeira",
      ]);
      expect(responseBody[0].author_name).toBe("Carlos de Laet");
    });
  });
});
