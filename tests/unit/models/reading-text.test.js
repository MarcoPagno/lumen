import readingText from "models/reading-text.js";

const PARAGRAPH =
  "<p>O homem que procura a verdade não se contenta com as aparências da vida e busca nas coisas a razão de ser de tudo o que existe.</p>";

describe("readingText.sanitizeHtml", () => {
  test("keeps allowed tags and drops attributes", () => {
    const html = readingText.sanitizeHtml(
      '<p class="x" onclick="alert(1)">Olá <b>mundo</b> <a href="/y">link</a></p>',
    );
    expect(html).toBe("<p>Olá <strong>mundo</strong> link</p>");
  });

  test("removes scripts, styles and navigation blocks", () => {
    const html = readingText.sanitizeHtml(
      '<div class="ws-noexport"><p>Navegação</p></div><script>alert(1)</script><style>p{}</style><p>Texto</p>',
    );
    expect(html).toBe("<p>Texto</p>");
  });

  test("escapes text content", () => {
    const html = readingText.sanitizeHtml("<p>a &lt;script&gt; b</p>");
    expect(html).toBe("<p>a &lt;script&gt; b</p>");
  });

  test("keeps poem line breaks", () => {
    const html = readingText.sanitizeHtml(
      '<div class="poem"><p>Primeiro verso<br>Segundo verso</p></div>',
    );
    expect(html).toBe("<p>Primeiro verso<br>Segundo verso</p>");
  });
});

describe("readingText.countWords and getReadingMinutes", () => {
  test("counts only words with letters", () => {
    expect(readingText.countWords("Era uma vez — 1890, um homem.")).toBe(5);
  });

  test("rounds minutes with a minimum of one", () => {
    expect(readingText.getReadingMinutes(50)).toBe(1);
    expect(readingText.getReadingMinutes(1000)).toBe(5);
  });
});

describe("readingText.isPortuguese", () => {
  test("detects portuguese text", () => {
    expect(
      readingText.isPortuguese(
        "Não há nada mais belo do que a manhã de um domingo na cidade.",
      ),
    ).toBe(true);
  });

  test("rejects english text", () => {
    expect(
      readingText.isPortuguese(
        "Replacement part for the suction line hose assembly with warranty.",
      ),
    ).toBe(false);
  });
});

describe("readingText.detectThemes", () => {
  test("detects themes ignoring accents and using prefixes", () => {
    const themes = readingText.detectThemes(
      "A Eucaristia é o centro da missa. Na comunhão recebemos a hóstia consagrada.",
    );
    expect(themes[0]).toBe("eucaristia");
  });

  test("does not match partial words for exact terms", () => {
    const themes = readingText.detectThemes("O marido saiu cedo.", {
      minOccurrences: 1,
    });
    expect(themes).not.toContain("natureza");
  });

  test("uses english subjects from Open Library", () => {
    const themes = readingText.detectThemes("O Século do Nada", {
      minOccurrences: 1,
      subjects: ["Civilization, Modern", "Catholic Church"],
    });
    expect(themes).toEqual(expect.arrayContaining(["modernidade", "igreja"]));
  });
});

describe("readingText.detectKind", () => {
  test("uses wikisource categories", () => {
    expect(readingText.detectKind(["Sonetos de Olavo Bilac"])).toBe("poema");
    expect(readingText.detectKind(["Contos de Machado de Assis"])).toBe(
      "conto",
    );
    expect(readingText.detectKind(["Sermões do Padre Antônio Vieira"])).toBe(
      "sermão",
    );
  });

  test("falls back to poem markup", () => {
    expect(readingText.detectKind([], '<div class="poem"></div>')).toBe(
      "poema",
    );
  });

  test("returns null when unknown", () => {
    expect(readingText.detectKind(["Obras"], "<p></p>")).toBeNull();
  });
});

describe("readingText.prepare", () => {
  test("rejects very short texts", () => {
    expect(readingText.prepare("<p>Curto demais.</p>").rejected).toBe(
      "too_short",
    );
  });

  test("rejects index pages made of links", () => {
    const links = Array.from(
      { length: 30 },
      (_, index) =>
        `<li><a href="/c${index}">Capítulo número ${index}</a></li>`,
    ).join("");
    expect(readingText.prepare(`<ul>${links}</ul>`).rejected).toBe(
      "index_page",
    );
  });

  test("returns a single part for short readings", () => {
    const prepared = readingText.prepare(PARAGRAPH.repeat(3));
    expect(prepared.parts).toHaveLength(1);
    expect(prepared.parts[0].readingMinutes).toBe(1);
  });

  test("splits long texts into parts at paragraph boundaries", () => {
    const prepared = readingText.prepare(PARAGRAPH.repeat(400));
    expect(prepared.parts.length).toBeGreaterThan(1);
    expect(
      prepared.parts.every(
        (part) => part.readingMinutes <= readingText.MAX_READING_MINUTES,
      ),
    ).toBe(true);
    expect(prepared.parts.every((part) => part.html.startsWith("<p>"))).toBe(
      true,
    );
  });

  test("rejects long texts when split is not allowed", () => {
    const prepared = readingText.prepare(PARAGRAPH.repeat(400), {
      allowSplit: false,
    });
    expect(prepared.rejected).toBe("too_long");
  });
});

describe("readingText loose content", () => {
  test("wraps loose text between blocks into paragraphs", () => {
    const html = readingText.sanitizeHtml(
      "Texto solto<br>com quebra<p>Parágrafo</p><span>Mais texto</span>",
    );
    expect(html).toBe(
      "<p>Texto solto<br>com quebra</p><p>Parágrafo</p><p>Mais texto</p>",
    );
  });

  test("splits long texts made of loose content", () => {
    const sentence =
      "O homem que procura a verdade não se contenta com as aparências da vida e busca nas coisas a razão de ser de tudo. ";
    const looseText = Array.from(
      { length: 400 },
      () => `<div>${sentence}</div>`,
    ).join("");
    const prepared = readingText.prepare(looseText);
    expect(prepared.parts.length).toBeGreaterThan(1);
  });
});
