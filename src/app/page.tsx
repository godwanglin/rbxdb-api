'use client';
import { useCallback, useEffect, useState } from 'react';
import { Login } from '@/src/components/dashboard/login';
import { Dashboard } from '@/src/components/dashboard/dashboard';
import { webRequest, WebApiError } from '@/src/components/dashboard/api';
import { Brand } from '@/src/components/dashboard/brand';
export default function HomePage() {
  const [username, setUsername] = useState<string | null>(null); const [loading, setLoading] = useState(true); const [error, setError] = useState('');
  const signedOut = useCallback(() => setUsername(null), []);
  useEffect(() => { const controller = new AbortController(); webRequest<{ username: string }>('/api/admin/session', { signal: controller.signal }).then(session => setUsername(session.username)).catch(err => { if (!controller.signal.aborted && !(err instanceof WebApiError && err.status === 401)) setError(err instanceof Error ? err.message : 'Server tidak tersedia.'); }).finally(() => { if (!controller.signal.aborted) setLoading(false); }); return () => controller.abort(); }, []);
  if (loading) return <main className="grid min-h-dvh place-items-center"><div className="space-y-5"><Brand /><p className="text-xs text-[#737c88]" role="status">Memuat workspace…</p></div></main>;
  if (error && !username) return <main className="grid min-h-dvh place-items-center p-6"><div className="max-w-sm space-y-5"><Brand /><p role="alert" className="text-sm text-red-300">{error}</p><button onClick={() => window.location.reload()} className="button">Coba lagi</button></div></main>;
  if (!username) return <Login onLogin={setUsername} />;
  return <Dashboard username={username} onSignedOut={signedOut} />;
}
