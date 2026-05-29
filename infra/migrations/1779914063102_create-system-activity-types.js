exports.shorthands = undefined;

exports.up = (pgm) => {
  pgm.createTable("system_activity_types", {
    id: {
      type: "uuid",
      primaryKey: true,
      default: pgm.func("gen_random_uuid()"),
    },

    slug: {
      type: "varchar(100)",
      notNull: true,
      unique: true,
    },

    name: {
      type: "varchar(200)",
      notNull: true,
    },
    // 'meditacao', 'documento', 'catequese'
    category: {
      type: "varchar(50)",
      notNull: true,
    },
    // hex
    color: {
      type: "varchar(7)",
      notNull: true,
    },

    is_default_active: {
      type: "boolean",
      default: false,
    },
    // 'daily', 'on_publish'
    frequency: {
      type: "varchar(20)",
      notNull: true,
    },
    // null = do not expire (Falar com Deus), 7 = disappear in 7 days
    expires_after_days: {
      type: "integer",
    },
    // 'scraping', 'rss', null
    source: {
      type: "varchar(20)",
    },
    // null se database
    source_url: {
      type: "varchar(500)",
    },

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
