exports.shorthands = undefined;

exports.up = (pgm) => {
  pgm.sql(`
    UPDATE users
    SET features = array_cat(
      features,
      ARRAY[
        'read:reading',
        'create:reading_log',
        'read:reading_log:self',
        'create:book',
        'read:book:self',
        'update:book:self'
      ]::varchar[]
    )
    WHERE 'create:topic' = ANY(features)
      AND NOT ('read:reading' = ANY(features));
  `);

  pgm.sql(`
    UPDATE users
    SET features = array_append(features, 'create:reading_import')
    WHERE 'create:migration' = ANY(features)
      AND NOT ('create:reading_import' = ANY(features));
  `);
};

exports.down = false;
