exports.shorthands = undefined;

exports.up = (pgm) => {
  pgm.addColumn("readings", {
    language: { type: "text", notNull: true, default: "pt" },
  });
};

exports.down = false;
