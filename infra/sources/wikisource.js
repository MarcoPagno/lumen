import http from "infra/sources/http.js";

const API_URL = "https://pt.wikisource.org/w/api.php";
const PAGE_URL = "https://pt.wikisource.org/wiki/";
const MAX_PAGES_PER_AUTHOR = 800;

const client = http.createClient({ minIntervalInMilliseconds: 1200 });

function buildUrl(params) {
  const searchParams = new URLSearchParams({
    ...params,
    format: "json",
    formatversion: "2",
  });
  return `${API_URL}?${searchParams}`;
}

function getPageUrl(title) {
  return PAGE_URL + encodeURIComponent(title.replace(/ /g, "_"));
}

async function listCategoryMembers(category) {
  const members = [];
  let cmcontinue;

  do {
    const data = await client.getJson(
      buildUrl({
        action: "query",
        list: "categorymembers",
        cmtitle: `Categoria:${category}`,
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

async function discoverAuthorPages(authorConfig) {
  const pages = new Map();

  for (const title of authorConfig.pages ?? []) {
    pages.set(title, { title, collection: null });
  }

  for (const category of authorConfig.categories ?? []) {
    const members = await listCategoryMembers(category);
    const collection = category === authorConfig.name ? null : category;

    for (const member of members.filter((item) => item.ns === 0)) {
      pages.set(member.title, { title: member.title, collection });
    }

    const subcategories = members
      .filter((item) => item.ns === 14)
      .map((item) => item.title.replace(/^Categoria:/, ""));

    for (const subcategory of subcategories) {
      if (pages.size >= MAX_PAGES_PER_AUTHOR) break;

      const subMembers = await listCategoryMembers(subcategory);
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
      external_id: page.title,
      title: getDisplayTitle(page.title, collection),
      collection,
      url: getPageUrl(page.title),
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

async function fetchPage(title) {
  const data = await client.getJson(
    buildUrl({
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
};

export default wikisource;
