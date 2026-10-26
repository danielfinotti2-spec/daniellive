import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { TabBar } from "@/components/TabBar";
import { ThemeScript } from "@/components/ThemeScript";

// A mesma família da referência, servida pelo próprio domínio: sem requisição
// a terceiros e sem deslocamento de layout, porque o Next gera o @font-face e
// o preload junto com a página.
const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"], display: "swap" });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"], display: "swap" });

export const metadata: Metadata = {
  title: {
    default: "ScreenLive — compartilhe sua tela em segundos",
    template: "%s · ScreenLive",
  },
  description:
    "Crie uma transmissão, envie o link e mostre sua tela. Sem instalar nada, sem criar conta. A imagem vai direto de um navegador para o outro.",
  applicationName: "ScreenLive",
  robots: { index: true, follow: true },
  openGraph: {
    title: "ScreenLive — compartilhe sua tela em segundos",
    description:
      "Crie uma transmissão, envie o link e mostre sua tela. Sem instalar nada, sem criar conta.",
    type: "website",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // A área de vídeo ocupa a tela toda, então travar o zoom atrapalharia quem
  // precisa ampliar. Só a escala inicial é fixada.
  maximumScale: 5,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#101014" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="pt-BR"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        {/* Resolve o tema antes da primeira pintura para não piscar branco. */}
        <ThemeScript />
      </head>
      <body className="flex min-h-dvh flex-col bg-zinc-50 text-foreground dark:bg-black">
        <a
          href="#conteudo"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-broadcast focus:px-3 focus:py-2 focus:text-sm focus:font-medium focus:text-white"
        >
          Pular para o conteúdo
        </a>
        <SiteHeader />
        <main id="conteudo" className="flex flex-1 flex-col">
          {children}
        </main>
        <SiteFooter />
        <TabBar />
      </body>
    </html>
  );
}
