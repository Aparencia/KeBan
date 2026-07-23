"use client";

import { ThemeProvider } from "next-themes";
import type { ReactNode } from "react";

export function ThemeRegistry({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="dark"
      enableSystem={false}
      storageKey="keban-theme"
    >
      {children}
    </ThemeProvider>
  );
}
