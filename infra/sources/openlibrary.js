import http from "infra/sources/http.js";

const SEARCH_URL = "https://openlibrary.org/search.json";

const client = http.createClient({ retries: 0 });

const COVERS_URL = "https://covers.openlibrary.org/b/id/";

async function findBookInfo(title, authorName) {
  const params = new URLSearchParams({
    title,
    limit: "1",
    fields: "subject,cover_i",
  });

  if (authorName) {
    params.set("author", authorName);
  }

  try {
    const data = await client.getJson(`${SEARCH_URL}?${params}`, {
      timeoutInMilliseconds: 5000,
    });
    const book = data.docs?.[0];
    return {
      subjects: (book?.subject ?? []).slice(0, 40),
      cover_url: book?.cover_i ? `${COVERS_URL}${book.cover_i}-M.jpg` : null,
    };
  } catch {
    return { subjects: [], cover_url: null };
  }
}

const openlibrary = {
  findBookInfo,
};

export default openlibrary;
