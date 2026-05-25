import "styles/global.css";
import DefaultLayout from "components/DefaultLayout";
import { useRequireAuth } from "hooks/useRequireAuth";

export default function App({ Component, pageProps }) {
  const title = Component.title;
  const isPublic = Component.isPublic ?? false;

  useRequireAuth(isPublic);

  return (
    <DefaultLayout title={title}>
      <Component {...pageProps} />
    </DefaultLayout>
  );
}
