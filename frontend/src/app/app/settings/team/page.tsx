'use client';

import React, { useState, useEffect } from 'react';
import { Plus, Search, ShieldAlert, AlertCircle, Mail, UserPlus, CheckCircle2, Copy, Shield, ShieldCheck, Bug } from 'lucide-react';
import { api } from '@/lib/api';
import { getUser } from '@/lib/auth';

export default function TeamSettingsPage() {
  const [activeMembers, setActiveMembers] = useState<any[]>([]);
  const [pendingInvites, setPendingInvites] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [currentUser, setCurrentUser] = useState<any>(null);

  // Invite Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'HR' | 'MANAGER' | 'VIEWER'>('VIEWER');
  const [modalError, setModalError] = useState('');
  const [modalErrorRequestId, setModalErrorRequestId] = useState<string | null>(null);
  const [isInviting, setIsInviting] = useState(false);
  const [lastDebugToken, setLastDebugToken] = useState<string | null>(null);

  // Active tab state: 'members' | 'invites'
  const [activeTab, setActiveTab] = useState<'members' | 'invites'>('members');

  useEffect(() => {
    setCurrentUser(getUser());
    fetchData();
  }, []);

  const fetchData = async () => {
    setIsLoading(true);
    setError('');
    try {
      const [membersRes, invitesRes] = await Promise.all([
        api.get('/users'),
        api.get('/users/invites'),
      ]);

      if (membersRes.success) {
        setActiveMembers(membersRes.data || []);
      } else {
        setError(membersRes.error?.message || 'Erro ao carregar membros da equipe.');
      }

      if (invitesRes.success) {
        // filter out accepted invites or show them accordingly
        setPendingInvites(invitesRes.data || []);
      }
    } catch (err) {
      setError('Erro de conexão com o servidor.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleInviteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isInviting) return;
    setModalError('');
    setModalErrorRequestId(null);
    setIsInviting(true);
    setLastDebugToken(null);

    try {
      const res = await api.post('/users/invite', {
        email: inviteEmail,
        role: inviteRole,
      });

      if (res.success) {
        setInviteEmail('');
        setInviteRole('VIEWER');
        setIsModalOpen(false);
        if (res.data?.debugToken) {
          setLastDebugToken(res.data.debugToken);
        }
        await fetchData();
      } else {
        setModalError(res.error?.message || 'Erro ao criar convite.');
        if (res.error?.requestId) {
          setModalErrorRequestId(res.error.requestId);
        }
      }
    } catch (err) {
      setModalError('Erro de conexão com o servidor.');
    } finally {
      setIsInviting(false);
    }
  };

  const getRoleBadge = (role: string) => {
    switch (role) {
      case 'ADMIN':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-500/10 text-red-400 border border-red-500/20">Administrador</span>;
      case 'HR':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">RH / DP</span>;
      case 'MANAGER':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-500/10 text-purple-400 border border-purple-500/20">Gestor</span>;
      case 'VIEWER':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-800 text-slate-400 border border-slate-700">Leitura</span>;
      default:
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-800 text-slate-400">{role}</span>;
    }
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    return date.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white flex items-center gap-2">
            <Shield className="w-8 h-8 text-indigo-500" />
            <span>Gestão da Equipe</span>
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            Convide e gerencie colaboradores administrativos, mantendo o controle sobre permissões de segurança.
          </p>
        </div>

        {currentUser && ['ADMIN', 'HR'].includes(currentUser.role) && (
          <button
            onClick={() => {
              setModalError('');
              setIsModalOpen(true);
            }}
            className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-sm transition-all shadow-lg shadow-indigo-600/15"
          >
            <UserPlus className="w-4 h-4" />
            <span>Convidar Membro</span>
          </button>
        )}
      </div>

      {/* Debug link panel (dev/test environment only helper) */}
      {lastDebugToken && (
        <div className="p-4 bg-amber-950/30 border border-amber-800/40 rounded-xl space-y-2 animate-pulse">
          <div className="flex items-center gap-2 text-amber-400 text-xs font-semibold">
            <Bug className="w-4 h-4" />
            <span>Link de Convite Gerado (Debug)</span>
          </div>
          <p className="text-[11px] text-slate-400">
            Copie o link abaixo para aceitar o convite no fluxo de testes:
          </p>
          <div className="flex items-center gap-3">
            <input
              type="text"
              readOnly
              value={`${window.location.origin}/accept-invite?token=${lastDebugToken}`}
              className="bg-slate-950 p-2 rounded text-[11px] font-mono border border-slate-800 text-amber-200 flex-1 outline-none"
            />
            <button
              onClick={() => {
                navigator.clipboard.writeText(`${window.location.origin}/accept-invite?token=${lastDebugToken}`);
                alert('Link de convite copiado!');
              }}
              className="px-3 py-2 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/20 rounded text-xs transition-colors"
            >
              Copiar
            </button>
          </div>
        </div>
      )}

      {/* Tabs bar */}
      <div className="flex border-b border-slate-800 gap-6">
        <button
          onClick={() => setActiveTab('members')}
          className={`pb-3 text-sm font-semibold transition-all relative ${
            activeTab === 'members' ? 'text-white' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Membros Ativos ({activeMembers.length})
          {activeTab === 'members' && (
            <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-600 rounded-full"></span>
          )}
        </button>
        <button
          onClick={() => setActiveTab('invites')}
          className={`pb-3 text-sm font-semibold transition-all relative ${
            activeTab === 'invites' ? 'text-white' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Convites Pendentes ({pendingInvites.filter(i => !i.acceptedAt).length})
          {activeTab === 'invites' && (
            <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-600 rounded-full"></span>
          )}
        </button>
      </div>

      {/* Content list */}
      <div className="rounded-xl border border-slate-800 bg-slate-900 overflow-hidden shadow-xl">
        {isLoading ? (
          <div className="py-20 flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
            <span className="text-sm text-slate-400">Buscando dados da equipe...</span>
          </div>
        ) : error ? (
          <div className="py-16 text-center text-slate-400 flex flex-col items-center gap-3">
            <ShieldAlert className="w-12 h-12 text-red-500" />
            <p className="text-sm">{error}</p>
          </div>
        ) : activeTab === 'members' ? (
          activeMembers.length === 0 ? (
            <div className="py-16 text-center text-slate-500">Nenhum membro ativo encontrado.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-900/50 text-slate-400 text-xs font-semibold uppercase tracking-wider">
                    <th className="px-6 py-4">Nome</th>
                    <th className="px-6 py-4">E-mail</th>
                    <th className="px-6 py-4">Perfil</th>
                    <th className="px-6 py-4">Último Login</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 bg-slate-900">
                  {activeMembers.map((member) => (
                    <tr key={member.id} className="hover:bg-slate-800/30 transition-colors">
                      <td className="px-6 py-4 font-medium text-white">{member.name}</td>
                      <td className="px-6 py-4 text-slate-400">{member.email}</td>
                      <td className="px-6 py-4">{getRoleBadge(member.role)}</td>
                      <td className="px-6 py-4 text-slate-400">{formatDate(member.lastLoginAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        ) : (
          pendingInvites.length === 0 ? (
            <div className="py-16 text-center text-slate-500">Nenhum convite pendente.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-900/50 text-slate-400 text-xs font-semibold uppercase tracking-wider">
                    <th className="px-6 py-4">E-mail Convidado</th>
                    <th className="px-6 py-4">Perfil Alvo</th>
                    <th className="px-6 py-4">Criado em</th>
                    <th className="px-6 py-4">Expira em</th>
                    <th className="px-6 py-4">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 bg-slate-900">
                  {pendingInvites.map((invite) => {
                    const isExpired = new Date(invite.expiresAt) < new Date();
                    const statusText = invite.acceptedAt
                      ? 'Aceito'
                      : isExpired
                      ? 'Expirado'
                      : 'Pendente';

                    const statusBadge = invite.acceptedAt ? (
                      <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-xs">Aceito</span>
                    ) : isExpired ? (
                      <span className="px-2 py-0.5 rounded bg-red-500/10 text-red-400 border border-red-500/20 text-xs">Expirado</span>
                    ) : (
                      <span className="px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20 text-xs">Pendente</span>
                    );

                    return (
                      <tr key={invite.id} className="hover:bg-slate-800/30 transition-colors">
                        <td className="px-6 py-4 font-medium text-white">{invite.email}</td>
                        <td className="px-6 py-4">{getRoleBadge(invite.role)}</td>
                        <td className="px-6 py-4 text-slate-400">{formatDate(invite.createdAt)}</td>
                        <td className="px-6 py-4 text-slate-400">{formatDate(invite.expiresAt)}</td>
                        <td className="px-6 py-4">{statusBadge}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )
        )}
      </div>

      {/* Invite Member Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <h3 className="text-xl font-bold text-white mb-2 flex items-center gap-2">
              <Mail className="w-5 h-5 text-indigo-400" />
              <span>Convidar para a Equipe</span>
            </h3>
            <p className="text-slate-400 text-xs mb-6">
              Um e-mail com instruções e link de ativação exclusivo de uso único será enviado ao destinatário.
            </p>

            <form onSubmit={handleInviteSubmit} className="space-y-4">
              {modalError && (
                <div className="flex flex-col gap-1 p-3 rounded bg-red-950/50 border border-red-800 text-red-200 text-xs">
                  <div className="flex items-center gap-3">
                    <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                    <span>{modalError}</span>
                  </div>
                  {modalErrorRequestId && (
                    <span className="text-[10px] text-slate-500 font-mono mt-1 pl-7 block">
                      ID da Requisição: {modalErrorRequestId}
                    </span>
                  )}
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-2">E-mail do Colaborador</label>
                <input
                  type="email"
                  required
                  placeholder="colaborador@empresa.com"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  className="block w-full px-3 py-2 bg-slate-950 border border-slate-850 rounded-lg text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-2">Perfil de Acesso (Role)</label>
                <select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value as any)}
                  className="block w-full px-3 py-2 bg-slate-950 border border-slate-850 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                >
                  <option value="HR">RH / DP (Pode gerenciar ocorrências e convidar)</option>
                  <option value="MANAGER">Gestor (Pode aprovar e gerenciar equipes)</option>
                  <option value="VIEWER">Apenas Leitura (Pode ver relatórios e dashboards)</option>
                </select>
                <span className="text-[10px] text-slate-500 mt-1 block">
                  Por segurança, não é permitido convidar perfis Administradores por link externo.
                </span>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-slate-200 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isInviting || !inviteEmail}
                  className="px-4 py-2 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-850 disabled:cursor-not-allowed rounded-lg shadow transition-all"
                >
                  {isInviting ? 'Gerando convite...' : 'Enviar Convite'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
