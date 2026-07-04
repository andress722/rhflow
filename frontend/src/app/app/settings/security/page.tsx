'use client';

import React, { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import {
  ShieldAlert,
  Smartphone,
  Laptop,
  Clock,
  LogOut,
} from 'lucide-react';

export default function SecuritySettingsPage() {
  const [sessions, setSessions] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchSessions();
  }, []);

  const fetchSessions = async () => {
    setIsLoading(true);
    try {
      const res: any = await api.get('/security/sessions');
      if (res.success) {
        setSessions(res.data || []);
      }
    } catch (err) {
      console.error('Error fetching sessions:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRevokeSession = async (sessionId: string) => {
    if (!confirm('Deseja realmente revogar a sessão deste dispositivo? O usuário será deslogado imediatamente.')) return;

    try {
      const res: any = await api.post('/security/sessions/revoke', { sessionId });
      if (res.success) {
        fetchSessions();
      } else {
        alert(res.error?.message || 'Erro ao encerrar sessão.');
      }
    } catch (err) {
      alert('Erro de conexão ao encerrar sessão.');
    }
  };

  if (isLoading) {
    return (
      <div className="py-20 flex flex-col items-center gap-3">
        <div className="w-8 h-8 border-3 border-indigo-650 border-t-transparent rounded-full animate-spin"></div>
        <span className="text-xs text-slate-400 font-semibold">Carregando sessões de segurança...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-white flex items-center gap-2">
          <ShieldAlert className="w-8 h-8 text-indigo-500" />
          Segurança da Conta & Dispositivos
        </h1>
        <p className="text-slate-400 text-sm mt-1">
          Gerencie sessões ativas e revogue o acesso de outros dispositivos de forma imediata (Compliance LGPD).
        </p>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-xl space-y-4">
        <h3 className="text-sm font-bold text-white uppercase tracking-wider">
          Sessões Ativas Atualmente
        </h3>

        <div className="divide-y divide-slate-800/60">
          {sessions.map((session) => {
            const isMobile = session.userAgent.toLowerCase().includes('iphone') || session.userAgent.toLowerCase().includes('android');
            
            return (
              <div key={session.id} className="flex items-center justify-between py-4 first:pt-0 last:pb-0">
                <div className="flex items-start gap-3">
                  <div className="p-2.5 rounded-lg bg-slate-950/60 border border-slate-850 text-indigo-400">
                    {isMobile ? <Smartphone className="w-5 h-5" /> : <Laptop className="w-5 h-5" />}
                  </div>
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <p className="text-xs font-bold text-slate-200">
                        {isMobile ? 'Dispositivo Móvel' : 'Computador / Desktop'}
                      </p>
                      {session.isCurrent && (
                        <span className="px-1.5 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20 text-[8px] font-bold text-emerald-400 uppercase">
                          Sessão Atual
                        </span>
                      )}
                    </div>
                    <p className="text-[10px] text-slate-400">{session.location} • IP: {session.ipAddress}</p>
                    <p className="text-[9px] text-slate-500 font-sans flex items-center gap-1">
                      <Clock className="w-3 h-3 text-slate-600" />
                      <span>Ativo em: {new Date(session.lastActive).toLocaleString('pt-BR')}</span>
                    </p>
                  </div>
                </div>

                {!session.isCurrent && (
                  <button
                    onClick={() => handleRevokeSession(session.id)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-950/20 hover:bg-red-900/20 border border-red-900/30 text-red-400 hover:text-red-300 font-bold text-xs transition-colors cursor-pointer"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Desconectar</span>
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
