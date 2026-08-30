import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Header } from "@/components/header";
import { ThemeProvider } from "@/components/theme-provider";
import { DEFAULT_THEME, STORAGE_KEY, THEME_IDS } from "@/lib/themes";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Adan Pradan",
  description: "E-commerce storefront",
};

const themeScript = `
(function() {
  try {
    var key = ${JSON.stringify(STORAGE_KEY)};
    var fallback = ${JSON.stringify(DEFAULT_THEME)};
    var stored = localStorage.getItem(key);
    var valid = ${JSON.stringify(THEME_IDS)};
    var theme = stored && valid.indexOf(stored) !== -1 ? stored : fallback;
    document.documentElement.dataset.theme = theme;
  } catch (e) {
    document.documentElement.dataset.theme = ${JSON.stringify(DEFAULT_THEME)};
  }
})();
`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-full flex flex-col">
        <ThemeProvider>
          <Header />
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
