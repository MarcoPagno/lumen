import orchestrator from "tests/orchestrator.js";
import webserver from "infra/webserver.js";

beforeAll(async () => {
  await orchestrator.waitForAllServices();
  await orchestrator.clearDatabase();
  await orchestrator.runPendingMigrations();
});

async function postReading(session, body) {
  return await fetch(`${webserver.origin}/api/v1/readings`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(session && { Cookie: `session_id=${session.token}` }),
    },
    body: JSON.stringify(body),
  });
}

describe("POST /api/v1/readings", () => {
  describe("Anonymous user", () => {
    test("receives 403", async () => {
      const response = await postReading(null, {
        url: "https://example.com/texto",
      });
      expect(response.status).toBe(403);
    });
  });

  describe("Authenticated user", () => {
    test("returns 400 for an invalid URL", async () => {
      const { session } =
        await orchestrator.createUserActivateAndReturnSession();

      const response = await postReading(session, { url: "não é uma url" });
      expect(response.status).toBe(400);

      const responseBody = await response.json();
      expect(responseBody.message).toBe("Invalid URL");
    });

    test("returns 400 for a non http(s) URL", async () => {
      const { session } =
        await orchestrator.createUserActivateAndReturnSession();

      const response = await postReading(session, {
        url: "file:///etc/passwd",
      });
      expect(response.status).toBe(400);
    });

    test("returns 400 for private network addresses", async () => {
      const { session } =
        await orchestrator.createUserActivateAndReturnSession();

      for (const url of [
        "http://localhost:3000/api/v1/status",
        "http://127.0.0.1/",
        "http://192.168.0.1/",
        "http://10.0.0.1/",
      ]) {
        const response = await postReading(session, { url });
        expect(response.status).toBe(400);
      }
    });
  });
});
