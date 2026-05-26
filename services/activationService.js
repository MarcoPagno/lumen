async function activate(activationTokenId) {
  const response = await fetch(`/api/v1/activations/${activationTokenId}`, {
    method: "PATCH",
  });
  return response;
}

const activationService = { activate };

export default activationService;
