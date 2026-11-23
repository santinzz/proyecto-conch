import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, Geist_Mono, Lexend } from "next/font/google";
import { ServiceWorkerRegistration } from "@/components/service-worker";
import "./globals.css";

// Texto: Lexend (pensada para leerse con facilidad; ceros sin diagonal, a
// diferencia de Atkinson Hyperlegible, que hacía ver "$1Ø" en precios).
// Títulos y números: Bricolage Grotesque. Ver CLAUDE.md → Diseño.
const bodyFont = Lexend({ variable: "--font-sans", subsets: ["latin"] });
const displayFont = Bricolage_Grotesque({ variable: "--font-display", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: { default: "EcoPuntos", template: "%s · EcoPuntos" },
  description: "Gana puntos por consumir y actuar de forma sustentable.",
  applicationName: "EcoPuntos",
  // iPhone: pantalla completa al abrirla desde el inicio y su ícono.
  appleWebApp: { capable: true, title: "EcoPuntos", statusBarStyle: "default" },
  icons: { icon: "/icons/icon-192.png", apple: "/icons/apple-touch-icon.png" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#f2f5f1",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={`${bodyFont.variable} ${displayFont.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-background text-foreground">
        {children}
        <ServiceWorkerRegistration />
      </body>
    </html>
  );
}
