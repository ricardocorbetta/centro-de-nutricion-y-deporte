import { Inter, Fraunces, IBM_Plex_Mono } from 'next/font/google';
import './tokens.css';
import './globals.css';
import AvisosGlobales from './AvisosGlobales';

// Fuentes autoalojadas por Next (sin pedidos a Google en cada carga). Exponen las variables
// --font-inter / --font-fraunces / --font-plex que usa app/tokens.css.
const inter = Inter({ subsets: ['latin'], weight: ['400', '500', '600', '700', '800'], variable: '--font-inter', display: 'swap' });
const fraunces = Fraunces({ subsets: ['latin'], weight: ['500', '600', '700'], variable: '--font-fraunces', display: 'swap' });
const plex = IBM_Plex_Mono({ subsets: ['latin'], weight: ['400', '500'], variable: '--font-plex', display: 'swap' });

export const metadata = {
  title: 'EULALIA — Plataforma de gestión para centros de nutrición y deporte',
  description: 'Agenda, pacientes, caja y comisiones en un solo panel.'
};

export const viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#F4F7F6' },
    { media: '(prefers-color-scheme: dark)', color: '#0F1A1B' }
  ]
};

export default function RootLayout({ children }) {
  return (
    <html lang="es-AR" className={`${inter.variable} ${fraunces.variable} ${plex.variable}`}>
      <body>
        {children}
        <AvisosGlobales />
      </body>
    </html>
  );
}
