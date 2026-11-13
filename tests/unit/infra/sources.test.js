import vatican from "infra/sources/vatican.js";
import permanencia from "infra/sources/permanencia.js";
import webpage from "infra/sources/webpage.js";
import escritas from "infra/sources/escritas.js";
import readingText from "models/reading-text.js";

const LONG_PARAGRAPH =
  "A fé cristã ensina que Deus criou o mundo com sabedoria e por amor, e que o homem foi chamado a conhecê-lo e servi-lo com todo o coração. ";

function paragraphs(firstNumber, count) {
  return Array.from(
    { length: count },
    (_, index) =>
      `<p align="left"><b>${firstNumber + index}.</b> ${LONG_PARAGRAPH.repeat(3)}</p>`,
  ).join("");
}

describe("vatican.extractDocumentHtml", () => {
  test("keeps the document text and removes language bar and notes", () => {
    const page = `
      <div class="documento"><div class="testo">
        <div class="translation-field"><span class="translation"><a>DE</a> - <a>PT</a></span></div>
        <p>[EN - ES - PT]</p>
        <p>${LONG_PARAGRAPH.repeat(10)}</p>
        <p>${LONG_PARAGRAPH.repeat(10)}</p>
        <hr>
        <p>Notas</p><p>[1] Mt 16,26.</p>
      </div></div>`;

    const html = vatican.extractDocumentHtml(page);
    const text = readingText.toPlainText(html);

    expect(text).toContain("A fé cristã ensina");
    expect(text).not.toContain("EN - ES");
    expect(text).not.toContain("DE");
    expect(text).not.toContain("Mt 16,26");
  });
});

describe("vatican.extractCatechismUnits", () => {
  const page = `
    <div id="corpo"><table><tr><td>
      <p align="center"><b>ARTIGO 1</b></p>
      <p align="center"><b>«CREIO EM DEUS PAI»</b></p>
      <p align="center">PARÁGRAFO 1</p>
      <p align="center"><b>CREIO EM DEUS</b></p>
      <p align="left"><b>199.</b> Introdução curta.</p>
      <p align="left"><b>I. «Creio em um só Deus»</b></p>
      ${paragraphs(200, 3)}
      <p align="left"><b>II. Deus revela o seu nome</b></p>
      ${paragraphs(203, 4)}
      <p align="left"><b>Resumindo:</b></p>
      <p align="left"><b>228.</b> Resumo curto.</p>
    </td></tr></table></div>`;

  test("splits the page into units by section headings", () => {
    const units = vatican.extractCatechismUnits(page);

    expect(units.map((unit) => unit.title)).toEqual([
      "I. «Creio em um só Deus» (§§ 199–202)",
      "II. Deus revela o seu nome (§§ 203–228)",
    ]);
  });

  test("keeps the article and paragraph as context", () => {
    const [unit] = vatican.extractCatechismUnits(page);
    expect(unit.collection).toBe(
      "Catecismo da Igreja Católica · Parágrafo 1 — Creio em deus",
    );
  });

  test("merges the summary into the previous unit", () => {
    const units = vatican.extractCatechismUnits(page);
    expect(readingText.toPlainText(units[1].html)).toContain("Resumo curto.");
  });
});

describe("vatican.getKind", () => {
  test("detects the document kind from the url", () => {
    expect(
      vatican.getKind(
        "https://www.vatican.va/content/leo-xiii/pt/encyclicals/documents/hf_l-xiii_enc_15051891_rerum-novarum.html",
      ),
    ).toBe("encíclica");
    expect(
      vatican.getKind(
        "https://www.vatican.va/archive/hist_councils/ii_vatican_council/documents/vat-ii_const_19641121_lumen-gentium_po.html",
      ),
    ).toBe("constituição conciliar");
  });
});

describe("permanencia.extractArticle", () => {
  test("extracts title and body", () => {
    const article = permanencia.extractArticle(`
      <nav><a>Menu</a></nav>
      <div class="col-lg-8 mb-3"><h2>"Novo Pentecostes"</h2><p>É a última novidade.</p></div>`);

    expect(article.title).toBe('"Novo Pentecostes"');
    expect(readingText.toPlainText(article.html)).toBe("É a última novidade.");
  });
});

describe("webpage.extractMain", () => {
  test("picks the element with most paragraph text and cleans the title", () => {
    const page = webpage.extractMain(`
      <html><head>
        <meta property="og:title" content="Sobre a oração - Blog Católico">
        <meta property="og:site_name" content="Blog Católico">
        <meta name="author" content="Fulano">
      </head><body>
        <nav><p>Início</p><p>Contato</p></nav>
        <div class="sidebar"><p>Assine</p></div>
        <article><h1>Sobre a oração</h1><p>${LONG_PARAGRAPH}</p><p>${LONG_PARAGRAPH}</p></article>
      </body></html>`);

    expect(page.title).toBe("Sobre a oração");
    expect(page.author).toBe("Fulano");
    expect(readingText.toPlainText(page.html)).toContain("A fé cristã ensina");
    expect(page.html).not.toContain("Assine");
    expect(page.html).not.toContain("<h1>");
  });
});

describe("webpage.validateUrl", () => {
  test("accepts public http(s) addresses", () => {
    expect(webpage.validateUrl("https://permanencia.org.br/texto")).toBe(
      "https://permanencia.org.br/texto",
    );
  });

  test("rejects private and invalid addresses", () => {
    for (const url of [
      "ftp://exemplo.com",
      "http://localhost/",
      "http://172.16.0.1/",
      "http://169.254.169.254/latest",
      "http://intranet/",
      "texto",
    ]) {
      expect(() => webpage.validateUrl(url)).toThrow("Invalid URL");
    }
  });
});

describe("permanencia.extractArticle byline", () => {
  test("detects the author line below the title", () => {
    const article = permanencia.extractArticle(`
      <div class="col-lg-12 mb-3"><h2>O terceiro segredo</h2>
      <p class="rteright"><em>Dom Lourenço Fleichman, OSB</em></p>
      <p>Texto do artigo.</p></div>`);

    expect(article.author).toBe("Dom Lourenço Fleichman, OSB");
    expect(readingText.toPlainText(article.html)).toBe("Texto do artigo.");
  });

  test("does not take quotes or dedications as author", () => {
    for (const line of [
      "“Ide vós também para a minha vinha”",
      "A Carlos Drummond de Andrade",
      "Uma frase em itálico que termina com ponto.",
    ]) {
      const article = permanencia.extractArticle(
        `<div class="col-lg-12"><h2>Título</h2><p><em>${line}</em></p><p>Texto.</p></div>`,
      );
      expect(article.author).toBeNull();
    }
  });
});

describe("escritas.extractPoem", () => {
  const page = `
    <header>
      <h1 class="poem-display-title">Sagração dos Ossos</h1>
      <a href="/pt/bruno-tolentino">Bruno Tolentino</a>
    </header>
    <div class="poem-body">Considerai estes ossos<br />— tíbios, inúteis —<br /><br />que sob a lápide dormem</div>`;

  test("extracts title and verses", () => {
    const poem = escritas.extractPoem(page, "bruno-tolentino");
    expect(poem.title).toBe("Sagração dos Ossos");
    expect(poem.isFromAuthor).toBe(true);
    expect(readingText.sanitizeHtml(poem.html)).toBe(
      "<p>Considerai estes ossos<br>— tíbios, inúteis —<br><br>que sob a lápide dormem</p>",
    );
  });

  test("detects poems from other authors", () => {
    const poem = escritas.extractPoem(page, "manuel-bandeira");
    expect(poem.isFromAuthor).toBe(false);
  });
});
