import { useRouter } from "next/router";
import { Button } from "src/components/ui/button";
import { Input } from "src/components/ui/input";
import { Label } from "src/components/ui/label";
import { Textarea } from "src/components/ui/textarea";
import { Alert, AlertDescription, AlertTitle } from "src/components/ui/alert";
import { useForm } from "hooks/useForm.js";
import topicService from "services/topicService.js";
import { parseApiError } from "utils/api.js";

export default function NovoTemaPage() {
  const router = useRouter();
  const {
    formData,
    isLoading,
    setIsLoading,
    errorMessage,
    setErrorMessage,
    handleChange,
  } = useForm({
    title: "",
    source: "",
    initial_explanation: "",
  });

  async function handleSubmit(event) {
    event.preventDefault();
    setIsLoading(true);
    try {
      const response = await topicService.createTopic(formData);
      if (response.ok) {
        router.push("/");
        return;
      }
      setErrorMessage(await parseApiError(response));
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold">Estudar tema novo</h1>
      <p className="text-sm text-muted-foreground">
        Escreva sua explicação de memória, sem consultar o material. Depois de
        salvar, o ciclo de revisões deste tema é agendado automaticamente.
      </p>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <Label htmlFor="title">Título</Label>
          <Input
            id="title"
            name="title"
            value={formData.title}
            onChange={handleChange}
            required
          />
        </div>

        <div className="flex flex-col gap-1">
          <Label htmlFor="source">Fonte (opcional)</Label>
          <Input
            id="source"
            name="source"
            value={formData.source}
            onChange={handleChange}
          />
        </div>

        <div className="flex flex-col gap-1">
          <Label htmlFor="initial_explanation">
            Explicação inicial, escrita de memória
          </Label>
          <Textarea
            id="initial_explanation"
            name="initial_explanation"
            value={formData.initial_explanation}
            onChange={handleChange}
            required
          />
        </div>

        <Button type="submit" disabled={isLoading}>
          {isLoading ? "Salvando..." : "Salvar tema"}
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

NovoTemaPage.title = "Estudar tema novo";
