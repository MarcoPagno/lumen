import http from "infra/sources/http.js";

const MAX_PAGES_PER_AUTHOR = 800;

const WIKIS = {
  pt: { host: "pt.wikisource.org", categoryPrefix: "Categoria:" },
  en: { host: "en.wikisource.org", categoryPrefix: "Category:" },
};

const client = http.createClient({ minIntervalInMilliseconds: 1200 });

function buildUrl(lang, params) {
  const searchParams = new URLSearchParams({
    ...params,
    format: "json",
    formatversion: "2",
  });
  return `https://${WIKIS[lang].host}/w/api.php?${searchParams}`;
}

function getPageUrl(title, lang = "pt") {
  return `https://${WIKIS[lang].host}/wiki/${encodeURIComponent(title.replace(/ /g, "_"))}`;
}

function toExternalId(title, lang) {
  return lang === "pt" ? title : `${lang}:${title}`;
}

function parseExternalId(externalId) {
  const match = /^(en):(.+)$/.exec(externalId);
  return match
    ? { lang: match[1], title: match[2] }
    : { lang: "pt", title: externalId };
}

async function listCategoryMembers(lang, category) {
  const members = [];
  let cmcontinue;

  do {
    const data = await client.getJson(
      buildUrl(lang, {
        action: "query",
        list: "categorymembers",
        cmtitle: `${WIKIS[lang].categoryPrefix}${category}`,
        cmtype: "page|subcat",
        cmlimit: "500",
        ...(cmcontinue && { cmcontinue }),
      }),
    );

    members.push(...(data.query?.categorymembers ?? []));
    cmcontinue = data.continue?.cmcontinue;
  } while (cmcontinue);

  return members;
}

async function listPagesWithPrefix(lang, prefix) {
  const titles = [];
  let apcontinue;

  do {
    const data = await client.getJson(
      buildUrl(lang, {
        action: "query",
        list: "allpages",
        apprefix: prefix,
        aplimit: "500",
        ...(apcontinue && { apcontinue }),
      }),
    );

    titles.push(...(data.query?.allpages ?? []).map((page) => page.title));
    apcontinue = data.continue?.apcontinue;
  } while (apcontinue && titles.length < MAX_PAGES_PER_AUTHOR);

  return titles;
}

async function discoverAuthorPages(authorConfig) {
  const lang = authorConfig.wikisource_lang ?? "pt";
  const pages = new Map();

  for (const title of authorConfig.pages ?? []) {
    pages.set(title, { title, collection: null });
  }

  for (const prefix of authorConfig.prefixes ?? []) {
    const collection = prefix.replace(/\/$/, "");
    for (const title of await listPagesWithPrefix(lang, prefix)) {
      pages.set(title, { title, collection });
    }
  }

  for (const category of authorConfig.categories ?? []) {
    const members = await listCategoryMembers(lang, category);
    const collection = category === authorConfig.name ? null : category;

    for (const member of members.filter((item) => item.ns === 0)) {
      pages.set(member.title, { title: member.title, collection });
    }

    const subcategories = members
      .filter((item) => item.ns === 14)
      .map((item) => item.title.replace(/^[^:]+:/, ""));

    for (const subcategory of subcategories) {
      if (pages.size >= MAX_PAGES_PER_AUTHOR) break;

      const subMembers = await listCategoryMembers(lang, subcategory);
      for (const member of subMembers.filter((item) => item.ns === 0)) {
        pages.set(member.title, {
          title: member.title,
          collection: subcategory,
        });
      }
    }
  }

  return [...pages.values()].slice(0, MAX_PAGES_PER_AUTHOR).map((page) => {
    const collection = page.collection ?? getCollectionFromTitle(page.title);
    return {
      external_id: toExternalId(page.title, lang),
      title: getDisplayTitle(page.title, collection),
      collection,
      url: getPageUrl(page.title, lang),
    };
  });
}

function isChapterTitle(pageTitle) {
  const lastSegment = pageTitle.split("/").pop().trim();
  return /^([IVXLCDM]+|\d+)\.?$/i.test(lastSegment);
}

function getDisplayTitle(pageTitle, collection) {
  const lastSegment = pageTitle.split("/").pop();
  if (collection && isChapterTitle(pageTitle)) {
    return `${collection}, ${lastSegment}`;
  }
  return lastSegment;
}

function getCollectionFromTitle(pageTitle) {
  if (!pageTitle.includes("/")) return null;
  return pageTitle.split("/").slice(0, -1).join(" / ");
}

async function fetchPage(externalId) {
  const { lang, title } = parseExternalId(externalId);
  const data = await client.getJson(
    buildUrl(lang, {
      action: "parse",
      page: title,
      prop: "text|categories",
      redirects: "1",
    }),
  );

  if (!data.parse) {
    return null;
  }

  return {
    html: data.parse.text,
    categories: (data.parse.categories ?? []).map((category) =>
      category.category.replace(/_/g, " "),
    ),
  };
}

const wikisource = {
  discoverAuthorPages,
  isChapterTitle,
  fetchPage,
  getPageUrl,
  parseExternalId,
};

export default wikisource;
