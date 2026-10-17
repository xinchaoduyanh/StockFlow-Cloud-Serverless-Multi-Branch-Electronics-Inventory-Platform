import type { Metadata } from "next";
import { Bricolage_Grotesque, Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";

const geist = Geist({
  subsets: ["latin", "latin-ext", "vietnamese"],
  display: "swap",
  variable: "--font-geist",
});

const geistMono = Geist_Mono({
  subsets: ["latin", "latin-ext", "vietnamese"],
  display: "swap",
  variable: "--font-geist-mono",
});

// Display face for headings and big numbers; Geist stays on body text and forms.
const bricolage = Bricolage_Grotesque({
  subsets: ["latin", "latin-ext", "vietnamese"],
  display: "swap",
  variable: "--font-bricolage",
});

export const metadata: Metadata = {
  title: "DuyAnhShop | StockFlow Cloud",
  description: "Quản lý tồn kho linh kiện điện tử đa chi nhánh",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="vi"
      className={`${geist.variable} ${geistMono.variable} ${bricolage.variable}`}
      suppressHydrationWarning
    >
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              try {
                if (localStorage.theme === 'dark' || (!('theme' in localStorage) && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
                  document.documentElement.classList.add('dark')
                } else {
                  document.documentElement.classList.remove('dark')
                }
              } catch (_) {}
            `,
          }}
        />
      </head>
      <body className="antialiased">
        <a className="skip-link" href="#main">
          Bỏ qua điều hướng
        </a>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
