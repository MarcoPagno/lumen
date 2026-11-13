import orchestrator from "tests/orchestrator.js";
import webserver from "infra/webserver.js";

beforeAll(async () => {
  await orchestrator.waitForAllServices();
  await orchestrator.clearDatabase();
  await orchestrator.runPendingMigrations();
});

async function patchBook(session, bookId, body) {
  return await fetch(`${webserver.origin}/api/v1/books/${bookId}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      ...(session && { Cookie: `session_id=${session.token}` }),
    },
    body: JSON.stringify(body),
  });
}

describe("PATCH /api/v1/books/[book_id]", () => {
  describe("Anonymous user", () => {
    test("receives 403", async () => {
      const response = await patchBook(
        null,
        "00000000-0000-4000-8000-000000000000",
        { status: "finished" },
      );
      expect(response.status).toBe(403);
    });
  });

  describe("Authenticated user", () => {
    test("marks a book as finished", async () => {
      const { user, session } =
        await orchestrator.createUserActivateAndReturnSession();
      const book = await orchestrator.createBook(user, {
        themes: ["igreja"],
      });

      const response = await patchBook(session, book.id, {
        status: "finished",
      });
      expect(response.status).toBe(200);

      const responseBody = await response.json();
      expect(responseBody.status).toBe("finished");
      expect(responseBody.themes).toEqual(["igreja"]);
    });

    test("updates the themes of a book", async () => {
      const { user, session } =
        await orchestrator.createUserActivateAndReturnSession();
      const book = await orchestrator.createBook(user);

      const responseBody = await (
        await patchBook(session, book.id, { themes: ["metafisica"] })
      ).json();
      expect(responseBody.themes).toEqual(["metafisica"]);
      expect(responseBody.status).toBe("reading");
    });

    test("returns 400 for an invalid status", async () => {
      const { user, session } =
        await orchestrator.createUserActivateAndReturnSession();
      const book = await orchestrator.createBook(user);

      const response = await patchBook(session, book.id, {
        status: "abandoned",
      });
      expect(response.status).toBe(400);
    });

    test("returns 404 for a book that belongs to another user", async () => {
      const { user: otherUser } =
        await orchestrator.createUserActivateAndReturnSession();
      const { session } =
        await orchestrator.createUserActivateAndReturnSession();
      const book = await orchestrator.createBook(otherUser);

      const response = await patchBook(session, book.id, {
        status: "finished",
      });
      expect(response.status).toBe(404);
    });
  });
});
