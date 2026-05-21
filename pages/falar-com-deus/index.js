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
    <>
      <h1>Falar com Deus</h1>

      <div dangerouslySetInnerHTML={{ __html: article }} />
    </>
  );
}
