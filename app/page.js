import { redirect } from 'next/navigation';
import { getServerSession } from '../lib/auth';
import AppClient from './AppClient';

export default function Home() {
  const session = getServerSession();
  if (!session) redirect('/login');
  const empresa = session.empresaId ? {
    slug: session.empresaSlug, nombre: session.empresaNombre, nombreCorto: session.empresaNombreCorto, ciudad: session.empresaCiudad,
    logoUrl: session.empresaLogoUrl, colorPrimario: session.empresaColorPrimario, colorAcento: session.empresaColorAcento
  } : null;
  return (
    <AppClient
      role={session.role} name={session.name} username={session.username}
      esAdminPlataforma={!!session.esAdminPlataforma}
      empresa={empresa}
    />
  );
}
