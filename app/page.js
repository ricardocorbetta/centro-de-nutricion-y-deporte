import { redirect } from 'next/navigation';
import { getServerSession } from '../lib/auth';
import AppClient from './AppClient';

export default function Home() {
  const session = getServerSession();
  if (!session) redirect('/login');
  return <AppClient role={session.role} name={session.name} username={session.username} />;
}
