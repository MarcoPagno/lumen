import http from "infra/sources/http.js";

const SEARCH_URL = "https://openlibrary.org/search.json";

const client = http.createClient({ retries: 0 });

async function findSubjects(title, authorName) {
  const params = new URLSearchParams({
    title,
    limit: "1",
    fields: "subject",
  });

  if (authorName) {
    params.set("author", authorName);
  }

  try {
    const data = await client.getJson(`${SEARCH_URL}?${params}`, {
      timeoutInMilliseconds: 5000,
    });
    return (data.docs?.[0]?.subject ?? []).slice(0, 40);
  } catch {
    return [];
  }
}

const openlibrary = {
  findSubjects,
};

export default openlibrary;
