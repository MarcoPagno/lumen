import orchestrator from "tests/orchestrator.js";
import webserver from "infra/webserver.js";

beforeAll(async () => {
  await orchestrator.waitForAllServices();
  await orchestrator.clearDatabase();
  await orchestrator.runPendingMigrations();
});

describe("GET /api/v1/readings/facets", () => {
  test("anonymous user receives 403", async () => {
    const response = await fetch(`${webserver.origin}/api/v1/readings/facets`);
    expect(response.status).toBe(403);
  });

  test("returns counts of authors, kinds, areas and sources", async () => {
    const { session } = await orchestrator.createUserActivateAndReturnSession();
    const author = await orchestrator.createAuthor({ name: "Cruz e Sousa" });
    await orchestrator.createReading(author, { kind: "poema" });
    await orchestrator.createReading(author, { kind: "poema" });
    await orchestrator.createReading(author, { kind: "conto" });

    const response = await fetch(`${webserver.origin}/api/v1/readings/facets`, {
      headers: { Cookie: `session_id=${session.token}` },
    });
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body.authors).toEqual([
      { slug: author.slug, name: "Cruz e Sousa", count: 3 },
    ]);
    expect(body.kinds).toEqual([
      { value: "poema", count: 2 },
      { value: "conto", count: 1 },
    ]);
    expect(body.areas).toEqual([{ value: "literatura", count: 3 }]);
    expect(body.sources).toEqual([{ value: "wikisource", count: 3 }]);
  });
});
