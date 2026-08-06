import orchestrator from "tests/orchestrator.js";
import webserver from "infra/webserver.js";
import reviewModel from "models/review.js";

beforeAll(async () => {
  await orchestrator.waitForAllServices();
  await orchestrator.clearDatabase();
  await orchestrator.runPendingMigrations();
});

describe("GET /api/v1/topics/queue", () => {
  describe("Anonymous user", () => {
    test("receives 403", async () => {
      const response = await fetch(`${webserver.origin}/api/v1/topics/queue`);
      expect(response.status).toBe(403);
    });
  });

  describe("Authenticated user", () => {
    test("returns an empty queue when nothing is due", async () => {
      const { user, session } =
        await orchestrator.createUserActivateAndReturnSession();

      await orchestrator.createTopic(user, {
        title: "Tema sem revisões vencidas",
      });

      const response = await fetch(`${webserver.origin}/api/v1/topics/queue`, {
        headers: { Cookie: `session_id=${session.token}` },
      });
      expect(response.status).toBe(200);

      const responseBody = await response.json();
      expect(responseBody).toEqual({
        queue: [],
        fundamental_active_count: 0,
      });
    });

    test("includes overdue reviews and deduplicates by topic, keeping the highest-level type", async () => {
      const { user, session } =
        await orchestrator.createUserActivateAndReturnSession();

      const topic = await orchestrator.createTopic(user, {
        title: "Tema com diária e semanal vencidas no mesmo dia",
      });
      const reviews = await orchestrator.findReviewsByTopic(topic.id);
      const daily = reviews.find((r) => r.type === "daily");
      const weekly = reviews.find((r) => r.type === "weekly");

      const today = new Date().toISOString().slice(0, 10);
      const yesterday = reviewModel.addDays(today, -1);

      // Simulate both a daily and the weekly review being overdue on the
      // same day for the same topic.
      await orchestrator.setReviewScheduledDate(daily.id, yesterday);
      await orchestrator.setReviewScheduledDate(weekly.id, today);

      const response = await fetch(`${webserver.origin}/api/v1/topics/queue`, {
        headers: { Cookie: `session_id=${session.token}` },
      });
      expect(response.status).toBe(200);

      const responseBody = await response.json();
      const itemsForTopic = responseBody.queue.filter(
        (item) => item.topic_id === topic.id,
      );

      expect(itemsForTopic).toHaveLength(1);
      expect(itemsForTopic[0]).toEqual({
        review_id: weekly.id,
        topic_id: topic.id,
        type: "weekly",
        scheduled_date: today,
        title: topic.title,
      });
    });

    test("does not include reviews scheduled in the future", async () => {
      const { user, session } =
        await orchestrator.createUserActivateAndReturnSession();

      const topic = await orchestrator.createTopic(user, {
        title: "Tema totalmente no futuro",
      });

      const response = await fetch(`${webserver.origin}/api/v1/topics/queue`, {
        headers: { Cookie: `session_id=${session.token}` },
      });
      const responseBody = await response.json();

      expect(
        responseBody.queue.some((item) => item.topic_id === topic.id),
      ).toBe(false);
    });

    test("does not include another user's reviews", async () => {
      const { user: userA } =
        await orchestrator.createUserActivateAndReturnSession();
      const { session: sessionB } =
        await orchestrator.createUserActivateAndReturnSession();

      const topicA = await orchestrator.createTopic(userA, {
        title: "Tema do usuário A",
      });
      const reviewsA = await orchestrator.findReviewsByTopic(topicA.id);
      const dailyA = reviewsA.find((r) => r.type === "daily");
      await orchestrator.setReviewScheduledDate(
        dailyA.id,
        new Date().toISOString().slice(0, 10),
      );

      const response = await fetch(`${webserver.origin}/api/v1/topics/queue`, {
        headers: { Cookie: `session_id=${sessionB.token}` },
      });
      const responseBody = await response.json();

      expect(
        responseBody.queue.some((item) => item.topic_id === topicA.id),
      ).toBe(false);
    });
  });
});
