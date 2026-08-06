async function createTopic(topicData) {
  const response = await fetch("/api/v1/topics", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(topicData),
  });
  return response;
}

async function getQueue() {
  const response = await fetch("/api/v1/topics/queue");
  return response;
}

async function getSession(topicId) {
  const response = await fetch(`/api/v1/topics/${topicId}/session`);
  return response;
}

const topicService = { createTopic, getQueue, getSession };

export default topicService;
