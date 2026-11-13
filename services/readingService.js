async function getNext() {
  const response = await fetch("/api/v1/readings/next");
  return response;
}

async function getReading(readingId) {
  const response = await fetch(`/api/v1/readings/${readingId}`);
  return response;
}

async function saveLog(logData) {
  const response = await fetch("/api/v1/reading-logs", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(logData),
  });
  return response;
}

async function addLink(linkData) {
  const response = await fetch("/api/v1/readings", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(linkData),
  });
  return response;
}

async function setFavorite(readingId, isFavorite) {
  const response = await fetch(`/api/v1/readings/${readingId}/favorite`, {
    method: isFavorite ? "PUT" : "DELETE",
  });
  return response;
}

async function importNext(source) {
  const response = await fetch("/api/v1/readings/imports", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ source }),
  });
  return response;
}

const readingService = {
  getNext,
  getReading,
  saveLog,
  addLink,
  setFavorite,
  importNext,
};

export default readingService;
