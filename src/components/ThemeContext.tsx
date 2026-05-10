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

  useEffect(() => {
    const root = window.document.documentElement;

    root.classList.remove("light", "dark");
    
    let activeTheme = theme;

    if (theme === "system") {
      const systemTheme = window.matchMedia("(prefers-color-scheme: dark)")
        .matches
        ? "dark"
        : "light";

      activeTheme = systemTheme;
    }
    
    root.classList.add(activeTheme);
    
    // Update theme-color meta tag for mobile status bar
    const updateThemeColor = (color: string) => {
      const metas = document.querySelectorAll('meta[name="theme-color"]');
      if (metas.length === 0) {
        let metaThemeColor = document.createElement("meta");
        metaThemeColor.setAttribute("name", "theme-color");
        metaThemeColor.setAttribute("content", color);
        document.head.appendChild(metaThemeColor);
      } else {
        metas.forEach(meta => meta.setAttribute("content", color));
      }
    };

    updateThemeColor(activeTheme === "dark" ? "#020817" : "#ffffff");

  }, [theme]);

  // Listen for system theme changes if theme is set to 'system'
  useEffect(() => {
    if (theme !== "system") return;

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handleChange = () => {
      const root = window.document.documentElement;
      const systemTheme = mediaQuery.matches ? "dark" : "light";
      
      root.classList.remove("light", "dark");
      root.classList.add(systemTheme);
      
      const metas = document.querySelectorAll('meta[name="theme-color"]');
      metas.forEach(meta => meta.setAttribute("content", systemTheme === "dark" ? "#020817" : "#ffffff"));
    };

    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, [theme]);

  const value = {
    theme,
    setTheme: (theme: Theme) => {
      localStorage.setItem(storageKey, theme);
      setTheme(theme);
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
