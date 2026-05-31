exports.shorthands = undefined;

exports.up = (pgm) => {
  pgm.createTable("system_activity_items", {
    id: {
      type: "uuid",
      primaryKey: true,
      default: pgm.func("gen_random_uuid()"),
    },

    system_activity_type_id: {
      type: "uuid",
      notNull: true,
    },

    title: {
      type: "varchar(300)",
      notNull: true,
    },

    subtitle: {
      type: "text",
    },

    url: {
      type: "varchar(500)",
    },

    published_at: {
      type: "timestamptz",
      notNull: true,
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
