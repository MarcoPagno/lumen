import orchestrator from "tests/orchestrator.js";
import webserver from "infra/webserver.js";

beforeAll(async () => {
  await orchestrator.waitForAllServices();
});

describe("GET /api/v1/readings/imports/cron", () => {
  test("returns 401 without credentials", async () => {
    const response = await fetch(
      `${webserver.origin}/api/v1/readings/imports/cron`,
    );
    expect(response.status).toBe(401);
  });

  test("returns 401 with a wrong secret", async () => {
    const response = await fetch(
      `${webserver.origin}/api/v1/readings/imports/cron`,
      { headers: { Authorization: "Bearer wrong-secret" } },
    );
    expect(response.status).toBe(401);
  });
});
