import orchestrator from "tests/orchestrator.js";
import webserver from "infra/webserver.js";
import reviewModel from "models/review.js";

beforeAll(async () => {
  await orchestrator.waitForAllServices();
  await orchestrator.clearDatabase();
  await orchestrator.runPendingMigrations();
});

async function markDue(reviewId, dateOnlyString) {
  await orchestrator.setReviewScheduledDate(reviewId, dateOnlyString);
}

describe("POST /api/v1/topics/[topic_id]/reviews", () => {
  describe("Anonymous user", () => {
    test("receives 403", async () => {
      const response = await fetch(
        `${webserver.origin}/api/v1/topics/00000000-0000-4000-8000-000000000000/reviews`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content: "conteúdo" }),
        },
      );
      expect(response.status).toBe(403);
    });
  });

  describe("Authenticated user", () => {
    test("completes every overdue review of the topic with the same content", async () => {
      const { user, session } =
        await orchestrator.createUserActivateAndReturnSession();

      const topic = await orchestrator.createTopic(user, {
        title: "Tema com diária e semanal no mesmo dia",
      });
      const reviews = await orchestrator.findReviewsByTopic(topic.id);
      const daily = reviews.find((r) => r.type === "daily");
      const weekly = reviews.find((r) => r.type === "weekly");
      const today = new Date().toISOString().slice(0, 10);

      await markDue(daily.id, today);
      await markDue(weekly.id, today);

      const response = await fetch(
        `${webserver.origin}/api/v1/topics/${topic.id}/reviews`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Cookie: `session_id=${session.token}`,
          },
          body: JSON.stringify({ content: "Minha explicação de memória" }),
        },
      );
      expect(response.status).toBe(200);

      const responseBody = await response.json();
      const completedNow = responseBody.reviews.filter((review) =>
        [daily.id, weekly.id].includes(review.id),
      );
      expect(completedNow).toHaveLength(2);
      completedNow.forEach((review) => {
        expect(review.content).toBe("Minha explicação de memória");
        expect(review.completed_at).not.toBeNull();
      });

      const queueResponse = await fetch(
        `${webserver.origin}/api/v1/topics/queue`,
        { headers: { Cookie: `session_id=${session.token}` } },
      );
      const queueBody = await queueResponse.json();
      expect(queueBody.queue.some((item) => item.topic_id === topic.id)).toBe(
        false,
      );
    });

    test("returns 400 when `content` is missing", async () => {
      const { user, session } =
        await orchestrator.createUserActivateAndReturnSession();

      const topic = await orchestrator.createTopic(user, {
        title: "Tema sem conteúdo enviado",
      });
      const reviews = await orchestrator.findReviewsByTopic(topic.id);
      const daily = reviews.find((r) => r.type === "daily");
      await markDue(daily.id, new Date().toISOString().slice(0, 10));

      const response = await fetch(
        `${webserver.origin}/api/v1/topics/${topic.id}/reviews`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Cookie: `session_id=${session.token}`,
          },
          body: JSON.stringify({}),
        },
      );
      expect(response.status).toBe(400);
    });

    test("returns 404 when there is no review due for the topic", async () => {
      const { user, session } =
        await orchestrator.createUserActivateAndReturnSession();

      const topic = await orchestrator.createTopic(user, {
        title: "Tema sem nada vencido",
      });

      const response = await fetch(
        `${webserver.origin}/api/v1/topics/${topic.id}/reviews`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Cookie: `session_id=${session.token}`,
          },
          body: JSON.stringify({ content: "qualquer coisa" }),
        },
      );
      expect(response.status).toBe(404);
    });
  });
});

