import orchestrator from "tests/orchestrator.js";
import webserver from "infra/webserver.js";

beforeAll(async () => {
  await orchestrator.waitForAllServices();
  await orchestrator.clearDatabase();
  await orchestrator.runPendingMigrations();
});

describe("GET /api/v1/readings/[reading_id]", () => {
  describe("Anonymous user", () => {
    test("receives 403", async () => {
      const response = await fetch(
        `${webserver.origin}/api/v1/readings/00000000-0000-4000-8000-000000000000`,
      );
      expect(response.status).toBe(403);
    });
  });

  describe("Authenticated user", () => {
    test("returns the reading with content and author details", async () => {
      const { session } =
        await orchestrator.createUserActivateAndReturnSession();
      const author = await orchestrator.createAuthor({
        name: "Alphonsus de Guimaraens",
        birth_year: 1870,
        death_year: 1921,
        bio: "Poeta simbolista mineiro.",
        image_url: "https://upload.wikimedia.org/foto.jpg",
        wikipedia_url: "https://pt.wikipedia.org/wiki/Alphonsus",
      });
      const reading = await orchestrator.createReading(author, {
        title: "Ismália",
        kind: "poema",
        content:
          "<p>Quando Ismália enlouqueceu,<br>Pôs-se na torre a sonhar...</p>",
        themes: ["morte"],
      });

      const response = await fetch(
        `${webserver.origin}/api/v1/readings/${reading.id}`,
        { headers: { Cookie: `session_id=${session.token}` } },
      );
      expect(response.status).toBe(200);

      const responseBody = await response.json();
      expect(responseBody).toEqual({
        id: reading.id,
        title: "Ismália",
        collection: null,
        url: "https://pt.wikisource.org/wiki/Teste",
        source: "wikisource",
        mode: "stored",
        content:
          "<p>Quando Ismália enlouqueceu,<br>Pôs-se na torre a sonhar...</p>",
        excerpt: "Conteúdo da leitura.",
        word_count: 200,
        reading_minutes: 1,
        kind: "poema",
        area: "literatura",
        tone: "leve",
        themes: ["morte"],
        year: null,
        part_number: null,
        part_total: null,
        reason: null,
        author: {
          name: "Alphonsus de Guimaraens",
          slug: author.slug,
          bio: "Poeta simbolista mineiro.",
          image_url: "https://upload.wikimedia.org/foto.jpg",
          wikipedia_url: "https://pt.wikipedia.org/wiki/Alphonsus",
          birth_year: 1870,
          death_year: 1921,
        },
      });
    });

    test("returns 404 for a reading that does not exist", async () => {
      const { session } =
        await orchestrator.createUserActivateAndReturnSession();

      const response = await fetch(
        `${webserver.origin}/api/v1/readings/00000000-0000-4000-8000-000000000000`,
        { headers: { Cookie: `session_id=${session.token}` } },
      );
      expect(response.status).toBe(404);
    });

    test("returns 404 for an invalid id", async () => {
      const { session } =
        await orchestrator.createUserActivateAndReturnSession();

      const response = await fetch(
        `${webserver.origin}/api/v1/readings/invalid-id`,
        { headers: { Cookie: `session_id=${session.token}` } },
      );
      expect(response.status).toBe(404);
    });

    test("returns 404 for a reading that was rejected", async () => {
      const { session } =
        await orchestrator.createUserActivateAndReturnSession();
      const author = await orchestrator.createAuthor();
      const reading = await orchestrator.createReading(author, {
        status: "rejected",
      });

      const response = await fetch(
        `${webserver.origin}/api/v1/readings/${reading.id}`,
        { headers: { Cookie: `session_id=${session.token}` } },
      );
      expect(response.status).toBe(404);
    });
  });
});
