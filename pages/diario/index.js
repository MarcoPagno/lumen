import { useState } from "react";
import useSWR from "swr";
import { Button } from "src/components/ui/button";
import { Textarea } from "src/components/ui/textarea";
import DiaryForm from "components/DiaryForm.jsx";
import diaryService from "services/diaryService.js";

async function fetchAPI(key) {
  const response = await fetch(key);
  if (!response.ok) {
    throw new Error("Failed to load diary");
  }
  return response.json();
}

function formatDay(dateOnly) {
  const [year, month, day] = dateOnly.split("-").map(Number);
  return new Date(year, month - 1, day).toLocaleDateString("pt-br", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function groupByDay(entries) {
  const groups = new Map();
  for (const entry of entries) {
    if (!groups.has(entry.entry_date)) groups.set(entry.entry_date, []);
    groups.get(entry.entry_date).push(entry);
  }
  return [...groups.entries()];
}

export default function DiarioPage() {
  const { data, isLoading, mutate } = useSWR("/api/v1/diary", fetchAPI);
  const entries = data ?? [];

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">Diário</h1>

      <section className="rounded-2xl border border-border bg-card p-4">
        <DiaryForm onSaved={mutate} />
      </section>

      {isLoading && <div className="text-muted-foreground">Carregando...</div>}

      {!isLoading && entries.length === 0 && (
        <p className="text-muted-foreground">Nenhuma anotação ainda.</p>
      )}

      {groupByDay(entries).map(([day, dayEntries]) => (
        <section key={day} className="flex flex-col gap-2">
          <h2 className="text-sm font-medium capitalize text-muted-foreground">
            {formatDay(day)}
          </h2>
          {dayEntries.map((entry) => (
            <DiaryEntry key={entry.id} entry={entry} onChange={mutate} />
          ))}
        </section>
      ))}
    </div>
  );
}

function DiaryEntry({ entry, onChange }) {
  const [isEditing, setIsEditing] = useState(false);
  const [content, setContent] = useState(entry.content);
  const [isSaving, setIsSaving] = useState(false);

  async function handleSave() {
    setIsSaving(true);
    try {
      const response = await diaryService.updateEntry(entry.id, { content });
      if (response.ok) {
        setIsEditing(false);
        onChange();
      }
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete() {
    if (!window.confirm("Apagar esta anotação?")) return;
    const response = await diaryService.deleteEntry(entry.id);
    if (response.ok) onChange();
  }

  const time = new Date(entry.created_at).toLocaleTimeString("pt-br", {
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div className="flex flex-col gap-2 rounded-2xl border border-border p-4">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>{time}</span>
        {!isEditing && (
          <div className="flex gap-1">
            <Button
              variant="ghost"
              size="xs"
              onClick={() => setIsEditing(true)}
            >
              Editar
            </Button>
            <Button variant="ghost" size="xs" onClick={handleDelete}>
              Apagar
            </Button>
          </div>
        )}
      </div>

      {isEditing ? (
        <>
          <Textarea
            value={content}
            onChange={(event) => setContent(event.target.value)}
            className="min-h-32"
          />
          <div className="flex gap-2">
            <Button size="sm" onClick={handleSave} disabled={isSaving}>
              {isSaving ? "Salvando..." : "Salvar"}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setContent(entry.content);
                setIsEditing(false);
              }}
            >
              Cancelar
            </Button>
          </div>
        </>
      ) : (
        <p className="text-sm whitespace-pre-wrap">{entry.content}</p>
      )}
    </div>
  );
}

DiarioPage.title = "Diário";
