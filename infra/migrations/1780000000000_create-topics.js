exports.shorthands = undefined;

exports.up = (pgm) => {
  pgm.createTable("topics", {
    id: {
      type: "uuid",
      primaryKey: true,
      default: pgm.func("gen_random_uuid()"),
    },
    user_id: { type: "uuid", notNull: true },
    title: { type: "text", notNull: true },
    source: { type: "text", notNull: false },
    studied_at: { type: "date", notNull: true },
    status: { type: "text", notNull: true, default: "active" },
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

  pgm.createIndex("topics", "user_id");
};

exports.down = false;
