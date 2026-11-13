import Link from "next/link";
import { useState } from "react";
import { Button } from "src/components/ui/button";
import { Input } from "src/components/ui/input";
import { Label } from "src/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "src/components/ui/alert";
import { ReadingMetaBadges, ThemeBadges } from "components/ReadingBadges.jsx";
import { useForm } from "hooks/useForm.js";
import readingService from "services/readingService.js";
import { parseApiError } from "utils/api.js";

export default function AdicionarLeituraPage() {
  const {
    formData,
    isLoading,
    setIsLoading,
    errorMessage,
    setErrorMessage,
    handleChange,
    resetForm,
  } = useForm({ url: "", author_name: "" });
  const [addedReading, setAddedReading] = useState(null);

  async function handleSubmit(event) {
    event.preventDefault();
    setIsLoading(true);
    setErrorMessage(null);
    setAddedReading(null);
    try {
      const response = await readingService.addLink(formData);
      if (response.ok) {
        setAddedReading(await response.json());
        resetForm();
        return;
      }
      setErrorMessage(await parseApiError(response));
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Adicionar leitura</h1>
        <p className="text-sm text-muted-foreground">
          Cole o endereço de um texto que você encontrou. O Lumen extrai o
          texto, classifica e coloca na frente das próximas recomendações. O
          conteúdo continua no site original e é carregado na hora da leitura.
        </p>
      </div>

      <form
        onSubmit={handleSubmit}
        className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-4"
      >
        <div className="flex flex-col gap-1">
          <Label htmlFor="url">Endereço da página</Label>
          <Input
            id="url"
            name="url"
            type="url"
            value={formData.url}
            onChange={handleChange}
            placeholder="https://"
            required
          />
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="author_name">Autor (opcional)</Label>
          <Input
            id="author_name"
            name="author_name"
            value={formData.author_name}
            onChange={handleChange}
          />
        </div>
        <Button type="submit" disabled={isLoading}>
          {isLoading ? "Lendo a página..." : "Adicionar"}
        </Button>
        {errorMessage && (
          <Alert variant="destructive">
            <AlertTitle>{errorMessage.message}</AlertTitle>
            <AlertDescription>{errorMessage.action}</AlertDescription>
          </Alert>
        )}
      </form>

      {addedReading && (
        <section className="flex flex-col gap-3 rounded-2xl border border-border p-4">
          <div>
            <p className="font-serif text-xl font-semibold leading-tight">
              {addedReading.title}
            </p>
            <p className="text-sm text-muted-foreground">
              {addedReading.author.name}
            </p>
          </div>
          <ReadingMetaBadges reading={addedReading} />
          <ThemeBadges themes={addedReading.themes} />
          <Button asChild>
            <Link href={`/leituras?id=${addedReading.id}`}>Ler agora</Link>
          </Button>
        </section>
      )}
    </div>
  );
}

AdicionarLeituraPage.title = "Adicionar leitura";
