import http from "infra/sources/http.js";

const client = http.createClient({ minIntervalInMilliseconds: 300 });

async function fetchSummary(pageTitle, lang = "pt") {
  try {
    const data = await client.getJson(
      `https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(pageTitle)}`,
      { timeoutInMilliseconds: 10000 },
    );

    if (data.type === "disambiguation") {
      return null;
    }

    return {
      bio: data.extract ?? null,
      image_url: data.thumbnail?.source ?? null,
      wikipedia_url: data.content_urls?.desktop?.page ?? null,
    };
  } catch {
    return null;
  }
}

const wikipedia = {
  fetchSummary,
};

export default wikipedia;
