import orchestrator from "tests/orchestrator.js";
import webserver from "infra/webserver.js";

beforeAll(async () => {
  await orchestrator.waitForAllServices();
  await orchestrator.clearDatabase();
  await orchestrator.runPendingMigrations();
});

describe("/api/v1/readings/imports", () => {
  describe("Anonymous user", () => {
    test("receives 403 on GET", async () => {
      const response = await fetch(
        `${webserver.origin}/api/v1/readings/imports`,
      );
      expect(response.status).toBe(403);
    });

    test("receives 403 on POST", async () => {
      const response = await fetch(
        `${webserver.origin}/api/v1/readings/imports`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ source: "wikisource" }),
        },
      );
      expect(response.status).toBe(403);
    });
  });

  describe("Default activated user", () => {
    test("receives 403 without the import feature", async () => {
      const { session } =
        await orchestrator.createUserActivateAndReturnSession();

      const response = await fetch(
        `${webserver.origin}/api/v1/readings/imports`,
        { headers: { Cookie: `session_id=${session.token}` } },
      );
      expect(response.status).toBe(403);
    });
  });

  describe("User with import feature", () => {
    test("GET lists the sources with their stats", async () => {
      const { user, session } =
        await orchestrator.createUserActivateAndReturnSession();
      await orchestrator.addFeaturesToUser(user, ["create:reading_import"]);

      const response = await fetch(
        `${webserver.origin}/api/v1/readings/imports`,
        { headers: { Cookie: `session_id=${session.token}` } },
      );
      expect(response.status).toBe(200);

      const responseBody = await response.json();
      expect(responseBody.map((source) => source.source)).toEqual([
        "wikisource",
        "vatican",
        "permanencia",
        "escritas",
        "olavo",
      ]);
      expect(responseBody[0].stats).toEqual({
        pending: 0,
        ready: 0,
        rejected: 0,
        total: 0,
      });
      expect(responseBody[0].authors).toContain("Machado de Assis");
    });

    test("POST with an invalid source returns 400", async () => {
      const { user, session } =
        await orchestrator.createUserActivateAndReturnSession();
      await orchestrator.addFeaturesToUser(user, ["create:reading_import"]);

      const response = await fetch(
        `${webserver.origin}/api/v1/readings/imports`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Cookie: `session_id=${session.token}`,
          },
          body: JSON.stringify({ source: "invalid" }),
        },
      );
      expect(response.status).toBe(400);

      const responseBody = await response.json();
      expect(responseBody.message).toBe("Invalid import source");
    });
  });
});
