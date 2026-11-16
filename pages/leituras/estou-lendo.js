import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import useSWR from "swr";
import { BookCheck, BookOpen, RotateCcw } from "lucide-react";
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
          {books.length === 0 && (
            <p className="text-muted-foreground">
              Nenhum livro cadastrado ainda.
            </p>
          )}
          <BookList
            title={`Lendo agora (${readingBooks.length})`}
            books={readingBooks}
            onStatusChange={handleStatusChange}
          />
          <BookList
            title={`Já lidos (${finishedBooks.length})`}
            books={finishedBooks}
            onStatusChange={handleStatusChange}
          />
        </>
      )}
    </div>
  );
}

function BookList({ title, books, onStatusChange }) {
  if (books.length === 0) return null;

  return (
    <section className="flex flex-col gap-2">
      <h2 className="font-medium">{title}</h2>
      {books.map((book) => (
        <BookCard key={book.id} book={book} onStatusChange={onStatusChange} />
      ))}
    </section>
  );
}

function BookCard({ book, onStatusChange }) {
  const isReading = book.status === "reading";

  return (
    <div className="flex gap-4 rounded-2xl border border-border bg-card p-4">
      {book.cover_url ? (
        <Image
          src={book.cover_url}
          alt={book.title}
          width={64}
          height={96}
          unoptimized
          className="h-24 w-16 shrink-0 rounded-lg object-cover"
        />
      ) : (
        <div className="flex h-24 w-16 shrink-0 items-center justify-center rounded-lg bg-muted">
          <BookOpen className="size-6 text-muted-foreground" />
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <div>
          <span
            className={`rounded-full px-2 py-0.5 text-xs font-medium ${
              isReading
                ? "bg-primary text-primary-foreground"
                : "bg-secondary text-secondary-foreground"
            }`}
          >
            {isReading ? "Lendo" : "Lido"}
          </span>
          <p className="mt-1 font-medium leading-snug">{book.title}</p>
          {book.author_name && (
            <p className="text-sm text-muted-foreground">{book.author_name}</p>
          )}
        </div>

        <ThemeBadges themes={book.themes} />

        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline" size="sm">
            <Link href={`/leituras/biblioteca?book=${book.id}`}>
              Leituras relacionadas
            </Link>
          </Button>
          {isReading ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onStatusChange(book, "finished")}
            >
              <BookCheck /> Marcar como lido
            </Button>
          ) : (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onStatusChange(book, "reading")}
            >
              <RotateCcw /> Voltar a ler
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

EstouLendoPage.title = "Estou lendo";
