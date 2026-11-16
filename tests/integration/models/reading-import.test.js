import orchestrator from "tests/orchestrator.js";
import database from "infra/database.js";
import readingImportModel from "models/reading-import.js";

beforeAll(async () => {
  await orchestrator.waitForAllServices();
  await orchestrator.clearDatabase();
  await orchestrator.runPendingMigrations();
});

describe("readingImportModel.cleanupInvalidAuthors", () => {
  test("moves readings from invalid authors to the fallback author", async () => {
    const fallback = await orchestrator.createAuthor({
      slug: "revista-permanencia",
      name: "Revista Permanência",
    });
    const invalid = await orchestrator.createAuthor({
      name: "LEIA A CONTINUAÇÃO",
    });
    const valid = await orchestrator.createAuthor({
      name: "Dom Lourenço Fleichman",
    });
    const fromInvalid = await orchestrator.createReading(invalid, {
      source: "permanencia",
    });
    const fromValid = await orchestrator.createReading(valid, {
      source: "permanencia",
    });

    const cleaned = await readingImportModel.cleanupInvalidAuthors(
      "permanencia",
      "revista-permanencia",
    );

    expect(cleaned).toBe(1);

    const readings = await database.query({
      text: "SELECT id, author_id FROM readings WHERE id = ANY($1::uuid[]);",
      values: [[fromInvalid.id, fromValid.id]],
    });
    const authorsById = Object.fromEntries(
      readings.rows.map((row) => [row.id, row.author_id]),
    );
    expect(authorsById[fromInvalid.id]).toBe(fallback.id);
    expect(authorsById[fromValid.id]).toBe(valid.id);

    const deleted = await database.query({
      text: "SELECT id FROM authors WHERE id = $1;",
      values: [invalid.id],
    });
    expect(deleted.rowCount).toBe(0);
  });
});
