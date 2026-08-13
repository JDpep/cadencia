import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Cadencia · By Forja Estudio',
  description:
    'Agenda digital para ejecutivos: tus actividades, tu cartera y tu día, en orden. Diseñado para fluir.',
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#F4F1EA' },
    { media: '(prefers-color-scheme: dark)', color: '#1A1A1A' },
  ],
};

/**
 * El tema se resuelve antes de pintar para que no haya parpadeo blanco.
 * Se guarda en localStorage; si no hay preferencia, manda el sistema.
 */
const GUION_TEMA = `
(function () {
  try {
    var guardado = localStorage.getItem('cadencia-tema');
    var oscuro = guardado
      ? guardado === 'oscuro'
      : window.matchMedia('(prefers-color-scheme: dark)').matches;
    if (oscuro) document.documentElement.classList.add('dark');
  } catch (e) {}
})();
`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es-MX" suppressHydrationWarning>
      <head>
        {/*
          Tipografías FORJA. Se cargan por <link> a propósito: si la máquina
          está sin red, la app sigue funcionando con los respaldos declarados
          en globals.css (Helvetica Neue / Georgia).
        */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Archivo:wght@300;400;500;600;700;800&family=Newsreader:ital,opsz,wght@1,6..72,400;1,6..72,500&display=swap"
          rel="stylesheet"
        />
        <script dangerouslySetInnerHTML={{ __html: GUION_TEMA }} />
      </head>
      <body className="min-h-screen bg-superficie text-texto antialiased">{children}</body>
    </html>
  );
}
