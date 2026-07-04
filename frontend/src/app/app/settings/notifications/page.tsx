'use client';

import React, { useState, useEffect } from 'react';
import { Bell, ShieldAlert, CheckCircle2, Info, Save, Clock, AlertTriangle, ToggleLeft, ToggleRight } from 'lucide-react';
import { api } from '@/lib/api';
import { getUser } from '@/lib/auth';

interface PreferenceItem {
  id?: string;
  role: string | null;
  type: string | null;
  severity: 'INFO' | 'SUCCESS' | 'WARNING' | 'CRITICAL' | null;
  enabled: boolean;
  digestEnabled: boolean;
  quietHoursStart: string | null;
  quietHoursEnd: string | null;
}

export default function NotificationsSettingsPage() {
  const [user, setUser] = useState<any>(null);
  const [preferences, setPreferences] = useState<PreferenceItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Default company settings (quiet hours, digest)
  const [quietHoursEnabled, setQuietHoursEnabled] = useState(false);
  const [quietHoursStart, setQuietHoursStart] = useState('22:00');
  const [quietHoursEnd, setQuietHoursEnd] = useState('06:00');
  const [digestEnabled, setDigestEnabled] = useState(false);

  useEffect(() => {
    const loggedUser = getUser();
    setUser(loggedUser);

    if (loggedUser && ['ADMIN', 'HR'].includes(loggedUser.role)) {
      fetchPreferences();
    } else {
      setIsLoading(false);
    }
  }, []);

  const fetchPreferences = async () => {
    setIsLoading(true);
    setError('');
    try {
      const res: any = await api.get('/notification-preferences');
      if (res.success && Array.isArray(res.data)) {
        setPreferences(res.data);
        // If there's a company-wide default preference, load quiet hours from it
        const defaultPref = res.data.find(
          (p: any) => p.role === null && p.type === null && p.severity === null
        );
        if (defaultPref) {
          setQuietHoursEnabled(!!defaultPref.quietHoursStart);
          setQuietHoursStart(defaultPref.quietHoursStart || '22:00');
          setQuietHoursEnd(defaultPref.quietHoursEnd || '06:00');
          setDigestEnabled(defaultPref.digestEnabled);
        }
      } else {
        setError(res.error?.message || 'Erro ao carregar preferências.');
      }
    } catch (err) {
      setError('Erro de conexão com o servidor.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');
    setIsSaving(true);

    try {
      // Find or create default preference record
      const defaultPref = preferences.find(
        (p) => p.role === null && p.type === null && p.severity === null
      ) || {
        role: null,
        type: null,
        severity: null,
        enabled: true,
        digestEnabled: false,
        quietHoursStart: null,
        quietHoursEnd: null,
      };

      const updatedDefault: PreferenceItem = {
        ...defaultPref,
        quietHoursStart: quietHoursEnabled ? quietHoursStart : null,
        quietHoursEnd: quietHoursEnabled ? quietHoursEnd : null,
        digestEnabled: digestEnabled,
        enabled: true,
      };

      // Gather other role-specific mutes in the table
      const listToSave = [
        updatedDefault,
        ...preferences.filter((p) => p.role !== null || p.type !== null || p.severity !== null),
      ];

      const res: any = await api.patch('/notification-preferences', {
        preferences: listToSave,
      });

      if (res.success) {
        setSuccessMsg('Preferências de notificações salvas com sucesso!');
        fetchPreferences();
      } else {
        setError(res.error?.message || 'Erro ao salvar preferências.');
      }
    } catch (err) {
      setError('Erro de conexão com o servidor.');
    } finally {
      setIsSaving(false);
    }
  };

  const togglePreference = (index: number) => {
    setPreferences((prev) =>
      prev.map((pref, i) => (i === index ? { ...pref, enabled: !pref.enabled } : pref))
    );
  };

  const addRoleRule = (role: string) => {
    // Check if already exists
    const exists = preferences.some((p) => p.role === role && p.type === null);
    if (exists) return;

    setPreferences((prev) => [
      ...prev,
      {
        role,
        type: null,
        severity: null,
        enabled: true,
        digestEnabled: false,
        quietHoursStart: null,
        quietHoursEnd: null,
      },
    ]);
  };

  const removeRule = (index: number) => {
    setPreferences((prev) => prev.filter((_, i) => i !== index));
  };

  if (isLoading) {
    return (
      <div className="py-20 flex flex-col items-center gap-3">
        <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
        <span className="text-xs text-slate-400 font-semibold">Carregando configurações...</span>
      </div>
    );
  }

  if (!user || !['ADMIN', 'HR'].includes(user.role)) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="w-16 h-16 rounded-full bg-red-950/50 border border-red-800 flex items-center justify-center mb-6">
          <ShieldAlert className="w-8 h-8 text-red-400" />
        </div>
        <h2 className="text-2xl font-bold text-white mb-2">Acesso Negado</h2>
        <p className="text-slate-400 max-w-md text-sm leading-relaxed">
          Apenas usuários com perfil Administrador (ADMIN) ou Recursos Humanos (HR) podem gerenciar preferências corporativas.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
          <Bell className="w-6 h-6 text-indigo-500" />
          Preferências de Notificações
        </h1>
        <p className="text-sm text-slate-400 mt-1">
          Configure regras de supressão, horário de silêncio e agrupamento diário para as notificações da sua empresa.
        </p>
      </div>

      {successMsg && (
        <div className="flex items-center gap-2.5 p-4 rounded-lg bg-emerald-950/30 border border-emerald-800/30 text-emerald-400 text-xs font-semibold">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          {successMsg}
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2.5 p-4 rounded-lg bg-red-950/30 border border-red-800/30 text-red-400 text-xs font-semibold">
          <ShieldAlert className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-6">
        {/* Section 1: Horário de Silêncio e Digest */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-6">
          <h2 className="text-sm font-bold text-slate-100 flex items-center gap-2">
            <Clock className="w-4.5 h-4.5 text-indigo-400" />
            Consolidado Diário & Horário de Silêncio
          </h2>
          <p className="text-xs text-slate-400 leading-relaxed">
            Configure se deseja silenciar o envio de alertas operacionais no celular durante a noite, acumulando-os para um resumo consolidado gerado no final do dia.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
            {/* Quiet Hours toggle */}
            <div className="space-y-3 bg-slate-950 p-4 border border-slate-850 rounded-lg">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-slate-200 block">Ativar Horário de Silêncio</span>
                  <span className="text-[10px] text-slate-500">Muta alertas durante o período programado</span>
                </div>
                <button
                  type="button"
                  onClick={() => setQuietHoursEnabled(!quietHoursEnabled)}
                  className="text-slate-400 hover:text-white transition-colors cursor-pointer"
                >
                  {quietHoursEnabled ? (
                    <ToggleRight className="w-9 h-9 text-indigo-500" />
                  ) : (
                    <ToggleLeft className="w-9 h-9 text-slate-600" />
                  )}
                </button>
              </div>

              {quietHoursEnabled && (
                <div className="flex items-center gap-3 pt-2">
                  <div className="flex-1">
                    <label className="text-[10px] text-slate-400 font-semibold block mb-1">Início</label>
                    <input
                      type="text"
                      placeholder="22:00"
                      value={quietHoursStart}
                      onChange={(e) => setQuietHoursStart(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-600"
                    />
                  </div>
                  <div className="flex-1">
                    <label className="text-[10px] text-slate-400 font-semibold block mb-1">Fim</label>
                    <input
                      type="text"
                      placeholder="06:00"
                      value={quietHoursEnd}
                      onChange={(e) => setQuietHoursEnd(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-600"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Digest Toggle */}
            <div className="space-y-3 bg-slate-950 p-4 border border-slate-850 rounded-lg flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-slate-200 block">Gerar Resumo Diário</span>
                  <span className="text-[10px] text-slate-500">Gera um compilado interno de notificações no fim do dia</span>
                </div>
                <button
                  type="button"
                  onClick={() => setDigestEnabled(!digestEnabled)}
                  className="text-slate-400 hover:text-white transition-colors cursor-pointer"
                >
                  {digestEnabled ? (
                    <ToggleRight className="w-9 h-9 text-indigo-500" />
                  ) : (
                    <ToggleLeft className="w-9 h-9 text-slate-600" />
                  )}
                </button>
              </div>
              <div className="text-[10px] text-slate-500 border-t border-slate-850 pt-2 flex items-center gap-1.5">
                <Info className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                Dica: Notificações Críticas de faturamento ignoram silêncio.
              </div>
            </div>
          </div>
        </div>

        {/* Section 2: Supressão por perfil */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                <ShieldAlert className="w-4.5 h-4.5 text-indigo-400" />
                Preferências de Envio por Papel (Mute)
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Desabilite o recebimento de notificações in-app específicas para determinados perfis.
              </p>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => addRoleRule('MANAGER')}
                className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-750 border border-slate-700 text-[10px] font-bold text-slate-200 rounded-lg transition-colors cursor-pointer"
              >
                + Regra para Gestores
              </button>
              <button
                type="button"
                onClick={() => addRoleRule('HR')}
                className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-750 border border-slate-700 text-[10px] font-bold text-slate-200 rounded-lg transition-colors cursor-pointer"
              >
                + Regra para HR
              </button>
            </div>
          </div>

          <div className="border border-slate-850 rounded-lg overflow-hidden">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-950/60 border-b border-slate-850 text-slate-400 font-semibold">
                  <th className="p-3">Papel do Usuário</th>
                  <th className="p-3">Tipo / Severidade</th>
                  <th className="p-3">Status de Entrega</th>
                  <th className="p-3 text-right">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-850/60 text-slate-300">
                {preferences.filter((p) => p.role !== null).length === 0 ? (
                  <tr>
                    <td colSpan={4} className="p-8 text-center text-slate-500 italic text-[11px]">
                      Nenhuma regra personalizada configurada para papéis. O padrão de envio do sistema está ativo.
                    </td>
                  </tr>
                ) : (
                  preferences
                    .map((pref, index) => ({ pref, originalIndex: index }))
                    .filter((item) => item.pref.role !== null)
                    .map((item) => (
                      <tr key={item.originalIndex} className="hover:bg-slate-950/20">
                        <td className="p-3 font-semibold text-slate-200">{item.pref.role}</td>
                        <td className="p-3 text-slate-400">
                          {item.pref.type ? `Tipo: ${item.pref.type}` : 'Todas as Notificações'}
                        </td>
                        <td className="p-3">
                          <button
                            type="button"
                            onClick={() => togglePreference(item.originalIndex)}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-bold rounded-full border cursor-pointer transition-all"
                          >
                            <span
                              className={`w-1.5 h-1.5 rounded-full ${
                                item.pref.enabled ? 'bg-emerald-500' : 'bg-rose-500'
                              }`}
                            ></span>
                            {item.pref.enabled ? 'Ativo' : 'Silenciado'}
                          </button>
                        </td>
                        <td className="p-3 text-right">
                          <button
                            type="button"
                            onClick={() => removeRule(item.originalIndex)}
                            className="text-slate-500 hover:text-rose-400 text-[10px] font-bold transition-colors cursor-pointer"
                          >
                            Remover
                          </button>
                        </td>
                      </tr>
                    ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Save Bar */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            type="submit"
            disabled={isSaving}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-xs font-bold text-white rounded-lg shadow-lg shadow-indigo-600/20 transition-all cursor-pointer"
          >
            <Save className="w-4 h-4" />
            {isSaving ? 'Salvando...' : 'Salvar Preferências'}
          </button>
        </div>
      </form>
    </div>
  );
}
