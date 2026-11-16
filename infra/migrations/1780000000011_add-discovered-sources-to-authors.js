exports.shorthands = undefined;

exports.up = (pgm) => {
  pgm.addColumn("authors", {
    discovered_sources: { type: "text[]", notNull: true, default: "{}" },
  });

  pgm.sql(`
    UPDATE authors
    SET discovered_sources = ARRAY(
      SELECT DISTINCT readings.source
      FROM readings
      WHERE readings.author_id = authors.id
    )
    WHERE discovered_at IS NOT NULL;
  `);
};

exports.down = false;
