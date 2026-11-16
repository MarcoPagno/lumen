exports.shorthands = undefined;

exports.up = (pgm) => {
  pgm.addColumn("books", {
    cover_url: { type: "text", notNull: false },
  });
};

exports.down = false;
