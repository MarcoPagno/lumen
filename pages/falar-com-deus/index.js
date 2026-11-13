import hablarcondios from "infra/sources/hablarcondios.js";

export async function getStaticProps() {
  try {
    const res = await fetch(hablarcondios.MEDITATION_URL);
    if (!res.ok) {
      throw new Error(`Unexpected status ${res.status}`);
    }

    const meditation = hablarcondios.extractMeditation(await res.text());
    if (!meditation) {
      throw new Error("No meditation found in page");
    }

    return {
      props: { meditation, sourceUrl: hablarcondios.MEDITATION_URL },
      revalidate: 3600,
    };
  } catch (error) {
    console.error("Falha ao carregar a meditação diária:", error);
    return {
      props: { meditation: null, sourceUrl: hablarcondios.MEDITATION_URL },
      revalidate: 300,
    };
  }
}

export default function FalarComDeusPage({ meditation, sourceUrl }) {
  if (!meditation) {
    return (
      <p className="text-muted-foreground">
        Não foi possível carregar a meditação de hoje.{" "}
        <a
          href={sourceUrl}
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
    <article className="prose dark:prose-invert max-w-none">
      {meditation.title && <h1>{meditation.title}</h1>}
      <div dangerouslySetInnerHTML={{ __html: meditation.html }} />
    </article>
  );
}

FalarComDeusPage.title = "Falar com Deus";
FalarComDeusPage.isPublic = true;
