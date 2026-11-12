exports.shorthands = undefined;

exports.up = (pgm) => {
  pgm.createTable("books", {
    id: {
      type: "uuid",
      primaryKey: true,
      default: pgm.func("gen_random_uuid()"),
    },
    user_id: { type: "uuid", notNull: true },
    title: { type: "text", notNull: true },
    author_name: { type: "text", notNull: false },
    themes: { type: "text[]", notNull: true, default: "{}" },
    subjects: { type: "text[]", notNull: true, default: "{}" },
    status: { type: "text", notNull: true, default: "reading" },
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

  pgm.createIndex("books", "user_id");
};

exports.down = false;
