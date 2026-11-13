exports.shorthands = undefined;

exports.up = (pgm) => {
  pgm.createTable("diary_entries", {
    id: {
      type: "uuid",
      primaryKey: true,
      default: pgm.func("gen_random_uuid()"),
    },
    user_id: { type: "uuid", notNull: true },
    entry_date: { type: "date", notNull: true },
    content: { type: "text", notNull: true },
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

  pgm.createIndex("diary_entries", ["user_id", "entry_date"]);

  pgm.sql(`
    UPDATE users
    SET features = array_cat(
      features,
      ARRAY[
        'create:diary_entry',
        'read:diary_entry:self',
        'update:diary_entry:self',
        'delete:diary_entry:self'
      ]::varchar[]
    )
    WHERE 'read:reading' = ANY(features)
      AND NOT ('create:diary_entry' = ANY(features));
  `);
};

exports.down = false;
