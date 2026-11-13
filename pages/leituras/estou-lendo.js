import { useState } from "react";
import useSWR from "swr";
import { Button } from "src/components/ui/button";
import { Input } from "src/components/ui/input";
import { Label } from "src/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "src/components/ui/alert";
import { ThemeBadges } from "components/ReadingBadges.jsx";
import { useForm } from "hooks/useForm.js";
import bookService from "services/bookService.js";
import { parseApiError } from "utils/api.js";
import { AREA_LABELS, THEMES } from "utils/readings.js";

async function fetchAPI(key) {
  const response = await fetch(key);
  if (!response.ok) {
    throw new Error("Failed to load books");
  }
  return response.json();
}

export default function EstouLendoPage() {
  const {
    data,
    isLoading: isLoadingBooks,
    mutate,
  } = useSWR("/api/v1/books", fetchAPI);
  const {
    formData,
    isLoading,
    setIsLoading,
    errorMessage,
    setErrorMessage,
    handleChange,
    resetForm,
  } = useForm({ title: "", author_name: "" });
  const [selectedThemes, setSelectedThemes] = useState([]);

  function toggleTheme(slug) {
    setSelectedThemes((current) =>
      current.includes(slug)
        ? current.filter((theme) => theme !== slug)
        : [...current, slug],
    );
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const response = await bookService.createBook({
        ...formData,
        themes: selectedThemes,
      });
      if (response.ok) {
        resetForm();
        setSelectedThemes([]);
        mutate();
        return;
      }
      setErrorMessage(await parseApiError(response));
    } finally {
      setIsLoading(false);
    }
  }

  async function handleStatusChange(book, status) {
    const response = await bookService.updateBook(book.id, { status });
    if (response.ok) {
      mutate();
    }
  }

  const books = data ?? [];
  const readingBooks = books.filter((book) => book.status === "reading");
  const finishedBooks = books.filter((book) => book.status === "finished");

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Estou lendo</h1>
        <p className="text-sm text-muted-foreground">
          As leituras rápidas recomendadas priorizam textos com os mesmos temas
          e autores dos livros que você está lendo.
        </p>
      </div>

      <form
        onSubmit={handleSubmit}
        className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-4"
      >
        <div className="flex flex-col gap-1">
          <Label htmlFor="title">Livro</Label>
          <Input
            id="title"
            name="title"
            value={formData.title}
            onChange={handleChange}
            required
          />
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="author_name">Autor</Label>
          <Input
            id="author_name"
            name="author_name"
            value={formData.author_name}
            onChange={handleChange}
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label>Temas (opcional, o app também detecta sozinho)</Label>
          {Object.entries(AREA_LABELS).map(([area, label]) => (
            <div key={area} className="flex flex-col gap-1">
              <span className="text-xs text-muted-foreground">{label}</span>
              <div className="flex flex-wrap gap-1.5">
                {THEMES.filter((theme) => theme.area === area).map((theme) => (
                  <button
                    key={theme.slug}
                    type="button"
                    onClick={() => toggleTheme(theme.slug)}
                    className={`rounded-full border px-2.5 py-1 text-xs transition-colors ${
                      selectedThemes.includes(theme.slug)
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border hover:bg-muted"
                    }`}
                  >
                    {theme.name}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
        <Button type="submit" disabled={isLoading}>
          {isLoading ? "Salvando..." : "Adicionar livro"}
        </Button>
        {errorMessage && (
          <Alert variant="destructive">
            <AlertTitle>{errorMessage.message}</AlertTitle>
            <AlertDescription>{errorMessage.action}</AlertDescription>
          </Alert>
        )}
      </form>

      {isLoadingBooks ? (
        <div className="text-muted-foreground">Carregando...</div>
      ) : (
        <>
          <BookList
            title="Lendo agora"
            books={readingBooks}
            actionLabel="Terminei"
            onAction={(book) => handleStatusChange(book, "finished")}
          />
          <BookList
            title="Já lidos"
            books={finishedBooks}
            actionLabel="Voltar a ler"
            onAction={(book) => handleStatusChange(book, "reading")}
          />
        </>
      )}
    </div>
  );
}

function BookList({ title, books, actionLabel, onAction }) {
  if (books.length === 0) return null;

  return (
    <section className="flex flex-col gap-2">
      <h2 className="font-medium">{title}</h2>
      {books.map((book) => (
        <div
          key={book.id}
          className="flex flex-col gap-2 rounded-2xl border border-border p-4"
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-medium">{book.title}</p>
              {book.author_name && (
                <p className="text-sm text-muted-foreground">
                  {book.author_name}
                </p>
              )}
            </div>
            <Button variant="outline" size="xs" onClick={() => onAction(book)}>
              {actionLabel}
            </Button>
          </div>
          <ThemeBadges themes={book.themes} />
        </div>
      ))}
    </section>
  );
}

EstouLendoPage.title = "Estou lendo";
