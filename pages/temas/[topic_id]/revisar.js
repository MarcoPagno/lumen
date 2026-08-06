import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import { Button } from "src/components/ui/button";
import { Textarea } from "src/components/ui/textarea";
import { Alert, AlertDescription, AlertTitle } from "src/components/ui/alert";
import topicService from "services/topicService.js";
import reviewService from "services/reviewService.js";
import { parseApiError } from "utils/api.js";

const TYPE_LABELS = {
  initial_study: "Novo",
  daily: "Diária",
  weekly: "Semanal",
  monthly: "Mensal",
};

export default function RevisarTemaPage() {
  const router = useRouter();
  const { topic_id: topicId } = router.query;

  const [phase, setPhase] = useState("loading");
  const [session, setSession] = useState(null);
  const [content, setContent] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeciding, setIsDeciding] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);
  const [result, setResult] = useState(null);

  useEffect(() => {
    if (!topicId) return;
    let active = true;

    async function loadSession() {
      const response = await topicService.getSession(topicId);
      if (!active) return;

      if (response.status === 404) {
        setPhase("not_found");
        return;
      }
      if (!response.ok) {
        setErrorMessage(await parseApiError(response));
        setPhase("not_found");
        return;
      }

      setSession(await response.json());
      setPhase("writing");
    }

    loadSession();
    return () => {
      active = false;
    };
  }, [topicId]);

  async function handleSubmit(event) {
    event.preventDefault();
    setIsSubmitting(true);
    try {
      const response = await reviewService.completeReview(topicId, {
        content,
      });
      if (response.ok) {
        setResult(await response.json());
        setPhase("revealed");
        return;
      }
      setErrorMessage(await parseApiError(response));
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDecision(promoted) {
    setIsDeciding(true);
    try {
      const response = await reviewService.decidePromotion(topicId, promoted);
      if (response.ok) {
        setResult(await response.json());
        setPhase("done");
        return;
      }
      setErrorMessage(await parseApiError(response));
    } finally {
      setIsDeciding(false);
    }
  }

  if (phase === "loading") {
    return <div className="text-muted-foreground">Carregando...</div>;
  }

  if (phase === "not_found") {
    return (
      <div className="flex flex-col gap-4">
        <p className="text-muted-foreground">
          Não há revisão pendente para este tema hoje.
        </p>
        <Button asChild>
          <Link href="/">Voltar para início</Link>
        </Button>
        {errorMessage && (
          <Alert variant="destructive">
            <AlertTitle>{errorMessage.message}</AlertTitle>
            <AlertDescription>{errorMessage.action}</AlertDescription>
          </Alert>
        )}
      </div>
    );
  }

  if (phase === "writing") {
    return (
      <div className="flex flex-col gap-4">
        <div>
          <span className="rounded-full bg-secondary px-2.5 py-1 text-xs font-medium text-secondary-foreground">
            {TYPE_LABELS[session.type] ?? session.type}
          </span>
          <h1 className="mt-2 text-2xl font-semibold">{session.title}</h1>
          {session.angle && (
            <p className="mt-1 text-sm text-muted-foreground">
              {session.angle}
            </p>
          )}
        </div>

        <p className="text-sm text-muted-foreground">
          Escreva de memória, sem consultar o material ou explicações
          anteriores.
        </p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <Textarea
            value={content}
            onChange={(event) => setContent(event.target.value)}
            placeholder="Explique este tema com suas palavras..."
            className="min-h-64"
            required
          />
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Salvando..." : "Salvar explicação"}
          </Button>
          {errorMessage && (
            <Alert variant="destructive">
              <AlertTitle>{errorMessage.message}</AlertTitle>
              <AlertDescription>{errorMessage.action}</AlertDescription>
            </Alert>
          )}
        </form>
      </div>
    );
  }

  const reviews = result?.reviews ?? [];
  const lastCompletedAt = reviews.length
    ? reviews[reviews.length - 1].completed_at
    : null;
  const sessionReviews = reviews.filter(
    (review) => review.completed_at === lastCompletedAt,
  );
  const previousReviews = reviews.filter(
    (review) => review.completed_at !== lastCompletedAt,
  );
  const hasMonthlyDecisionPending =
    phase === "revealed" &&
    sessionReviews.some((review) => review.type === "monthly");

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">{result.topic.title}</h1>
        {result.topic.source && (
          <p className="mt-1 text-sm text-muted-foreground">
            Fonte: {result.topic.source}
          </p>
        )}
      </div>

      <div className="rounded-2xl border border-border bg-card p-4">
        <h2 className="font-medium">Sua explicação de hoje</h2>
        <p className="mt-2 text-sm whitespace-pre-wrap">{content}</p>
      </div>

      {previousReviews.length > 0 && (
        <div className="flex flex-col gap-3">
          <h2 className="font-medium">Explicações anteriores</h2>
          {previousReviews.map((review) => (
            <div
              key={review.id}
              className="rounded-2xl border border-border p-4"
            >
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>{TYPE_LABELS[review.type] ?? review.type}</span>
                <span>
                  {new Date(review.completed_at).toLocaleDateString("pt-br")}
                </span>
              </div>
              <p className="mt-2 text-sm whitespace-pre-wrap">
                {review.content}
              </p>
            </div>
          ))}
        </div>
      )}

      {hasMonthlyDecisionPending && (
        <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4">
          <h2 className="font-medium">Este tema é fundamental?</h2>
          <p className="text-sm text-muted-foreground">
            Marque como fundamental o conteúdo que você quer manter a longo
            prazo — pela relevância do assunto, não por ter errado ou achado
            difícil.
          </p>
          <div className="flex gap-2">
            <Button onClick={() => handleDecision(true)} disabled={isDeciding}>
              Marcar como fundamental
            </Button>
            <Button
              variant="outline"
              onClick={() => handleDecision(false)}
              disabled={isDeciding}
            >
              Não, pode concluir o tema
            </Button>
          </div>
          {errorMessage && (
            <Alert variant="destructive">
              <AlertTitle>{errorMessage.message}</AlertTitle>
              <AlertDescription>{errorMessage.action}</AlertDescription>
            </Alert>
          )}
        </div>
      )}

      {!hasMonthlyDecisionPending && (
        <Button asChild>
          <Link href="/">Voltar para início</Link>
        </Button>
      )}
    </div>
  );
}

RevisarTemaPage.title = "Revisão";
