import { randomUUID } from "node:crypto";
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

async function listReadings(session, query = "") {
  const response = await fetch(`${webserver.origin}/api/v1/readings?${query}`, {
    headers: { Cookie: `session_id=${session.token}` },
  });
  return { status: response.status, body: await response.json() };
}

async function logRead(session, readingId) {
  await fetch(`${webserver.origin}/api/v1/reading-logs`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: `session_id=${session.token}`,
    },
    body: JSON.stringify({ reading_id: readingId, status: "read" }),
  });
}

async function favorite(session, readingId) {
  await fetch(`${webserver.origin}/api/v1/readings/${readingId}/favorite`, {
    method: "PUT",
    headers: { Cookie: `session_id=${session.token}` },
  });
}

describe("GET /api/v1/readings", () => {
  test("anonymous user receives 403", async () => {
    const response = await fetch(`${webserver.origin}/api/v1/readings`);
    expect(response.status).toBe(403);
  });

  test("lists ready readings ordered by author and title", async () => {
    const { session } = await orchestrator.createUserActivateAndReturnSession();
    const machado = await orchestrator.createAuthor({
      name: "Machado de Assis",
    });
    const bilac = await orchestrator.createAuthor({ name: "Olavo Bilac" });
    await orchestrator.createReading(machado, { title: "O Alienista" });
    await orchestrator.createReading(machado, { title: "A Cartomante" });
    await orchestrator.createReading(bilac, { title: "Via Láctea" });
    await orchestrator.createReading(bilac, { status: "pending" });

    const { status, body } = await listReadings(session);

    expect(status).toBe(200);
    expect(body.total).toBe(3);
    expect(body.items.map((item) => item.title)).toEqual([
      "A Cartomante",
      "O Alienista",
      "Via Láctea",
    ]);
    expect(body.items[0]).toEqual(
      expect.objectContaining({
        author: { name: "Machado de Assis", slug: machado.slug },
        is_favorite: false,
        read_parts: 0,
      }),
    );
    expect(body.items[0].content).toBeUndefined();
  });

  test("shows a series only once with total minutes and progress", async () => {
    const { session } = await orchestrator.createUserActivateAndReturnSession();
    const author = await orchestrator.createAuthor();
    const seriesId = randomUUID();
    const partOne = await orchestrator.createReading(author, {
      title: "Sermão da Sexagésima",
      series_id: seriesId,
      part_number: 1,
      part_total: 2,
      reading_minutes: 8,
    });
    await orchestrator.createReading(author, {
      title: "Sermão da Sexagésima",
      series_id: seriesId,
      part_number: 2,
      part_total: 2,
      reading_minutes: 7,
    });
    await logRead(session, partOne.id);

    const { body } = await listReadings(session);

    expect(body.total).toBe(1);
    expect(body.items[0]).toEqual(
      expect.objectContaining({
        id: partOne.id,
        part_total: 2,
        total_minutes: 15,
        read_parts: 1,
      }),
    );
  });

  test("searches title, collection and author ignoring accents", async () => {
    const { session } = await orchestrator.createUserActivateAndReturnSession();
    const author = await orchestrator.createAuthor({ name: "Padre Vieira" });
    await orchestrator.createReading(author, {
      title: "Sermão de Santo António",
    });
    await orchestrator.createReading(author, { title: "Outro texto" });

    const byTitle = await listReadings(session, "search=sermao");
    expect(byTitle.body.items.map((item) => item.title)).toEqual([
      "Sermão de Santo António",
    ]);

    const byAuthor = await listReadings(session, "search=VIEIRA");
    expect(byAuthor.body.total).toBe(2);
  });

  test("filters by author, kind, area, theme and source", async () => {
    const { session } = await orchestrator.createUserActivateAndReturnSession();
    const machado = await orchestrator.createAuthor({ name: "Machado" });
    const vieira = await orchestrator.createAuthor({ name: "Vieira" });
    await orchestrator.createReading(machado, {
      title: "Conto",
      kind: "conto",
      area: "literatura",
      themes: ["amor"],
    });
    await orchestrator.createReading(vieira, {
      title: "Sermão",
      kind: "sermão",
      area: "teologia",
      themes: ["eucaristia"],
      source: "vatican",
    });

    const checks = [
      [`author=${vieira.slug}`, ["Sermão"]],
      ["kind=conto", ["Conto"]],
      ["area=teologia", ["Sermão"]],
      ["theme=amor", ["Conto"]],
      ["source=vatican", ["Sermão"]],
    ];

    for (const [query, titles] of checks) {
      const { body } = await listReadings(session, query);
      expect(body.items.map((item) => item.title)).toEqual(titles);
    }
  });

  test("filters by read status and favorites", async () => {
    const { session } = await orchestrator.createUserActivateAndReturnSession();
    const author = await orchestrator.createAuthor();
    const read = await orchestrator.createReading(author, { title: "Lido" });
    await orchestrator.createReading(author, { title: "Não lido" });
    const favorite1 = await orchestrator.createReading(author, {
      title: "Favorito",
    });

    await logRead(session, read.id);
    await favorite(session, favorite1.id);

    const titles = async (query) =>
      (await listReadings(session, query)).body.items.map((item) => item.title);

    expect(await titles("status=read")).toEqual(["Lido"]);
    expect(await titles("status=unread")).toEqual(["Favorito", "Não lido"]);
    expect(await titles("status=favorites")).toEqual(["Favorito"]);
  });

  test("paginates results", async () => {
    const { session } = await orchestrator.createUserActivateAndReturnSession();
    const author = await orchestrator.createAuthor();
    for (let index = 0; index < 32; index++) {
      await orchestrator.createReading(author, {
        title: `Texto ${String(index).padStart(2, "0")}`,
      });
    }

    const first = await listReadings(session);
    const second = await listReadings(session, "page=2");

    expect(first.body.total).toBe(32);
    expect(first.body.items).toHaveLength(30);
    expect(second.body.items.map((item) => item.title)).toEqual([
      "Texto 30",
      "Texto 31",
    ]);
  });
});
