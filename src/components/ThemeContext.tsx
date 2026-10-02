import { createContext, useContext, useEffect, useState } from "react";

type Theme = "dark" | "light" | "system";

interface ThemeProviderProps {
  children: React.ReactNode;
  defaultTheme?: Theme;
  storageKey?: string;
}

interface ThemeProviderState {
  theme: Theme;
  setTheme: (theme: Theme) => void;
}

const initialState: ThemeProviderState = {
  theme: "system",
  setTheme: () => null,
};

const ThemeProviderContext = createContext<ThemeProviderState>(initialState);

export function ThemeProvider({
  children,
  defaultTheme = "system",
  storageKey = "routine-theme",
  ...props
}: ThemeProviderProps) {
  const [theme, setTheme] = useState<Theme>(
    () => (localStorage.getItem(storageKey) as Theme) || defaultTheme
  );

  const applyTheme = (currentTheme: Theme) => {
    const root = window.document.documentElement;

    root.classList.remove("light", "dark");

    let activeTheme = currentTheme;
    if (currentTheme === "system") {
      activeTheme = window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light";
    }

    root.classList.add(activeTheme);
    const isDark = activeTheme === "dark";
    const color = isDark ? "#020817" : "#ffffff";

    // Set CSS color-scheme so Android/Chrome system status bar & navigation adapt instantly
    root.style.colorScheme = isDark ? "dark" : "light";

    // Update single theme-color meta tag without media queries to avoid Chrome PWA conflicts
    const metas = document.querySelectorAll('meta[name="theme-color"]');
    let found = false;
    metas.forEach((meta, idx) => {
      if (idx === 0) {
        meta.removeAttribute("media");
        meta.setAttribute("content", color);
        found = true;
      } else {
        meta.remove();
      }
    });

    if (!found) {
      const meta = document.createElement("meta");
      meta.setAttribute("name", "theme-color");
      meta.setAttribute("id", "theme-color-meta");
      meta.setAttribute("content", color);
      document.head.appendChild(meta);
    }

    // Update iOS status bar style
    const appleMeta = document.querySelector('meta[name="apple-mobile-web-app-status-bar-style"]');
    if (appleMeta) {
      appleMeta.setAttribute("content", isDark ? "black-translucent" : "default");
    }

    // Flutter WebView channel integration
    const win = window as Window & {
      ThemeChannel?: {
        postMessage: (message: string) => void;
      };
    };
    if (win.ThemeChannel?.postMessage) {
      win.ThemeChannel.postMessage(isDark ? "dark" : "light");
    }
  };

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  // Listen for system theme changes if theme is set to 'system'
  useEffect(() => {
    if (theme !== "system") return;

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handleChange = () => {
      applyTheme("system");
    };

    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, [theme]);

  const value = {
    theme,
    setTheme: (newTheme: Theme) => {
      localStorage.setItem(storageKey, newTheme);
      setTheme(newTheme);
      applyTheme(newTheme);
    },
  };

  return (
    <ThemeProviderContext.Provider {...props} value={value}>
      {children}
    </ThemeProviderContext.Provider>
  );
}

export const useTheme = () => {
  const context = useContext(ThemeProviderContext);

  if (context === undefined)
    throw new Error("useTheme must be used within a ThemeProvider");

  return context;
}
