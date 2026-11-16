import http from "infra/sources/http.js";

const PAGE_SIZE = 50;

const client = http.createClient({ minIntervalInMilliseconds: 500 });

function getPostId(entry) {
  return /post-(\d+)$/.exec(entry.id?.$t ?? "")?.[1] ?? null;
}

function toPost(entry, blogUrl) {
  const link = entry.link?.find((item) => item.rel === "alternate")?.href;

  return {
    external_id: `${new URL(blogUrl).hostname}:${getPostId(entry)}`,
    title: entry.title?.$t?.trim() || null,
    url: link ?? blogUrl,
    year: Number(entry.published?.$t?.slice(0, 4)) || null,
    html: entry.content?.$t ?? "",
    is_from_site: Boolean(link?.startsWith(blogUrl)),
  };
}

async function listPosts(blogUrl, startIndex) {
  const params = new URLSearchParams({
    alt: "json",
    "start-index": String(startIndex),
    "max-results": String(PAGE_SIZE),
  });

  const data = await client.getJson(`${blogUrl}feeds/posts/default?${params}`, {
    timeoutInMilliseconds: 60000,
  });

  return (data.feed?.entry ?? [])
    .filter((entry) => getPostId(entry))
    .map((entry) => toPost(entry, blogUrl));
}

async function fetchPostContent(blogUrl, externalId) {
  const postId = externalId.split("#")[0].split(":").pop();
  const data = await client.getJson(
    `${blogUrl}feeds/posts/default/${encodeURIComponent(postId)}?alt=json`,
    { timeoutInMilliseconds: 10000, interactive: true },
  );
  return data.entry?.content?.$t ?? null;
}

const blogger = {
  PAGE_SIZE,
  listPosts,
  fetchPostContent,
  toPost,
};

export default blogger;
