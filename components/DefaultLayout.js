import Head from "next/head";
import { useState, useEffect } from "react";

export default function DefaultLayout({ children, title }) {
  const pageTitle = title ? `${title} · Lumen` : "Lumen";
  const [isDark, setIsDark] = useState(false);
  const [mounted, setMounted] = useState(false);

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
      <div className="min-h-screen bg-background text-foreground">
        {mounted && (
          <button onClick={toggleColorMode}>{isDark ? "☀️" : "🌙"}</button>
        )}
        {children}
      </div>
    </>
  );
}
