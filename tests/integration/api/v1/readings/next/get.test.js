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

async function getNext(session) {
  return await fetch(`${webserver.origin}/api/v1/readings/next`, {
    headers: { Cookie: `session_id=${session.token}` },
  });
}

async function logReading(session, readingId, status = "read") {
  await fetch(`${webserver.origin}/api/v1/reading-logs`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: `session_id=${session.token}`,
    },
    body: JSON.stringify({ reading_id: readingId, status }),
  });
}

describe("GET /api/v1/readings/next", () => {
  describe("Anonymous user", () => {
    test("receives 403", async () => {
      const response = await fetch(`${webserver.origin}/api/v1/readings/next`);
      expect(response.status).toBe(403);
    });
  });

  describe("Authenticated user", () => {
    test("returns 404 when there is no reading available", async () => {
      const { session } =
        await orchestrator.createUserActivateAndReturnSession();

      const response = await getNext(session);
      expect(response.status).toBe(404);
    });

    test("returns a reading with author and without content", async () => {
      const { session } =
        await orchestrator.createUserActivateAndReturnSession();
      const author = await orchestrator.createAuthor({
        name: "Machado de Assis",
      });
      const reading = await orchestrator.createReading(author, {
        title: "A Cartomante",
        themes: ["amor"],
      });

      const response = await getNext(session);
      expect(response.status).toBe(200);

      const responseBody = await response.json();
      expect(responseBody.id).toBe(reading.id);
      expect(responseBody.title).toBe("A Cartomante");
      expect(responseBody.content).toBeNull();
      expect(responseBody.reason).toBeNull();
      expect(responseBody.author.name).toBe("Machado de Assis");
      expect(responseBody.author.bio).toBe("Biografia de teste.");
    });

    test("ignores pending and rejected readings", async () => {
      const { session } =
        await orchestrator.createUserActivateAndReturnSession();
      const author = await orchestrator.createAuthor();
      await orchestrator.createReading(author, { status: "pending" });
      await orchestrator.createReading(author, { status: "rejected" });

      const response = await getNext(session);
      expect(response.status).toBe(404);
    });

    test("does not repeat readings already read or skipped", async () => {
      const { session } =
        await orchestrator.createUserActivateAndReturnSession();
      const author = await orchestrator.createAuthor();
      const first = await orchestrator.createReading(author);
      const second = await orchestrator.createReading(author);

      await logReading(session, first.id, "read");
      await logReading(session, second.id, "skipped");

      const response = await getNext(session);
      expect(response.status).toBe(404);
    });

    test("prefers readings related to the books being read", async () => {
      const { user, session } =
        await orchestrator.createUserActivateAndReturnSession();
      const author = await orchestrator.createAuthor();
      await orchestrator.createBook(user, {
        title: "O Século do Nada",
        themes: ["igreja", "modernidade"],
      });

      for (let index = 0; index < 5; index++) {
        await orchestrator.createReading(author, { themes: ["amor"] });
      }
      const related = await orchestrator.createReading(author, {
        title: "A Igreja e o mundo moderno",
        themes: ["igreja", "modernidade"],
      });

      const response = await getNext(session);
      const responseBody = await response.json();

      expect(responseBody.id).toBe(related.id);
      expect(responseBody.reason).toBe(
        'Relacionada a "O Século do Nada": Igreja, Modernidade',
      );
    });

    test("ignores books already finished", async () => {
      const { user, session } =
        await orchestrator.createUserActivateAndReturnSession();
      const author = await orchestrator.createAuthor();
      await orchestrator.createBook(user, {
        title: "Livro terminado",
        themes: ["igreja"],
        status: "finished",
      });
      await orchestrator.createReading(author, { themes: ["igreja"] });

      const responseBody = await (await getNext(session)).json();
      expect(responseBody.reason).toBeNull();
    });

    test("prefers readings by the author of a book being read", async () => {
      const { user, session } =
        await orchestrator.createUserActivateAndReturnSession();
      const otherAuthor = await orchestrator.createAuthor();
      const corcao = await orchestrator.createAuthor({
        name: "Gustavo Corção",
      });
      await orchestrator.createBook(user, {
        title: "Lições de Abismo",
        author_name: "Corção",
      });

      for (let index = 0; index < 5; index++) {
        await orchestrator.createReading(otherAuthor);
      }
      const fromAuthor = await orchestrator.createReading(corcao);

      const responseBody = await (await getNext(session)).json();
      expect(responseBody.id).toBe(fromAuthor.id);
      expect(responseBody.reason).toBe('Do mesmo autor de "Lições de Abismo"');
    });

    test("prefers readings added by the user", async () => {
      const { session } =
        await orchestrator.createUserActivateAndReturnSession();
      const author = await orchestrator.createAuthor();

      for (let index = 0; index < 5; index++) {
        await orchestrator.createReading(author);
      }
      const added = await orchestrator.createReading(author, {
        source: "link",
      });

      const responseBody = await (await getNext(session)).json();
      expect(responseBody.id).toBe(added.id);
      expect(responseBody.reason).toBe("Adicionado por você");
    });

    test("only offers the next part of a series after the previous one is read", async () => {
      const { session } =
        await orchestrator.createUserActivateAndReturnSession();
      const author = await orchestrator.createAuthor();
      const seriesId = randomUUID();
      const partOne = await orchestrator.createReading(author, {
        title: "Sermão da Sexagésima",
        series_id: seriesId,
        part_number: 1,
        part_total: 2,
      });
      const partTwo = await orchestrator.createReading(author, {
        title: "Sermão da Sexagésima",
        series_id: seriesId,
        part_number: 2,
        part_total: 2,
      });

      const firstBody = await (await getNext(session)).json();
      expect(firstBody.id).toBe(partOne.id);

      for (let index = 0; index < 5; index++) {
        await orchestrator.createReading(author);
      }
      await logReading(session, partOne.id, "read");

      const secondBody = await (await getNext(session)).json();
      expect(secondBody.id).toBe(partTwo.id);
      expect(secondBody.reason).toBe("Continuação: parte 2 de 2");
    });
  });
});
