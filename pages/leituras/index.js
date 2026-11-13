import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/router";
import { ThumbsDown, ThumbsUp } from "lucide-react";
import { Button } from "src/components/ui/button";
import { Textarea } from "src/components/ui/textarea";
import { Alert, AlertDescription, AlertTitle } from "src/components/ui/alert";
import { ReadingMetaBadges, ThemeBadges } from "components/ReadingBadges.jsx";
import FavoriteButton from "components/FavoriteButton.jsx";
import readingService from "services/readingService.js";
import { parseApiError } from "utils/api.js";
import { SOURCE_LABELS, getAuthorYears } from "utils/readings.js";

export default function LeiturasPage() {
  const router = useRouter();
  const [phase, setPhase] = useState("loading");
  const [reading, setReading] = useState(null);
  const [reaction, setReaction] = useState(null);
  const [note, setNote] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);

  const loadReading = useCallback(async (readingId, reason = null) => {
    const readingResponse = await readingService.getReading(readingId);
    if (!readingResponse.ok) {
      setErrorMessage(await parseApiError(readingResponse));
      setPhase("error");
      return;
    }

    setReading({ ...(await readingResponse.json()), reason });
    setPhase("reading");
    window.scrollTo({ top: 0 });
  }, []);

  const resetState = useCallback(() => {
    setPhase("loading");
    setReaction(null);
    setNote("");
    setErrorMessage(null);
  }, []);

  const loadNext = useCallback(async () => {
    resetState();

    const nextResponse = await readingService.getNext();
    if (nextResponse.status === 404) {
      setPhase("empty");
      return;
    }
    if (!nextResponse.ok) {
      setErrorMessage(await parseApiError(nextResponse));
      setPhase("error");
      return;
    }

    const next = await nextResponse.json();
    await loadReading(next.id, next.reason);
  }, [loadReading, resetState]);

  useEffect(() => {
    if (!router.isReady) return;

    if (router.query.id) {
      resetState();
      loadReading(router.query.id);
      return;
    }

    loadNext();
  }, [router.isReady, router.query.id, loadNext, loadReading, resetState]);

  function handleFavoriteChange(isFavorite) {
    setReading((current) => ({ ...current, is_favorite: isFavorite }));
  }

  async function handleLog(status) {
    setIsSaving(true);
    try {
      const response = await readingService.saveLog({
        reading_id: reading.id,
        status,
        reaction: status === "read" ? reaction : null,
        note: status === "read" ? note : null,
      });
      if (response.ok) {
        if (router.query.id) {
          router.replace("/leituras");
          return;
        }
        await loadNext();
        return;
      }
      setErrorMessage(await parseApiError(response));
    } finally {
      setIsSaving(false);
    }
  }

  if (phase === "loading") {
    return <div className="text-muted-foreground">Carregando...</div>;
  }

  if (phase === "empty") {
    return (
      <p className="text-muted-foreground">
        Você leu tudo o que está disponível por enquanto. Importe mais leituras
        para continuar.
      </p>
    );
  }

  if (phase === "error") {
    return (
      <Alert variant="destructive">
        <AlertTitle>{errorMessage?.message}</AlertTitle>
        <AlertDescription>{errorMessage?.action}</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-3">
        <ReadingMetaBadges reading={reading} />
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="font-serif text-3xl font-semibold leading-tight">
              {reading.title}
            </h1>
            <p className="mt-1 text-muted-foreground">
              {reading.author.name}
              {reading.year && ` · ${reading.year}`}
              {reading.collection &&
                !reading.title.startsWith(reading.collection) &&
                ` · ${reading.collection}`}
            </p>
          </div>
          <FavoriteButton
            key={`${reading.id}-${reading.is_favorite}`}
            readingId={reading.id}
            isFavorite={reading.is_favorite}
            onChange={handleFavoriteChange}
          />
        </div>
        {reading.reason && (
          <p className="rounded-2xl bg-muted px-4 py-3 text-sm text-muted-foreground">
            {reading.reason}
          </p>
        )}
      </header>

      {reading.content ? (
        <article
          className="prose prose-lg dark:prose-invert max-w-none font-serif"
          dangerouslySetInnerHTML={{ __html: reading.content }}
        />
      ) : (
        <Alert>
          <AlertTitle>Não foi possível carregar o texto agora</AlertTitle>
          <AlertDescription>
            <a
              href={reading.url}
              target="_blank"
              rel="noreferrer"
              className="underline"
            >
              Ler no site original
            </a>
          </AlertDescription>
        </Alert>
      )}

      <ThemeBadges themes={reading.themes} />

      <p className="text-xs text-muted-foreground">
        Fonte:{" "}
        <a
          href={reading.url}
          target="_blank"
          rel="noreferrer"
          className="underline"
        >
          {SOURCE_LABELS[reading.source] ?? reading.source}
        </a>
      </p>

      <section className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4">
        <div className="flex flex-wrap gap-2">
          <FavoriteButton
            key={`${reading.id}-${reading.is_favorite}-label`}
            readingId={reading.id}
            isFavorite={reading.is_favorite}
            onChange={handleFavoriteChange}
            showLabel
          />
          <Button
            variant={reaction === "liked" ? "default" : "outline"}
            size="sm"
            onClick={() => setReaction(reaction === "liked" ? null : "liked")}
          >
            <ThumbsUp /> Gostei
          </Button>
          <Button
            variant={reaction === "disliked" ? "default" : "outline"}
            size="sm"
            onClick={() =>
              setReaction(reaction === "disliked" ? null : "disliked")
            }
          >
            <ThumbsDown /> Não gostei
          </Button>
        </div>
        <Textarea
          value={note}
          onChange={(event) => setNote(event.target.value)}
          placeholder="Uma nota ou trecho que marcou (opcional)"
        />
        <div className="flex gap-2">
          <Button
            className="flex-1"
            onClick={() => handleLog("read")}
            disabled={isSaving}
          >
            {isSaving ? "Salvando..." : "Li — próxima leitura"}
          </Button>
          <Button
            variant="outline"
            onClick={() => handleLog("skipped")}
            disabled={isSaving}
          >
            Pular
          </Button>
        </div>
        {errorMessage && (
          <Alert variant="destructive">
            <AlertTitle>{errorMessage.message}</AlertTitle>
            <AlertDescription>{errorMessage.action}</AlertDescription>
          </Alert>
        )}
      </section>

      <AuthorCard author={reading.author} />

      <Link
        href="/leituras/historico"
        className="text-center text-sm text-muted-foreground underline"
      >
        Ver minhas leituras
      </Link>
    </div>
  );
}

function AuthorCard({ author }) {
  if (!author.bio) return null;

  const years = getAuthorYears(author);

  return (
    <section className="flex gap-4 rounded-2xl border border-border p-4">
      {author.image_url && (
        <Image
          src={author.image_url}
          alt={author.name}
          width={80}
          height={100}
          className="h-24 w-20 shrink-0 rounded-xl object-cover"
        />
      )}
      <div className="flex flex-col gap-1">
        <h2 className="font-medium">
          {author.name}
          {years && (
            <span className="font-normal text-muted-foreground">
              {" "}
              ({years})
            </span>
          )}
        </h2>
        <p className="text-sm text-muted-foreground">{author.bio}</p>
        {author.wikipedia_url && (
          <a
            href={author.wikipedia_url}
            target="_blank"
            rel="noreferrer"
            className="text-sm underline"
          >
            Saiba mais
          </a>
        )}
      </div>
    </section>
  );
}

LeiturasPage.title = "Leitura";
