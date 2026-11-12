import { ServiceError } from "infra/errors.js";

const USER_AGENT = "Lumen/1.0 (leitor pessoal)";

function sleep(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function createClient({ minIntervalInMilliseconds = 0, retries = 3 } = {}) {
  let lastRequestAt = 0;

  async function getJson(url, { timeoutInMilliseconds = 20000 } = {}) {
    for (let attempt = 0; attempt <= retries; attempt++) {
      const waitTime = lastRequestAt + minIntervalInMilliseconds - Date.now();
      if (waitTime > 0) await sleep(waitTime);
      lastRequestAt = Date.now();

      const response = await fetch(url, {
        headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
        signal: AbortSignal.timeout(timeoutInMilliseconds),
      });

      if (response.status === 429 || response.status >= 500) {
        const retryAfter = Number(response.headers.get("retry-after"));
        await sleep((retryAfter || 5 * (attempt + 1)) * 1000);
        continue;
      }

      if (!response.ok) {
        throw new ServiceError({
          message: `External source responded with status ${response.status}`,
          context: { url },
        });
      }

      return response.json();
    }

    throw new ServiceError({
      message: "External source is rate limiting requests",
      action: "Wait a few minutes and try the import again",
      context: { url },
    });
  }

  return { getJson };
}

const http = {
  USER_AGENT,
  createClient,
};

export default http;
