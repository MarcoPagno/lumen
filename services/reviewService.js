async function completeReview(topicId, reviewData) {
  const response = await fetch(`/api/v1/topics/${topicId}/reviews`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(reviewData),
  });
  return response;
}

async function decidePromotion(topicId, promoted) {
  const response = await fetch(`/api/v1/topics/${topicId}/reviews`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ promoted }),
  });
  return response;
}

const reviewService = { completeReview, decidePromotion };

export default reviewService;
