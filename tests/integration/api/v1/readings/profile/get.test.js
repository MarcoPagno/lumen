import orchestrator from "tests/orchestrator.js";
import webserver from "infra/webserver.js";

beforeAll(async () => {
  await orchestrator.waitForAllServices();
  await orchestrator.clearDatabase();
  await orchestrator.runPendingMigrations();
});

beforeEach(async () => {
  await orchestrator.deleteAllReadings();
});

async function logReading(session, readingId, body = {}) {
  await fetch(`${webserver.origin}/api/v1/reading-logs`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: `session_id=${session.token}`,
    },
    body: JSON.stringify({ reading_id: readingId, status: "read", ...body }),
  });
}

async function getJson(session, path) {
  const response = await fetch(`${webserver.origin}${path}`, {
    headers: { Cookie: `session_id=${session.token}` },
  });
  return { status: response.status, body: await response.json() };
}

describe("GET /api/v1/readings/profile", () => {
  test("anonymous user receives 403", async () => {
    const response = await fetch(`${webserver.origin}/api/v1/readings/profile`);
    expect(response.status).toBe(403);
  });

  test("learns liked and disliked themes, authors and kinds", async () => {
    const { session } = await orchestrator.createUserActivateAndReturnSession();
    const liked = await orchestrator.createAuthor({ name: "Carlos de Laet" });
    const disliked = await orchestrator.createAuthor({ name: "Autor Chato" });

    for (let index = 0; index < 4; index++) {
      const reading = await orchestrator.createReading(liked, {
        kind: "crônica",
        themes: ["humor"],
      });
      await logReading(session, reading.id, { reaction: "liked" });
    }
    const boring = await orchestrator.createReading(disliked, {
      kind: "ensaio",
      themes: ["politica"],
    });
    await logReading(session, boring.id, { reaction: "disliked" });

    const { status, body } = await getJson(session, "/api/v1/readings/profile");

    expect(status).toBe(200);
    expect(body.signals).toBe(5);
    expect(body.likes.themes.map((item) => item.key)).toEqual(["humor"]);
    expect(body.likes.authors.map((item) => item.label)).toEqual([
      "Carlos de Laet",
    ]);
    expect(body.likes.kinds.map((item) => item.key)).toEqual(["crônica"]);
    expect(body.dislikes.themes.map((item) => item.key)).toEqual(["politica"]);
    expect(body.dislikes.authors.map((item) => item.label)).toEqual([
      "Autor Chato",
    ]);
  });

  test("recommendation follows the learned profile", async () => {
    const { session } = await orchestrator.createUserActivateAndReturnSession();
    const machado = await orchestrator.createAuthor({
      name: "Machado de Assis",
    });
    const other = await orchestrator.createAuthor({ name: "Outro Autor" });
    const recent = await orchestrator.createAuthor({ name: "Autor Recente" });

    for (let index = 0; index < 15; index++) {
      const reading = await orchestrator.createReading(machado, {
        themes: ["humor"],
      });
      await logReading(session, reading.id, { reaction: "liked" });
    }
    for (let index = 0; index < 3; index++) {
      const reading = await orchestrator.createReading(recent);
      await logReading(session, reading.id);
    }

    for (let index = 0; index < 5; index++) {
      await orchestrator.createReading(other);
    }
    const expected = await orchestrator.createReading(machado, {
      themes: ["humor"],
    });

    const { body } = await getJson(session, "/api/v1/readings/next");

    expect(body.id).toBe(expected.id);
    expect(body.reason).toBe("Você costuma gostar de Machado de Assis");
  });
});
