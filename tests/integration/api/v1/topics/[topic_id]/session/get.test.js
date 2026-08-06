import orchestrator from "tests/orchestrator.js";
import webserver from "infra/webserver.js";

beforeAll(async () => {
  await orchestrator.waitForAllServices();
  await orchestrator.clearDatabase();
  await orchestrator.runPendingMigrations();
});

describe("GET /api/v1/topics/[topic_id]/session", () => {
  describe("Anonymous user", () => {
    test("receives 403", async () => {
      const response = await fetch(
        `${webserver.origin}/api/v1/topics/00000000-0000-4000-8000-000000000000/session`,
      );
      expect(response.status).toBe(403);
    });
  });

  describe("Authenticated user", () => {
    test("returns the due review type and title without revealing source or previous explanations", async () => {
      const { user, session } =
        await orchestrator.createUserActivateAndReturnSession();

      const topic = await orchestrator.createTopic(user, {
        title: "Tema com revisão diária vencida",
        source: "Fonte secreta",
      });
      const reviews = await orchestrator.findReviewsByTopic(topic.id);
      const daily = reviews.find((r) => r.type === "daily");
      await orchestrator.setReviewScheduledDate(
        daily.id,
        new Date().toISOString().slice(0, 10),
      );

      const response = await fetch(
        `${webserver.origin}/api/v1/topics/${topic.id}/session`,
        { headers: { Cookie: `session_id=${session.token}` } },
      );
      expect(response.status).toBe(200);

      const responseBody = await response.json();
      expect(responseBody).toEqual({
        topic_id: topic.id,
        title: "Tema com revisão diária vencida",
        type: "daily",
        angle: responseBody.angle,
      });
      expect(responseBody.source).toBeUndefined();
    });

    test("returns 404 when no review is due for the topic", async () => {
      const { user, session } =
        await orchestrator.createUserActivateAndReturnSession();

      const topic = await orchestrator.createTopic(user, {
        title: "Tema sem revisão vencida",
      });

      const response = await fetch(
        `${webserver.origin}/api/v1/topics/${topic.id}/session`,
        { headers: { Cookie: `session_id=${session.token}` } },
      );
      expect(response.status).toBe(404);
    });

    test("returns 404 for a topic that belongs to another user", async () => {
      const { user: userA } =
        await orchestrator.createUserActivateAndReturnSession();
      const { session: sessionB } =
        await orchestrator.createUserActivateAndReturnSession();

      const topicA = await orchestrator.createTopic(userA, {
        title: "Tema do usuário A",
      });

      const response = await fetch(
        `${webserver.origin}/api/v1/topics/${topicA.id}/session`,
        { headers: { Cookie: `session_id=${sessionB.token}` } },
      );
      expect(response.status).toBe(404);
    });
  });
});
