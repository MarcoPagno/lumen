import { parse } from "node-html-parser";

export async function getStaticProps() {
  const res = await fetch("https://hablarcondios.org/pt/meditacao-diaria/");
  const html = await res.text();
  const root = parse(html);
  const article = root.querySelector("article");
  article.querySelector("figure")?.remove();
  return {
    props: { article: article?.innerHTML ?? "" },
    revalidate: 3600,
  };
}

export default function FalarComDeusPage({ article }) {
  return (
    <article
      className="prose dark:prose-invert max-w-none"
      dangerouslySetInnerHTML={{ __html: article }}
    />
  );
}

FalarComDeusPage.title = "Falar com Deus";
FalarComDeusPage.isPublic = true;
