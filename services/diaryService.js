async function createEntry(entryData) {
  const response = await fetch("/api/v1/diary", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(entryData),
  });
  return response;
}

async function updateEntry(entryId, entryData) {
  const response = await fetch(`/api/v1/diary/${entryId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(entryData),
  });
  return response;
}

async function deleteEntry(entryId) {
  const response = await fetch(`/api/v1/diary/${entryId}`, {
    method: "DELETE",
  });
  return response;
}

const diaryService = { createEntry, updateEntry, deleteEntry };

export default diaryService;
