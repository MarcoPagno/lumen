import { parse } from "node-html-parser";
import http from "infra/sources/http.js";

const API_URL = "https://olavodecarvalho.org/wp-json/wp/v2/posts";
const SITE_ORIGIN = "https://olavodecarvalho.org/";
const PAGE_SIZE = 50;

const client = http.createClient({ minIntervalInMilliseconds: 500 });

function decodeTitle(renderedTitle) {
  return parse(renderedTitle).text.trim();
}

async function listPosts(page) {
  const params = new URLSearchParams({
    per_page: String(PAGE_SIZE),
    page: String(page),
    orderby: "id",
    order: "asc",
    _fields: "id,link,date,title,content",
  });

  try {
    const posts = await client.getJson(`${API_URL}?${params}`, {
      timeoutInMilliseconds: 60000,
    });

    return posts.map((post) => ({
      external_id: String(post.id),
      title: decodeTitle(post.title.rendered),
      url: post.link,
      year: Number(post.date?.slice(0, 4)) || null,
      html: post.content.rendered,
      is_from_site: Boolean(post.link?.startsWith(SITE_ORIGIN)),
    }));
  } catch (error) {
    if (error.message?.includes("status 400")) {
      return [];
    }
    throw error;
  }
}

async function fetchPostContent(externalId) {
  const post = await client.getJson(
    `${API_URL}/${encodeURIComponent(externalId)}?_fields=content`,
    { timeoutInMilliseconds: 10000 },
  );
  return post.content.rendered;
}

const olavo = {
  PAGE_SIZE,
  listPosts,
  fetchPostContent,
};

export default olavo;
