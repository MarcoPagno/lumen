import { version as uuidVersion } from "uuid";
import orchestrator from "tests/orchestrator.js";

beforeAll(async () => {
  await orchestrator.waitForAllServices();
  await orchestrator.clearDatabase();
  await orchestrator.runPendingMigrations();
});

describe("POST /api/v1/users", () => {
  describe("Anonymous user", () => {
    test("creates user with valid and unique data", async () => {
      const response = await fetch("http://localhost:3000/api/v1/users", {
        method: "POST",
        type: "application/json",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          username: "test",
          email: "test@gmail.com",
          password: "password123",
        }),
      });
      expect(response.status).toBe(201);

      const responseBody = await response.json();
      expect(responseBody).toEqual({
        id: responseBody.id,
        username: "test",
        email: "test@gmail.com",
        password: "password123",
        created_at: responseBody.created_at,
        updated_at: responseBody.updated_at,
      });

      expect(uuidVersion(responseBody.id)).toBe(4);
      expect(Date.parse(responseBody.created_at)).not.toBeNaN();
      expect(Date.parse(responseBody.updated_at)).not.toBeNaN();
    });

    test("fails when username is already in use", async () => {
      const response1 = await fetch("http://localhost:3000/api/v1/users", {
        method: "POST",
        type: "application/json",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          username: "testUsername",
          email: "testUsername@gmail.com",
          password: "password123",
        }),
      });
      expect(response1.status).toBe(201);

      const response = await fetch("http://localhost:3000/api/v1/users", {
        method: "POST",
        type: "application/json",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          username: "TestUsername",
          email: "testUsername2@gmail.com",
          password: "password123",
        }),
      });
      expect(response.status).toBe(400);

      const responseBody = await response.json();
      expect(responseBody).toEqual({
        name: "ValidationError",
        message: "Username already in use",
        action: "Choose a different username",
        status_code: 400,
      });
    });

    test("fails when email is already in use", async () => {
      const response1 = await fetch("http://localhost:3000/api/v1/users", {
        method: "POST",
        type: "application/json",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          username: "testEmail1",
          email: "testEmail@gmail.com",
          password: "password123",
        }),
      });
      expect(response1.status).toBe(201);

      const response = await fetch("http://localhost:3000/api/v1/users", {
        method: "POST",
        type: "application/json",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          username: "testEmail2",
          email: "TestEmail@gmail.com",
          password: "password123",
        }),
      });
      expect(response.status).toBe(400);

      const responseBody = await response.json();
      expect(responseBody).toEqual({
        name: "ValidationError",
        message: "Email already in use",
        action: "Use a different email address",
        status_code: 400,
      });
    });
  });
});
