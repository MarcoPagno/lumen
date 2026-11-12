import { parse } from "node-html-parser";

const SOURCE_URL = "https://hablarcondios.org/pt/meditacao-diaria/";

export async function getStaticProps() {
  try {
    const res = await fetch(SOURCE_URL);
    if (!res.ok) {
      throw new Error(`Unexpected status ${res.status}`);
    }

    const root = parse(await res.text());
    const article = root.querySelector("article");
    if (!article) {
      throw new Error("No <article> found in page");
    }

    article.querySelector("figure")?.remove();

    return {
      props: { article: article.innerHTML },
      revalidate: 3600,
    };
  } catch (error) {
    console.error("Falha ao carregar a meditação diária:", error);
    return {
      props: { article: null },
      revalidate: 300,
    };
  }
}

export default function FalarComDeusPage({ article }) {
  if (!article) {
    return (
      <p className="text-muted-foreground">
        Não foi possível carregar a meditação de hoje.{" "}
        <a
          href={SOURCE_URL}
          target="_blank"
          rel="noreferrer"
          className="underline"
        >
          Abrir no site original
        </a>
        .
      </p>
    );
  }

  return (
    <article
      className="prose dark:prose-invert max-w-none"
      dangerouslySetInnerHTML={{ __html: article }}
    />
  );
}

FalarComDeusPage.title = "Falar com Deus";
FalarComDeusPage.isPublic = true;
