import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import useSWR from "swr";
import { Button } from "src/components/ui/button";
import { Input } from "src/components/ui/input";
import FavoriteButton from "components/FavoriteButton.jsx";
import { ThemeBadges } from "components/ReadingBadges.jsx";
import { AREA_LABELS, SOURCE_LABELS, THEMES } from "utils/readings.js";

const FILTER_KEYS = ["search", "author", "kind", "area", "theme", "status"];

const STATUS_OPTIONS = [
  { value: "", label: "Todos" },
  { value: "unread", label: "Não lidos" },
  { value: "in_progress", label: "Em andamento" },
  { value: "read", label: "Lidos" },
  { value: "favorites", label: "Favoritos" },
];

async function fetchAPI(key) {
  const response = await fetch(key);
  if (!response.ok) {
    throw new Error(`Failed to load ${key}`);
  }
  return response.json();
}

function buildQuery(filters, page) {
  const params = new URLSearchParams();
  for (const key of FILTER_KEYS) {
    if (filters[key]) params.set(key, filters[key]);
  }
  if (page > 1) params.set("page", String(page));
  return params.toString();
}

export default function BibliotecaPage() {
  const router = useRouter();
  const [filters, setFilters] = useState(null);
  const [searchInput, setSearchInput] = useState("");
  const [page, setPage] = useState(1);

  useEffect(() => {
    if (!router.isReady || filters) return;
    const initial = Object.fromEntries(
      FILTER_KEYS.map((key) => [key, router.query[key] ?? ""]),
    );
    setFilters(initial);
    setSearchInput(initial.search);
  }, [router.isReady, router.query, filters]);

  useEffect(() => {
    if (!filters) return;
    const timeout = setTimeout(() => {
      if (searchInput !== filters.search) {
        updateFilter("search", searchInput);
      }
    }, 400);
    return () => clearTimeout(timeout);
  });

  function updateFilter(key, value) {
    const nextFilters = { ...filters, [key]: value };
    setFilters(nextFilters);
    setPage(1);
    router.replace(
      { pathname: router.pathname, query: buildQuery(nextFilters, 1) },
      undefined,
      { shallow: true },
    );
  }

  const { data: facets } = useSWR("/api/v1/readings/facets", fetchAPI);

  if (!filters) {
    return <div className="text-muted-foreground">Carregando...</div>;
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Biblioteca</h1>
        <p className="text-sm text-muted-foreground">
          Todos os textos importados. Toque em um para ler.
        </p>
      </div>

      <section className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4">
        <Input
          type="search"
          value={searchInput}
          onChange={(event) => setSearchInput(event.target.value)}
          placeholder="Buscar por título, obra ou autor"
        />

        <div className="flex flex-wrap gap-1.5">
          {STATUS_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => updateFilter("status", option.value)}
              className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                filters.status === option.value
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border hover:bg-muted"
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <FilterSelect
            label="Autor"
            value={filters.author}
            onChange={(value) => updateFilter("author", value)}
            options={(facets?.authors ?? []).map((author) => ({
              value: author.slug,
              label: `${author.name} (${author.count})`,
            }))}
          />
          <FilterSelect
            label="Tipo"
            value={filters.kind}
            onChange={(value) => updateFilter("kind", value)}
            options={(facets?.kinds ?? []).map((kind) => ({
              value: kind.value,
              label: `${kind.value} (${kind.count})`,
            }))}
          />
          <FilterSelect
            label="Área"
            value={filters.area}
            onChange={(value) => updateFilter("area", value)}
            options={(facets?.areas ?? []).map((area) => ({
              value: area.value,
              label: `${AREA_LABELS[area.value] ?? area.value} (${area.count})`,
            }))}
          />
          <FilterSelect
            label="Tema"
            value={filters.theme}
            onChange={(value) => updateFilter("theme", value)}
            options={THEMES.map((theme) => ({
              value: theme.slug,
              label: theme.name,
            }))}
          />
        </div>
      </section>

      <ReadingList
        filters={filters}
        page={page}
        onLoadMore={() => setPage(page + 1)}
      />
    </div>
  );
}

function FilterSelect({ label, value, onChange, options }) {
  return (
    <select
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="h-9 rounded-xl border border-border bg-background px-3 text-sm"
      aria-label={label}
    >
      <option value="">{label}: todos</option>
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}

function ReadingList({ filters, page, onLoadMore }) {
  const pages = Array.from({ length: page }, (_, index) => index + 1);
  const firstPageKey = `/api/v1/readings?${buildQuery(filters, 1)}`;
  const { data: firstPage, isLoading } = useSWR(firstPageKey, fetchAPI);

  if (isLoading) {
    return <div className="text-muted-foreground">Carregando...</div>;
  }

  const total = firstPage?.total ?? 0;

  if (total === 0) {
    return (
      <p className="text-muted-foreground">
        Nenhum texto encontrado com esses filtros.
      </p>
    );
  }

  return (
    <section className="flex flex-col gap-2">
      <p className="text-sm text-muted-foreground">{total} texto(s)</p>
      {pages.map((pageNumber) => (
        <ReadingListPage
          key={pageNumber}
          url={`/api/v1/readings?${buildQuery(filters, pageNumber)}`}
        />
      ))}
      {page * (firstPage.page_size ?? 30) < total && (
        <Button variant="outline" onClick={onLoadMore}>
          Carregar mais
        </Button>
      )}
    </section>
  );
}

function ReadingListPage({ url }) {
  const { data, mutate } = useSWR(url, fetchAPI);

  return (data?.items ?? []).map((item) => (
    <ReadingListItem key={item.id} item={item} onChange={() => mutate()} />
  ));
}

function ReadingListItem({ item, onChange }) {
  const parts = item.part_total ?? 1;
  const status =
    item.read_parts >= parts
      ? "Lido"
      : item.read_parts > 0
        ? `${item.read_parts} de ${parts} partes lidas`
        : null;

  return (
    <Link
      href={`/leituras?id=${item.id}`}
      className="flex flex-col gap-2 rounded-2xl border border-border bg-card p-4 transition-colors hover:bg-muted"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-medium leading-snug">{item.title}</p>
          <p className="text-sm text-muted-foreground">
            {item.author.name}
            {item.collection &&
              !item.title.startsWith(item.collection) &&
              ` · ${item.collection}`}
          </p>
        </div>
        <FavoriteButton
          readingId={item.id}
          isFavorite={item.is_favorite}
          onChange={onChange}
        />
      </div>
      <div className="flex flex-wrap items-center gap-1.5 text-xs">
        {item.kind && (
          <span className="rounded-full bg-secondary px-2.5 py-1 font-medium text-secondary-foreground">
            {item.kind}
          </span>
        )}
        {item.total_minutes && (
          <span className="rounded-full bg-secondary px-2.5 py-1 font-medium text-secondary-foreground">
            ~{item.total_minutes} min
            {parts > 1 && ` · ${parts} partes`}
          </span>
        )}
        <span className="text-muted-foreground">
          {SOURCE_LABELS[item.source] ?? item.source}
        </span>
        {status && (
          <span className="ml-auto font-medium text-muted-foreground">
            {status}
          </span>
        )}
      </div>
      <ThemeBadges themes={item.themes.slice(0, 3)} />
    </Link>
  );
}

BibliotecaPage.title = "Biblioteca";
