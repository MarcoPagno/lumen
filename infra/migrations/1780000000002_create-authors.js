exports.shorthands = undefined;

exports.up = (pgm) => {
  pgm.createTable("authors", {
    id: {
      type: "uuid",
      primaryKey: true,
      default: pgm.func("gen_random_uuid()"),
    },
    slug: { type: "text", notNull: true, unique: true },
    name: { type: "text", notNull: true },
    birth_year: { type: "integer", notNull: false },
    death_year: { type: "integer", notNull: false },
    bio: { type: "text", notNull: false },
    image_url: { type: "text", notNull: false },
    wikipedia_url: { type: "text", notNull: false },
    discovered_at: { type: "timestamptz", notNull: false },
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
};

exports.down = false;
