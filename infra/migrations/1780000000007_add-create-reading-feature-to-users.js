exports.shorthands = undefined;

exports.up = (pgm) => {
  pgm.sql(`
    UPDATE users
    SET features = array_append(features, 'create:reading')
    WHERE 'read:reading' = ANY(features)
      AND NOT ('create:reading' = ANY(features));
  `);
};

exports.down = false;
