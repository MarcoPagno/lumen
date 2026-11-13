import { useState } from "react";
import { Button } from "src/components/ui/button";
import { Textarea } from "src/components/ui/textarea";
import { Alert, AlertDescription, AlertTitle } from "src/components/ui/alert";
import diaryService from "services/diaryService.js";
import { parseApiError } from "utils/api.js";

export default function DiaryForm({ onSaved, placeholder }) {
  const [content, setContent] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);

  async function handleSubmit(event) {
    event.preventDefault();
    setIsSaving(true);
    setErrorMessage(null);
    try {
      const response = await diaryService.createEntry({ content });
      if (response.ok) {
        setContent("");
        setIsSaved(true);
        onSaved?.();
        return;
      }
      setErrorMessage(await parseApiError(response));
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <Textarea
        value={content}
        onChange={(event) => {
          setContent(event.target.value);
          setIsSaved(false);
        }}
        placeholder={placeholder ?? "Escreva o que quiser..."}
        className="min-h-32"
        required
      />
      <div className="flex items-center gap-3">
        <Button type="submit" disabled={isSaving}>
          {isSaving ? "Salvando..." : "Salvar no diário"}
        </Button>
        {isSaved && (
          <span className="text-sm text-muted-foreground">Salvo.</span>
        )}
      </div>
      {errorMessage && (
        <Alert variant="destructive">
          <AlertTitle>{errorMessage.message}</AlertTitle>
          <AlertDescription>{errorMessage.action}</AlertDescription>
        </Alert>
      )}
    </form>
  );
}
