import { version as uuidVersion } from "uuid";
import orchestrator from "tests/orchestrator.js";
import webserver from "infra/webserver.js";
import reviewModel from "models/review.js";

beforeAll(async () => {
  await orchestrator.waitForAllServices();
  await orchestrator.clearDatabase();
  await orchestrator.runPendingMigrations();
});

describe("POST /api/v1/topics", () => {
  describe("Anonymous user", () => {
    test("receives 403", async () => {
      const response = await fetch(`${webserver.origin}/api/v1/topics`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: "Anonymous topic",
          initial_explanation: "Explicação",
        }),
      });
      expect(response.status).toBe(403);
    });
  });

  describe("Authenticated user", () => {
    test("creates a topic and schedules the full fixed-interval review cycle", async () => {
      const { session } =
        await orchestrator.createUserActivateAndReturnSession();

      const response = await fetch(`${webserver.origin}/api/v1/topics`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: `session_id=${session.token}`,
        },
        body: JSON.stringify({
          title: "Lei da Gravitação Universal",
          source: "Livro X, capítulo 3",
          initial_explanation: "Toda massa atrai toda massa...",
        }),
      });
      expect(response.status).toBe(201);

      const responseBody = await response.json();

      expect(responseBody).toEqual({
        id: responseBody.id,
        title: "Lei da Gravitação Universal",
        source: "Livro X, capítulo 3",
        studied_at: responseBody.studied_at,
        status: "active",
        created_at: responseBody.created_at,
        updated_at: responseBody.updated_at,
      });
      expect(uuidVersion(responseBody.id)).toBe(4);

      const reviews = await orchestrator.findReviewsByTopic(responseBody.id);
      expect(reviews).toHaveLength(6);

      const byType = Object.fromEntries(
        reviews.map((review) => [
          review.type,
          reviews.filter((r) => r.type === review.type),
        ]),
      );

      expect(byType.initial_study).toHaveLength(1);
      expect(byType.initial_study[0].scheduled_date).toBe(
        responseBody.studied_at,
      );
      expect(byType.initial_study[0].completed_at).not.toBeNull();
      expect(byType.initial_study[0].content).toBe(
        "Toda massa atrai toda massa...",
      );

      expect(byType.daily).toHaveLength(3);
      expect(byType.daily.every((review) => review.completed_at === null)).toBe(
        true,
      );
      const dailyDates = byType.daily.map((r) => r.scheduled_date).sort();
      expect(dailyDates).toEqual([
        reviewModel.addDays(responseBody.studied_at, 1),
        reviewModel.addDays(responseBody.studied_at, 2),
        reviewModel.addDays(responseBody.studied_at, 3),
      ]);

      expect(byType.weekly).toHaveLength(1);
      expect(byType.weekly[0].scheduled_date).toBe(
        reviewModel.getEndOfWeekSunday(responseBody.studied_at),
      );
      expect(byType.weekly[0].completed_at).toBeNull();

      expect(byType.monthly).toHaveLength(1);
      expect(byType.monthly[0].scheduled_date).toBe(
        reviewModel.getEndOfMonth(responseBody.studied_at),
      );
      expect(byType.monthly[0].completed_at).toBeNull();
      expect(byType.monthly[0].promoted).toBeNull();
    });

    test("returns 400 when `title` is too short", async () => {
      const { session } =
        await orchestrator.createUserActivateAndReturnSession();

      const response = await fetch(`${webserver.origin}/api/v1/topics`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: `session_id=${session.token}`,
        },
        body: JSON.stringify({
          title: "Ab",
          initial_explanation: "Explicação",
        }),
      });
      expect(response.status).toBe(400);

      const responseBody = await response.json();
      expect(responseBody).toEqual({
        name: "ValidationError",
        message: "Title must have at least 3 characters",
        action: "Provide a valid title for the topic",
        status_code: 400,
      });
    });

    test("returns 400 and creates no topic when `initial_explanation` is missing", async () => {
      const { session } =
        await orchestrator.createUserActivateAndReturnSession();

      const response = await fetch(`${webserver.origin}/api/v1/topics`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: `session_id=${session.token}`,
        },
        body: JSON.stringify({
          title: "Tema sem explicação",
        }),
      });
      expect(response.status).toBe(400);

      const responseBody = await response.json();
      expect(responseBody).toEqual({
        name: "ValidationError",
        message: "Explanation is required",
        action: "Write your explanation from memory before saving",
        status_code: 400,
      });

      const listResponse = await fetch(`${webserver.origin}/api/v1/topics`, {
        headers: { Cookie: `session_id=${session.token}` },
      });
      const topics = await listResponse.json();
      expect(
        topics.find((topic) => topic.title === "Tema sem explicação"),
      ).toBe(undefined);
    });
  });
});
