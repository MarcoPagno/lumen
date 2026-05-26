import "styles/globals.css";
import DefaultLayout from "components/DefaultLayout";
import { useRequireAuth } from "hooks/useRequireAuth";
import { Poppins } from "next/font/google";
import { useEffect } from "react";

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-poppins",
});

export default function App({ Component, pageProps }) {
  const title = Component.title;
  const isPublic = Component.isPublic ?? false;

  useEffect(() => {
    document.documentElement.classList.add(poppins.variable, "font-sans");
  }, []);

  useRequireAuth(isPublic);

  return (
    <DefaultLayout title={title}>
      <Component {...pageProps} />
    </DefaultLayout>
  );
}
