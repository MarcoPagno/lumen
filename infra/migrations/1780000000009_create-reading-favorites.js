exports.shorthands = undefined;

exports.up = (pgm) => {
  pgm.createTable("reading_favorites", {
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
    created_at: {
      type: "timestamptz",
      notNull: true,
      default: pgm.func("timezone('utc', now())"),
    },
  });

  pgm.addConstraint("reading_favorites", "reading_favorites_user_reading_unique", {
    unique: ["user_id", "reading_id"],
  });

  pgm.sql(`
    UPDATE users
    SET features = array_append(features, 'update:reading_favorite:self')
    WHERE 'read:reading' = ANY(features)
      AND NOT ('update:reading_favorite:self' = ANY(features));
  `);
};

exports.down = false;
