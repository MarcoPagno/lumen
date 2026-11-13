exports.shorthands = undefined;

exports.up = (pgm) => {
  pgm.createTable("reading_logs", {
    id: {
      type: "uuid",
      primaryKey: true,
      default: pgm.func("gen_random_uuid()"),
    },
    user_id: { type: "uuid", notNull: true },
    reading_id: {
      type: "uuid",
      notNull: true,
      references: "readings",
      onDelete: "CASCADE",
    },
    status: { type: "text", notNull: true },
    reaction: { type: "text", notNull: false },
    note: { type: "text", notNull: false },
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

  pgm.addConstraint("reading_logs", "reading_logs_user_reading_unique", {
    unique: ["user_id", "reading_id"],
  });
  pgm.createIndex("reading_logs", ["user_id", "created_at"]);
};

exports.down = false;
