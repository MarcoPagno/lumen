import Router from "next/router";
import NProgress from "nprogress";
import "nprogress/nprogress.css";
import { Poppins } from "next/font/google";
import { useEffect } from "react";
import DefaultLayout from "components/DefaultLayout";
import { UserProvider } from "contexts/UserContext";
import { useRequireAuth } from "hooks/useRequireAuth";
import "styles/globals.css";

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-poppins",
});

NProgress.configure({ showSpinner: false });
Router.events.on("routeChangeStart", () => NProgress.start());
Router.events.on("routeChangeComplete", () => NProgress.done());
Router.events.on("routeChangeError", () => NProgress.done());

function AppContent({ Component, pageProps }) {
  const title = Component.title;
  const isPublic = Component.isPublic ?? false;
  const redirectIfAuthenticated = Component.redirectIfAuthenticated ?? false;

  useRequireAuth(isPublic, redirectIfAuthenticated);

  return (
    <DefaultLayout title={title}>
      <Component {...pageProps} />
    </DefaultLayout>
  );
}

export default function App({ Component, pageProps }) {
  useEffect(() => {
    document.documentElement.classList.add(poppins.variable, "font-sans");
  }, []);

  return (
    <UserProvider>
      <AppContent Component={Component} pageProps={pageProps} />
    </UserProvider>
  );
}
