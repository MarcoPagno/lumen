import { randomUUID } from "node:crypto";
import orchestrator from "tests/orchestrator.js";
import webserver from "infra/webserver.js";

beforeAll(async () => {
  await orchestrator.waitForAllServices();
  await orchestrator.clearDatabase();
  await orchestrator.runPendingMigrations();
});

async function setFavorite(session, readingId, method) {
  return await fetch(
    `${webserver.origin}/api/v1/readings/${readingId}/favorite`,
    {
      method,
      headers: session ? { Cookie: `session_id=${session.token}` } : {},
    },
  );
}

async function getReading(session, readingId) {
  const response = await fetch(
    `${webserver.origin}/api/v1/readings/${readingId}`,
    { headers: { Cookie: `session_id=${session.token}` } },
  );
  return await response.json();
}

describe("/api/v1/readings/[reading_id]/favorite", () => {
  test("anonymous user receives 403", async () => {
    const response = await setFavorite(
      null,
      "00000000-0000-4000-8000-000000000000",
      "PUT",
    );
    expect(response.status).toBe(403);
  });

  test("PUT favorites and DELETE removes the favorite", async () => {
    const { session } = await orchestrator.createUserActivateAndReturnSession();
    const author = await orchestrator.createAuthor();
    const reading = await orchestrator.createReading(author);

    const putResponse = await setFavorite(session, reading.id, "PUT");
    expect(putResponse.status).toBe(200);
    expect(await putResponse.json()).toEqual({
      reading_id: reading.id,
      is_favorite: true,
    });
    expect((await getReading(session, reading.id)).is_favorite).toBe(true);

    const secondPut = await setFavorite(session, reading.id, "PUT");
    expect(secondPut.status).toBe(200);

    const deleteResponse = await setFavorite(session, reading.id, "DELETE");
    expect(deleteResponse.status).toBe(200);
    expect((await getReading(session, reading.id)).is_favorite).toBe(false);
  });

  test("favoriting any part favorites the whole series", async () => {
    const { session } = await orchestrator.createUserActivateAndReturnSession();
    const author = await orchestrator.createAuthor();
    const seriesId = randomUUID();
    const partOne = await orchestrator.createReading(author, {
      series_id: seriesId,
      part_number: 1,
      part_total: 2,
    });
    const partTwo = await orchestrator.createReading(author, {
      series_id: seriesId,
      part_number: 2,
      part_total: 2,
    });

    const response = await setFavorite(session, partTwo.id, "PUT");
    expect((await response.json()).reading_id).toBe(partOne.id);
    expect((await getReading(session, partOne.id)).is_favorite).toBe(true);
    expect((await getReading(session, partTwo.id)).is_favorite).toBe(true);
  });

  test("favorites are private to each user", async () => {
    const { session } = await orchestrator.createUserActivateAndReturnSession();
    const { session: otherSession } =
      await orchestrator.createUserActivateAndReturnSession();
    const author = await orchestrator.createAuthor();
    const reading = await orchestrator.createReading(author);

    await setFavorite(session, reading.id, "PUT");

    expect((await getReading(otherSession, reading.id)).is_favorite).toBe(
      false,
    );
  });

  test("returns 404 for a reading that does not exist", async () => {
    const { session } = await orchestrator.createUserActivateAndReturnSession();

    const response = await setFavorite(
      session,
      "00000000-0000-4000-8000-000000000000",
      "PUT",
    );
    expect(response.status).toBe(404);
  });
});
