async function createBook(bookData) {
  const response = await fetch("/api/v1/books", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(bookData),
  });
  return response;
}

async function updateBook(bookId, bookData) {
  const response = await fetch(`/api/v1/books/${bookId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(bookData),
  });
  return response;
}

const bookService = { createBook, updateBook };

export default bookService;
