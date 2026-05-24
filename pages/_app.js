import "styles/global.css";
import DefaultLayout from "components/DefaultLayout";

export default function App({ Component, pageProps }) {
  const title = Component.title;
  return (
    <DefaultLayout title={title}>
      <Component {...pageProps} />
    </DefaultLayout>
  );
}
