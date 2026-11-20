import type { Metadata, Viewport } from "next";
import {
  Geist_Mono,
  Inter,
  Inter_Tight,
  Martian_Mono,
  Schibsted_Grotesk,
} from "next/font/google";

import { DesignProvider } from "@/components/design/design-provider";
import { ThemeProvider } from "@/components/theme/theme-provider";
import { THEME_COLORS } from "@/design";
import { I18nProvider } from "@/i18n/client";
import { getI18n } from "@/i18n/server";
import { getDesign } from "@/server/design";

import "./globals.css";

// Self-hosted at build time; the browser never contacts Google.
// All font variables sit on <html> so switching the design needs no new class
// names; a font file is only downloaded once the active design's CSS uses its
// family. The "Schaltplan" fonts are not preloaded: the default is "Klassisch".
const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const interTight = Inter_Tight({
  subsets: ["latin"],
  weight: ["300", "400"],
  variable: "--font-inter-tight",
});
const geistMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-geist-mono",
});
const schibsted = Schibsted_Grotesk({
  subsets: ["latin"],
  variable: "--font-schibsted",
  preload: false,
});
const martianMono = Martian_Mono({
  subsets: ["latin"],
  variable: "--font-martian-mono",
  preload: false,
});

const FONT_VARIABLES = [inter, interTight, geistMono, schibsted, martianMono]
  .map((font) => font.variable)
  .join(" ");

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return {
    title: { default: t.app.name, template: `%s · ${t.app.name}` },
    description: t.app.description,
    // Admin UI: never index.
    robots: { index: false, follow: false },
  };
}

export async function generateViewport(): Promise<Viewport> {
  const colors = THEME_COLORS[await getDesign()];
  return {
    width: "device-width",
    initialScale: 1,
    viewportFit: "cover",
    themeColor: [
      { media: "(prefers-color-scheme: light)", color: colors.light },
      { media: "(prefers-color-scheme: dark)", color: colors.dark },
    ],
  };
}

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const [{ locale }, design] = await Promise.all([getI18n(), getDesign()]);
  return (
    <html
      lang={locale}
      suppressHydrationWarning
      data-design={design}
      className={FONT_VARIABLES}
    >
      <body className="min-h-dvh antialiased">
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <I18nProvider locale={locale}>
            <DesignProvider design={design}>{children}</DesignProvider>
          </I18nProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
