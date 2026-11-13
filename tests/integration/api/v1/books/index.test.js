import orchestrator from "tests/orchestrator.js";
import webserver from "infra/webserver.js";

beforeAll(async () => {
  await orchestrator.waitForAllServices();
  await orchestrator.clearDatabase();
  await orchestrator.runPendingMigrations();
});

async function postBook(session, body) {
  return await fetch(`${webserver.origin}/api/v1/books`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: `session_id=${session.token}`,
    },
    body: JSON.stringify(body),
  });
}

describe("/api/v1/books", () => {
  describe("Anonymous user", () => {
    test("receives 403 on GET", async () => {
      const response = await fetch(`${webserver.origin}/api/v1/books`);
      expect(response.status).toBe(403);
    });

    test("receives 403 on POST", async () => {
      const response = await fetch(`${webserver.origin}/api/v1/books`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "Livro" }),
      });
      expect(response.status).toBe(403);
    });
  });

  describe("Authenticated user", () => {
    test("POST creates a book keeping the chosen themes", async () => {
      const { session } =
        await orchestrator.createUserActivateAndReturnSession();

      const response = await postBook(session, {
        title: "  Tratado da Verdadeira Devoção  ",
        author_name: "São Luís Maria Grignion de Montfort",
        themes: ["nossa-senhora", "oracao"],
      });
      expect(response.status).toBe(201);

      const responseBody = await response.json();
      expect(responseBody.title).toBe("Tratado da Verdadeira Devoção");
      expect(responseBody.status).toBe("reading");
      expect(responseBody.themes).toEqual(
        expect.arrayContaining(["nossa-senhora", "oracao"]),
      );
    });

    test("POST detects themes from the title", async () => {
      const { session } =
        await orchestrator.createUserActivateAndReturnSession();

      const responseBody = await (
        await postBook(session, { title: "Teologia da Eucaristia" })
      ).json();
      expect(responseBody.themes).toEqual(
        expect.arrayContaining(["eucaristia", "fe-e-razao"]),
      );
    });

    test("POST with an invalid theme returns 400", async () => {
      const { session } =
        await orchestrator.createUserActivateAndReturnSession();

      const response = await postBook(session, {
        title: "Livro",
        themes: ["tema-inexistente"],
      });
      expect(response.status).toBe(400);
    });

    test("POST with a short title returns 400", async () => {
      const { session } =
        await orchestrator.createUserActivateAndReturnSession();

      const response = await postBook(session, { title: "A" });
      expect(response.status).toBe(400);
    });

    test("GET returns only the user's books", async () => {
      const { user, session } =
        await orchestrator.createUserActivateAndReturnSession();
      const { user: otherUser } =
        await orchestrator.createUserActivateAndReturnSession();
      await orchestrator.createBook(user, { title: "Meu livro" });
      await orchestrator.createBook(otherUser, { title: "Livro de outro" });

      const response = await fetch(`${webserver.origin}/api/v1/books`, {
        headers: { Cookie: `session_id=${session.token}` },
      });
      expect(response.status).toBe(200);

      const responseBody = await response.json();
      expect(responseBody.map((book) => book.title)).toEqual(["Meu livro"]);
    });
  });
});
