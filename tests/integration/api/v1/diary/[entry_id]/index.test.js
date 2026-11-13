import orchestrator from "tests/orchestrator.js";
import webserver from "infra/webserver.js";

beforeAll(async () => {
  await orchestrator.waitForAllServices();
  await orchestrator.clearDatabase();
  await orchestrator.runPendingMigrations();
});

async function createEntry(session, content) {
  const response = await fetch(`${webserver.origin}/api/v1/diary`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: `session_id=${session.token}`,
    },
    body: JSON.stringify({ content }),
  });
  return await response.json();
}

async function request(session, method, entryId, body) {
  return await fetch(`${webserver.origin}/api/v1/diary/${entryId}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(session && { Cookie: `session_id=${session.token}` }),
    },
    ...(body && { body: JSON.stringify(body) }),
  });
}

describe("/api/v1/diary/[entry_id]", () => {
  describe("Anonymous user", () => {
    test("receives 403 on PATCH and DELETE", async () => {
      const id = "00000000-0000-4000-8000-000000000000";
      expect((await request(null, "PATCH", id, { content: "x" })).status).toBe(
        403,
      );
      expect((await request(null, "DELETE", id)).status).toBe(403);
    });
  });

  describe("Authenticated user", () => {
    test("PATCH updates the content", async () => {
      const { session } =
        await orchestrator.createUserActivateAndReturnSession();
      const entry = await createEntry(session, "Rascunho");

      const response = await request(session, "PATCH", entry.id, {
        content: "Versão final",
      });
      expect(response.status).toBe(200);

      const responseBody = await response.json();
      expect(responseBody.content).toBe("Versão final");
      expect(responseBody.entry_date).toBe(entry.entry_date);
    });

    test("DELETE removes the entry", async () => {
      const { session } =
        await orchestrator.createUserActivateAndReturnSession();
      const entry = await createEntry(session, "Para apagar");

      const response = await request(session, "DELETE", entry.id);
      expect(response.status).toBe(200);

      const list = await (
        await fetch(`${webserver.origin}/api/v1/diary`, {
          headers: { Cookie: `session_id=${session.token}` },
        })
      ).json();
      expect(list).toEqual([]);
    });

    test("returns 404 for another user's entry", async () => {
      const { session: ownerSession } =
        await orchestrator.createUserActivateAndReturnSession();
      const { session } =
        await orchestrator.createUserActivateAndReturnSession();
      const entry = await createEntry(ownerSession, "Privado");

      expect(
        (await request(session, "PATCH", entry.id, { content: "x" })).status,
      ).toBe(404);
      expect((await request(session, "DELETE", entry.id)).status).toBe(404);
    });

    test("returns 404 for an invalid id", async () => {
      const { session } =
        await orchestrator.createUserActivateAndReturnSession();

      expect((await request(session, "DELETE", "invalid")).status).toBe(404);
    });
  });
});
