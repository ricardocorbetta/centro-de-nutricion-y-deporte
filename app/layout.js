import { Plus_Jakarta_Sans } from 'next/font/google';
import './tokens.css';
import './globals.css';
import AvisosGlobales from './AvisosGlobales';

// Una sola tipografía para toda la app, autoalojada por Next (sin pedidos a Google en cada carga).
// Expone --font-jakarta, que usa app/tokens.css.
const jakarta = Plus_Jakarta_Sans({ subsets: ['latin'], variable: '--font-jakarta', display: 'swap' });

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
    <html lang="es-AR" className={jakarta.variable}>
      <body>
        {children}
        <AvisosGlobales />
      </body>
    </html>
  );
}
