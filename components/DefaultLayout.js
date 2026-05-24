import { ThemeProvider, BaseStyles } from "@primer/react";
import Head from "next/head";
import { useState, useEffect } from "react";

export default function DefaultLayout({ children, title }) {
  const pageTitle = title ? `${title} · Lumen` : "Lumen";
  const [colorMode, setColorMode] = useState("day");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("lumen:colorMode");
    if (saved) {
      setColorMode(saved);
    } else {
      const prefersDark = window.matchMedia(
        "(prefers-color-scheme: dark)",
      ).matches;
      setColorMode(prefersDark ? "night" : "day");
    }
    setMounted(true);
  }, []);

  useEffect(() => {
    document.body.setAttribute(
      "data-color-mode",
      colorMode === "day" ? "light" : "dark",
    );
  }, [colorMode]);

  function toggleColorMode() {
    const next = colorMode === "day" ? "night" : "day";
    setColorMode(next);
    localStorage.setItem("lumen:colorMode", next);
  }

  return (
    <ThemeProvider
      colorMode={mounted ? colorMode : "day"}
      dayScheme="light"
      nightScheme="dark"
    >
      <BaseStyles>
        <Head>
          <meta charSet="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <title>{pageTitle}</title>
        </Head>
        <div
          style={{
            minHeight: "100vh",
            backgroundColor: "var(--lumen-bg)",
            color: "var(--lumen-fg)",
          }}
        >
          {mounted && (
            <button onClick={toggleColorMode}>
              {colorMode === "day" ? "🌙" : "☀️"}
            </button>
          )}
          {children}
        </div>
      </BaseStyles>
    </ThemeProvider>
  );
}
