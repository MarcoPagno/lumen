import { ServiceError } from "infra/errors.js";

const USER_AGENT = "Lumen/1.0 (leitor pessoal)";

function sleep(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function detectCharset(contentType, bytes) {
  const fromHeader = /charset=["']?([\w-]+)/i.exec(contentType ?? "")?.[1];
  if (fromHeader) return fromHeader;

  const head = Buffer.from(bytes.subarray(0, 4000)).toString("latin1");
  return /<meta[^>]+charset=["']?([\w-]+)/i.exec(head)?.[1] ?? "utf-8";
}

function decode(bytes, charset) {
  try {
    return new TextDecoder(charset).decode(bytes);
  } catch {
    return new TextDecoder("utf-8").decode(bytes);
  }
}

function createClient({ minIntervalInMilliseconds = 0, retries = 3 } = {}) {
  let lastRequestAt = 0;

  async function request(url, { accept, timeoutInMilliseconds = 20000 }) {
    for (let attempt = 0; attempt <= retries; attempt++) {
      const waitTime = lastRequestAt + minIntervalInMilliseconds - Date.now();
      if (waitTime > 0) await sleep(waitTime);
      lastRequestAt = Date.now();

      const response = await fetch(url, {
        headers: { "User-Agent": USER_AGENT, Accept: accept },
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

      return response;
    }

    throw new ServiceError({
      message: "External source is rate limiting requests",
      action: "Wait a few minutes and try the import again",
      context: { url },
    });
  }

  async function getJson(url, { timeoutInMilliseconds } = {}) {
    const response = await request(url, {
      accept: "application/json",
      timeoutInMilliseconds,
    });
    return response.json();
  }

  async function getHtml(url, { timeoutInMilliseconds } = {}) {
    const response = await request(url, {
      accept: "text/html",
      timeoutInMilliseconds,
    });
    const bytes = new Uint8Array(await response.arrayBuffer());
    return decode(
      bytes,
      detectCharset(response.headers.get("content-type"), bytes),
    );
  }

  return { getJson, getHtml };
}

const http = {
  USER_AGENT,
  createClient,
};

export default http;