describe("PATCH /api/v1/topics/[topic_id]/reviews (fundamental decision)", () => {
  test("promoting a completed monthly review schedules the next monthly review and keeps the topic active", async () => {
    const { user, session } =
      await orchestrator.createUserActivateAndReturnSession();

    const topic = await orchestrator.createTopic(user, {
      title: "Tema fundamental",
    });
    const reviews = await orchestrator.findReviewsByTopic(topic.id);
    const monthly = reviews.find((r) => r.type === "monthly");
    const today = new Date().toISOString().slice(0, 10);
    await markDue(monthly.id, today);

    const completeResponse = await fetch(
      `${webserver.origin}/api/v1/topics/${topic.id}/reviews`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: `session_id=${session.token}`,
        },
        body: JSON.stringify({ content: "Explicação da revisão mensal" }),
      },
    );
    expect(completeResponse.status).toBe(200);

    const promoteResponse = await fetch(
      `${webserver.origin}/api/v1/topics/${topic.id}/reviews`,
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Cookie: `session_id=${session.token}`,
        },
        body: JSON.stringify({ promoted: true }),
      },
    );
    expect(promoteResponse.status).toBe(200);

    const promoteBody = await promoteResponse.json();
    expect(promoteBody.topic.status).toBe("active");

    const updatedReviews = await orchestrator.findReviewsByTopic(topic.id);
    const monthlyReviews = updatedReviews.filter((r) => r.type === "monthly");
    expect(monthlyReviews).toHaveLength(2);

    const completedMonthly = monthlyReviews.find((r) => r.id === monthly.id);
    expect(completedMonthly.promoted).toBe(true);

    const nextMonthly = monthlyReviews.find((r) => r.id !== monthly.id);
    expect(nextMonthly.scheduled_date).toBe(
      reviewModel.getEndOfNextMonth(today),
    );
    expect(nextMonthly.completed_at).toBeNull();

    const queueResponse = await fetch(
      `${webserver.origin}/api/v1/topics/queue`,
      { headers: { Cookie: `session_id=${session.token}` } },
    );
    const queueBody = await queueResponse.json();
    expect(queueBody.fundamental_active_count).toBeGreaterThanOrEqual(1);
  });

  test("not promoting a completed monthly review marks the topic as completed", async () => {
    const { user, session } =
      await orchestrator.createUserActivateAndReturnSession();

    const topic = await orchestrator.createTopic(user, {
      title: "Tema que gradua",
    });
    const reviews = await orchestrator.findReviewsByTopic(topic.id);
    const monthly = reviews.find((r) => r.type === "monthly");
    await markDue(monthly.id, new Date().toISOString().slice(0, 10));

    await fetch(`${webserver.origin}/api/v1/topics/${topic.id}/reviews`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: `session_id=${session.token}`,
      },
      body: JSON.stringify({ content: "Explicação final" }),
    });

    const promoteResponse = await fetch(
      `${webserver.origin}/api/v1/topics/${topic.id}/reviews`,
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Cookie: `session_id=${session.token}`,
        },
        body: JSON.stringify({ promoted: false }),
      },
    );
    expect(promoteResponse.status).toBe(200);

    const promoteBody = await promoteResponse.json();
    expect(promoteBody.topic.status).toBe("completed");

    const updatedReviews = await orchestrator.findReviewsByTopic(topic.id);
    expect(updatedReviews.filter((r) => r.type === "monthly")).toHaveLength(1);
  });

  test("returns 400 when `promoted` is missing or not a boolean", async () => {
    const { user, session } =
      await orchestrator.createUserActivateAndReturnSession();

    const topic = await orchestrator.createTopic(user, {
      title: "Tema com decisão inválida",
    });
    const reviews = await orchestrator.findReviewsByTopic(topic.id);
    const monthly = reviews.find((r) => r.type === "monthly");
    await markDue(monthly.id, new Date().toISOString().slice(0, 10));

    await fetch(`${webserver.origin}/api/v1/topics/${topic.id}/reviews`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: `session_id=${session.token}`,
      },
      body: JSON.stringify({ content: "Explicação" }),
    });

    const response = await fetch(
      `${webserver.origin}/api/v1/topics/${topic.id}/reviews`,
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Cookie: `session_id=${session.token}`,
        },
        body: JSON.stringify({}),
      },
    );
    expect(response.status).toBe(400);
  });
});
