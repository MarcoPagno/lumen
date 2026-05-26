import Head from "next/head";
import Router from "next/router";
import { useState, useEffect } from "react";
import Header from "components/Header.jsx";
import Sidebar from "components/Sidebar.jsx";
import { useUser } from "hooks/useUser.js";

export default function DefaultLayout({ children, title }) {
  const pageTitle = title ? `${title} · Lumen` : "Lumen";
  const [isDark, setIsDark] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isNavigating, setIsNavigating] = useState(false);
  const { user } = useUser();

  useEffect(() => {
    const saved = localStorage.getItem("lumen:colorMode");
    const prefersDark = window.matchMedia(
      "(prefers-color-scheme: dark)",
    ).matches;
    const dark = saved ? saved === "dark" : prefersDark;
    setIsDark(dark);
    setMounted(true);
  }, []);

  useEffect(() => {
    function handleStart() {
      setIsNavigating(true);
    }
    function handleDone() {
      setIsNavigating(false);
    }

    Router.events.on("routeChangeStart", handleStart);
    Router.events.on("routeChangeComplete", handleDone);
    Router.events.on("routeChangeError", handleDone);

    return () => {
      Router.events.off("routeChangeStart", handleStart);
      Router.events.off("routeChangeComplete", handleDone);
      Router.events.off("routeChangeError", handleDone);
    };
  }, []);

  useEffect(() => {
    if (!mounted) return;
    document.documentElement.classList.toggle("dark", isDark);
    localStorage.setItem("lumen:colorMode", isDark ? "dark" : "light");
  }, [isDark, mounted]);

  function toggleColorMode() {
    setIsDark((prev) => !prev);
  }

  return (
    <>
      <Head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>{pageTitle}</title>
      </Head>
      <div className="min-h-screen bg-background text-foreground flex flex-col">
        {mounted && (
          <>
            <Header onOpenSidebar={() => setSidebarOpen(true)} user={user} />
            <Sidebar
              isOpen={sidebarOpen}
              onClose={() => setSidebarOpen(false)}
              isDark={isDark}
              onToggleDark={toggleColorMode}
            />
          </>
        )}
        <main className="flex-1 max-w-2xl w-full mx-auto px-4 py-6 relative">
          {isNavigating && (
            <div className="absolute inset-0 flex items-center justify-center bg-background/60 z-10">
              <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          )}
          {children}
        </main>
      </div>
    </>
  );
}
