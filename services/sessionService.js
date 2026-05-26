async function createSession(sessionData) {
  const response = await fetch("/api/v1/sessions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(sessionData),
  });
  return response;
}

const sessionService = { createSession };

export default sessionService;
