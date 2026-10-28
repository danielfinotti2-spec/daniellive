import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { TabBar } from "@/components/TabBar";
import { ThemeScript } from "@/components/ThemeScript";
import { PularParaConteudo } from "@/components/PularParaConteudo";
import { MotionRoot } from "@/components/animacao";

// A mesma família da referência, servida pelo próprio domínio: sem requisição
// a terceiros e sem deslocamento de layout, porque o Next gera o @font-face e
// o preload junto com a página.
const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"], display: "swap" });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"], display: "swap" });

export const metadata: Metadata = {
  title: {
    default: "DanielLive — compartilhe sua tela em segundos",
    template: "%s · DanielLive",
  },
  description:
    "Crie uma transmissão, envie o link e mostre sua tela. Sem instalar nada, sem criar conta. A imagem vai direto de um navegador para o outro.",
  applicationName: "DanielLive",
  robots: { index: true, follow: true },
  openGraph: {
    title: "DanielLive — compartilhe sua tela em segundos",
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
      // O `lang` real é escrito pelo `ThemeScript` antes da primeira pintura,
      // a partir do idioma escolhido. Este valor é o do servidor, que não tem
      // como conhecer a escolha — ele vive no `localStorage`, não na URL.
      lang="pt-BR"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        {/* Resolve o tema e o idioma antes da primeira pintura para não piscar. */}
        <ThemeScript />
      </head>
      <body className="flex min-h-dvh flex-col bg-zinc-50 text-foreground dark:bg-black">
        <MotionRoot>
          <PularParaConteudo />
          <SiteHeader />
          <main id="conteudo" className="flex flex-1 flex-col">
            {children}
          </main>
          <SiteFooter />
          <TabBar />
        </MotionRoot>
      </body>
    </html>
  );
}
