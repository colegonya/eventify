import { Geist, Geist_Mono } from "next/font/google";
import { NavTabs } from "@/components/NavTabs";
import { BRAND_COLOR_VARS } from "@/lib/config";
import { getBrandingSettings } from "@/lib/data";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export async function generateMetadata() {
  const { appTitle } = await getBrandingSettings();
  return {
    title: appTitle,
    description: `${appTitle} and budget tracker`,
  };
}

export default async function RootLayout({
  children,
}) {
  const { appTitle, colors } = await getBrandingSettings();
  const brandOverrides = BRAND_COLOR_VARS.filter(([, key]) => colors[key]).map(
    ([cssVar, key]) => [cssVar, colors[key]],
  );

  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex h-dvh flex-col overflow-hidden" suppressHydrationWarning>
        {brandOverrides.length > 0 && (
          <style>{`:root{${brandOverrides.map(([name, value]) => `${name}:${value};`).join("")}}`}</style>
        )}
        <header className="shrink-0 border-b border-brand-ink/10 bg-white/95 backdrop-blur">
          <div className="h-1 bg-brand-primary" />
          {/* On mobile the title row is hidden to save vertical space; this
              keeps the page's accessible <h1> in the a11y tree there. On md+
              it's removed and the visible <h1> below takes over, so exactly
              one <h1> is present at any breakpoint. */}
          <h1 className="sr-only md:hidden">{appTitle}</h1>
          <div className="hidden items-center px-4 pt-3 md:flex md:px-6">
            <h1 className="text-base font-semibold tracking-tight text-brand-ink md:text-lg">
              {appTitle}
            </h1>
          </div>
          <NavTabs />
        </header>
        <main className="min-h-0 flex-1 overflow-y-auto">{children}</main>
      </body>
    </html>
  );
}
