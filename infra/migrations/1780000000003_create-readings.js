exports.shorthands = undefined;

exports.up = (pgm) => {
  pgm.createTable("readings", {
    id: {
      type: "uuid",
      primaryKey: true,
      default: pgm.func("gen_random_uuid()"),
    },
    author_id: {
      type: "uuid",
      notNull: true,
      references: "authors",
      onDelete: "CASCADE",
    },
    source: { type: "text", notNull: true },
    external_id: { type: "text", notNull: true },
    title: { type: "text", notNull: true },
    collection: { type: "text", notNull: false },
    url: { type: "text", notNull: true },
    mode: { type: "text", notNull: true, default: "stored" },
    status: { type: "text", notNull: true, default: "pending" },
    rejection_reason: { type: "text", notNull: false },
    content: { type: "text", notNull: false },
    excerpt: { type: "text", notNull: false },
    word_count: { type: "integer", notNull: false },
    reading_minutes: { type: "integer", notNull: false },
    kind: { type: "text", notNull: false },
    area: { type: "text", notNull: false },
    tone: { type: "text", notNull: false },
    themes: { type: "text[]", notNull: true, default: "{}" },
    year: { type: "integer", notNull: false },
    series_id: { type: "uuid", notNull: false },
    part_number: { type: "integer", notNull: false },
    part_total: { type: "integer", notNull: false },
    created_at: {
      type: "timestamptz",
      notNull: true,
      default: pgm.func("timezone('utc', now())"),
    },
    updated_at: {
      type: "timestamptz",
      notNull: true,
      default: pgm.func("timezone('utc', now())"),
    },
  });

  pgm.addConstraint("readings", "readings_source_external_id_unique", {
    unique: ["source", "external_id"],
  });
  pgm.createIndex("readings", "status");
  pgm.createIndex("readings", "author_id");
  pgm.createIndex("readings", "series_id");
  pgm.createIndex("readings", "themes", { method: "gin" });
};

exports.down = false;
