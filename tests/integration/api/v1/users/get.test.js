import orchestrator from "tests/orchestrator.js";

beforeAll(async () => {
  await orchestrator.waitForAllServices();
  await orchestrator.clearDatabase();
  await orchestrator.runPendingMigrations();
});

describe("GET /api/v1/users/[username]", () => {
  describe("Anonymous user", () => {
    test("returns user when username matches exactly", async () => {
      const response1 = await fetch("http://localhost:3000/api/v1/users", {
        method: "POST",
        type: "application/json",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          username: "testSearch",
          email: "testSearch@gmail.com",
          password: "password123",
        }),
      });
      expect(response1.status).toBe(201);

      const response = await fetch(
        "http://localhost:3000/api/v1/users/testSearch",
        {
          method: "GET",
        },
      );
      expect(response.status).toBe(200);

      const responseBody = await response.json();

      expect(responseBody).toEqual({
        id: responseBody.id,
        username: "testSearch",
        email: "testSearch@gmail.com",
        password: "password123",
        created_at: responseBody.created_at,
        updated_at: responseBody.updated_at,
      });
    });

    test("returns user when username matches ignoring case", async () => {
      const response1 = await fetch("http://localhost:3000/api/v1/users", {
        method: "POST",
        type: "application/json",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          username: "testSearchCase",
          email: "testSearchCase@gmail.com",
          password: "password123",
        }),
      });
      expect(response1.status).toBe(201);

      const response = await fetch(
        "http://localhost:3000/api/v1/users/TestSearchCASE",
        {
          method: "GET",
        },
      );
      expect(response.status).toBe(200);

      const responseBody = await response.json();

      expect(responseBody).toEqual({
        id: responseBody.id,
        username: "testSearchCase",
        email: "testSearchCase@gmail.com",
        password: "password123",
        created_at: responseBody.created_at,
        updated_at: responseBody.updated_at,
      });
    });

    test("returns 404 when username does not exist", async () => {
      const response = await fetch(
        "http://localhost:3000/api/v1/users/testNotFoundUser",
        {
          method: "GET",
        },
      );
      expect(response.status).toBe(404);

      const responseBody = await response.json();

      expect(responseBody).toEqual({
        name: "NotFoundError",
        message: "User not found",
        action: "Check for typos or verify the identifier",
        status_code: 404,
      });
    });
  });
});
