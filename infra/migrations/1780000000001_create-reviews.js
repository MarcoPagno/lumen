exports.shorthands = undefined;

exports.up = (pgm) => {
  pgm.createTable("reviews", {
    id: {
      type: "uuid",
      primaryKey: true,
      default: pgm.func("gen_random_uuid()"),
    },
    topic_id: {
      type: "uuid",
      notNull: true,
      references: "topics",
      onDelete: "CASCADE",
    },
    type: { type: "text", notNull: true },
    scheduled_date: { type: "date", notNull: true },
    completed_at: { type: "timestamptz", notNull: false },
    content: { type: "text", notNull: false },
    angle: { type: "text", notNull: false },
    promoted: { type: "boolean", notNull: false },
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

  pgm.createIndex("reviews", "topic_id");
  pgm.createIndex("reviews", "scheduled_date", {
    where: "completed_at IS NULL",
  });
};

exports.down = false;
