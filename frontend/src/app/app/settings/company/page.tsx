'use client';

import React, { useState, useEffect } from 'react';
import { Sliders, ShieldAlert, CheckCircle, Info, HelpCircle } from 'lucide-react';
import { api } from '@/lib/api';
import { getUser } from '@/lib/auth';

export default function CompanySettingsPage() {
  const [user, setUser] = useState<any>(null);
  const [settings, setSettings] = useState<any>({
    defaultCheckinGraceMinutes: 30,
    defaultCheckinSendTime: '',
    allowManagerExport: true,
    allowViewerReports: true,
    enableRemoteCheckin: true,
    enableBatchCheckin: true,
    enableMedicalCertificates: true,
    whatsappCheckinMessage: '',
    whatsappNotRespondedMessage: '',
    whatsappManagerAlertMessage: '',
  });

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  useEffect(() => {
    const loggedUser = getUser();
    setUser(loggedUser);

    if (loggedUser && (loggedUser.role === 'ADMIN' || loggedUser.role === 'HR')) {
      fetchSettings();
    } else {
      setIsLoading(false);
    }
  }, []);

  const fetchSettings = async () => {
    setIsLoading(true);
    setError('');
    try {
      const res = await api.get('/company-settings');
      if (res.success) {
        setSettings({
          defaultCheckinGraceMinutes: res.data.defaultCheckinGraceMinutes ?? 30,
          defaultCheckinSendTime: res.data.defaultCheckinSendTime ?? '',
          allowManagerExport: res.data.allowManagerExport ?? true,
          allowViewerReports: res.data.allowViewerReports ?? true,
          enableRemoteCheckin: res.data.enableRemoteCheckin ?? true,
          enableBatchCheckin: res.data.enableBatchCheckin ?? true,
          enableMedicalCertificates: res.data.enableMedicalCertificates ?? true,
          whatsappCheckinMessage: res.data.whatsappCheckinMessage ?? '',
          whatsappNotRespondedMessage: res.data.whatsappNotRespondedMessage ?? '',
          whatsappManagerAlertMessage: res.data.whatsappManagerAlertMessage ?? '',
        });
      } else {
        setError(res.error?.message || 'Erro ao carregar configurações da empresa.');
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
      const payload = {
        ...settings,
        defaultCheckinGraceMinutes: parseInt(String(settings.defaultCheckinGraceMinutes), 10),
        defaultCheckinSendTime: settings.defaultCheckinSendTime || null,
        whatsappCheckinMessage: settings.whatsappCheckinMessage || null,
        whatsappNotRespondedMessage: settings.whatsappNotRespondedMessage || null,
        whatsappManagerAlertMessage: settings.whatsappManagerAlertMessage || null,
      };

      const res = await api.patch('/company-settings', payload);
      if (res.success) {
        setSuccessMsg('Configurações da empresa salvas com sucesso!');
        // Scroll to top to see success message
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } else {
        setError(res.error?.message || 'Erro ao salvar configurações.');
      }
    } catch (err) {
      setError('Erro de conexão ao salvar.');
    } finally {
      setIsSaving(false);
    }
  };

  if (!user) {
    return (
      <div className="py-20 flex flex-col items-center gap-3">
        <div className="w-8 h-8 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
        <span className="text-sm text-slate-400">Verificando permissões...</span>
      </div>
    );
  }

  // Enforce ADMIN or HR role
  if (user.role !== 'ADMIN' && user.role !== 'HR') {
    return (
      <div className="max-w-xl mx-auto py-16 text-center text-slate-400 flex flex-col items-center gap-4">
        <ShieldAlert className="w-16 h-16 text-red-500" />
        <h1 className="text-2xl font-bold text-white">Acesso Negado</h1>
        <p className="text-sm">
          Apenas usuários com perfil de **Administrador** ou **Recursos Humanos** podem visualizar ou alterar as configurações operacionais da empresa.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto pb-16 space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-white flex items-center gap-2">
          <Sliders className="w-8 h-8 text-indigo-500" />
          <span>Configurações Operacionais</span>
        </h1>
        <p className="text-slate-400 text-sm mt-1">
          Parametrize tolerâncias, controle permissões operacionais e customize templates de mensagens do sistema.
        </p>
      </div>

      {isLoading ? (
        <div className="py-20 flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
          <span className="text-sm text-slate-400">Carregando configurações...</span>
        </div>
      ) : (
        <form onSubmit={handleSave} className="space-y-6">
          {/* Success Banner */}
          {successMsg && (
            <div className="p-4 rounded-xl border border-emerald-800/40 bg-emerald-950/20 text-emerald-300 flex items-center gap-3 shadow-lg">
              <CheckCircle className="w-5 h-5 text-emerald-400 shrink-0" />
              <span className="text-sm font-medium">{successMsg}</span>
            </div>
          )}

          {/* Error Banner */}
          {error && (
            <div className="p-4 rounded-xl border border-red-800/40 bg-red-950/20 text-red-300 flex items-center gap-3 shadow-lg">
              <ShieldAlert className="w-5 h-5 text-red-400 shrink-0" />
              <span className="text-sm font-medium">{error}</span>
            </div>
          )}

          {/* Módulos e Funcionalidades (Toggles) */}
          <div className="p-6 rounded-xl border border-slate-800 bg-slate-900 shadow-xl space-y-6">
            <h2 className="text-lg font-bold text-white border-b border-slate-800 pb-3">Ativação de Recursos</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Checkin Remoto */}
              <div className="flex items-start justify-between p-4 rounded-lg bg-slate-950/50 border border-slate-800/40">
                <div className="space-y-0.5">
                  <label className="text-sm font-bold text-slate-200">Check-in Remoto</label>
                  <p className="text-xs text-slate-500">Habilita solicitações e marcações de presença para equipe remota.</p>
                </div>
                <input
                  type="checkbox"
                  checked={settings.enableRemoteCheckin}
                  onChange={(e) => setSettings({ ...settings, enableRemoteCheckin: e.target.checked })}
                  className="w-4 h-4 rounded text-indigo-600 bg-slate-900 border-slate-800 focus:ring-indigo-500 focus:ring-offset-slate-900 mt-1 cursor-pointer"
                />
              </div>

              {/* Checkin em Lote */}
              <div className="flex items-start justify-between p-4 rounded-lg bg-slate-950/50 border border-slate-800/40">
                <div className="space-y-0.5">
                  <label className="text-sm font-bold text-slate-200">Disparo de Check-in em Lote</label>
                  <p className="text-xs text-slate-500">Permite o envio em massa de solicitações no início do dia.</p>
                </div>
                <input
                  type="checkbox"
                  checked={settings.enableBatchCheckin}
                  onChange={(e) => setSettings({ ...settings, enableBatchCheckin: e.target.checked })}
                  className="w-4 h-4 rounded text-indigo-600 bg-slate-900 border-slate-800 focus:ring-indigo-500 focus:ring-offset-slate-900 mt-1 cursor-pointer"
                />
              </div>

              {/* Módulo de Atestados */}
              <div className="flex items-start justify-between p-4 rounded-lg bg-slate-950/50 border border-slate-800/40">
                <div className="space-y-0.5">
                  <label className="text-sm font-bold text-slate-200">Módulo de Atestados Médicos</label>
                  <p className="text-xs text-slate-500">Habilita upload de atestados, revisão e controle de afastamentos.</p>
                </div>
                <input
                  type="checkbox"
                  checked={settings.enableMedicalCertificates}
                  onChange={(e) => setSettings({ ...settings, enableMedicalCertificates: e.target.checked })}
                  className="w-4 h-4 rounded text-indigo-600 bg-slate-900 border-slate-800 focus:ring-indigo-500 focus:ring-offset-slate-900 mt-1 cursor-pointer"
                />
              </div>
            </div>
          </div>

          {/* Permissões Adicionais (RBAC Settings) */}
          <div className="p-6 rounded-xl border border-slate-800 bg-slate-900 shadow-xl space-y-6">
            <h2 className="text-lg font-bold text-white border-b border-slate-800 pb-3">Controle de Perfis & Relatórios</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Allow Manager Export */}
              <div className="flex items-start justify-between p-4 rounded-lg bg-slate-950/50 border border-slate-800/40">
                <div className="space-y-0.5">
                  <label className="text-sm font-bold text-slate-200">Exportação por Gestores</label>
                  <p className="text-xs text-slate-500">Permite que perfis do tipo GESTOR exportem relatórios de equipe em CSV.</p>
                </div>
                <input
                  type="checkbox"
                  checked={settings.allowManagerExport}
                  onChange={(e) => setSettings({ ...settings, allowManagerExport: e.target.checked })}
                  className="w-4 h-4 rounded text-indigo-600 bg-slate-900 border-slate-800 focus:ring-indigo-500 focus:ring-offset-slate-900 mt-1 cursor-pointer"
                />
              </div>

              {/* Allow Viewer Reports */}
              <div className="flex items-start justify-between p-4 rounded-lg bg-slate-950/50 border border-slate-800/40">
                <div className="space-y-0.5">
                  <label className="text-sm font-bold text-slate-200">Relatórios para Visualizadores</label>
                  <p className="text-xs text-slate-500">Libera o acesso às telas de relatórios operacionais para perfis de leitura.</p>
                </div>
                <input
                  type="checkbox"
                  checked={settings.allowViewerReports}
                  onChange={(e) => setSettings({ ...settings, allowViewerReports: e.target.checked })}
                  className="w-4 h-4 rounded text-indigo-600 bg-slate-900 border-slate-800 focus:ring-indigo-500 focus:ring-offset-slate-900 mt-1 cursor-pointer"
                />
              </div>
            </div>
          </div>

          {/* Parâmetros Operacionais (Tolerâncias e Horários) */}
          <div className="p-6 rounded-xl border border-slate-800 bg-slate-900 shadow-xl space-y-6">
            <h2 className="text-lg font-bold text-white border-b border-slate-800 pb-3">Tolerâncias & Horários</h2>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              {/* Grace Period */}
              <div>
                <label className="block text-sm font-bold text-slate-200 mb-2">Tolerância Padrão de Resposta (minutos)</label>
                <input
                  type="number"
                  min="5"
                  max="240"
                  required
                  value={settings.defaultCheckinGraceMinutes}
                  onChange={(e) => setSettings({ ...settings, defaultCheckinGraceMinutes: e.target.value })}
                  className="block w-full px-4 py-2.5 rounded-lg bg-slate-950 border border-slate-800 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm"
                  placeholder="30"
                />
                <p className="text-[10px] text-slate-500 mt-1">Tempo tolerado (de 5 a 240) antes do check-in remoto expirar como Sem Resposta.</p>
              </div>

              {/* Time of Batch Dispatch */}
              <div>
                <label className="block text-sm font-bold text-slate-200 mb-2">Horário Padrão de Envio (Opcional)</label>
                <input
                  type="text"
                  pattern="^(?:[01]\d|2[0-3]):[0-5]\d$"
                  value={settings.defaultCheckinSendTime || ''}
                  onChange={(e) => setSettings({ ...settings, defaultCheckinSendTime: e.target.value })}
                  className="block w-full px-4 py-2.5 rounded-lg bg-slate-950 border border-slate-800 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm"
                  placeholder="08:00"
                />
                <p className="text-[10px] text-slate-500 mt-1">Horário padrão sugerido no formato HH:mm (ex. 08:30).</p>
              </div>
            </div>
          </div>

          {/* Templates de Mensagem do WhatsApp */}
          <div className="p-6 rounded-xl border border-slate-800 bg-slate-900 shadow-xl space-y-6">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h2 className="text-lg font-bold text-white">Templates de Mensagens WhatsApp</h2>
              <span className="text-[10px] px-2 py-0.5 rounded bg-indigo-950 text-indigo-400 border border-indigo-900/50 flex items-center gap-1">
                <Info className="w-3 h-3" />
                Variáveis Habilitadas
              </span>
            </div>

            {/* Help Alert on Placeholders */}
            <div className="p-4 rounded-lg bg-slate-950/60 border border-slate-800/80 space-y-2">
              <h3 className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                <HelpCircle className="w-4 h-4 text-indigo-400 shrink-0" />
                Como utilizar variáveis (Placeholders)?
              </h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Você pode utilizar os placeholders abaixo em qualquer parte do texto. Eles serão substituídos automaticamente em tempo de execução:
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 pt-1 font-mono text-[10px]">
                <div className="p-1.5 rounded bg-slate-900 border border-slate-800 text-slate-300 text-center" title="Nome do funcionário">{"{{employeeName}}"}</div>
                <div className="p-1.5 rounded bg-slate-900 border border-slate-800 text-slate-300 text-center" title="Nome da empresa">{"{{companyName}}"}</div>
                <div className="p-1.5 rounded bg-slate-900 border border-slate-800 text-slate-300 text-center" title="Data civil do check-in">{"{{date}}"}</div>
                <div className="p-1.5 rounded bg-slate-900 border border-slate-800 text-slate-300 text-center" title="Nome do gestor do funcionário">{"{{managerName}}"}</div>
                <div className="p-1.5 rounded bg-slate-900 border border-slate-800 text-slate-300 text-center" title="Minutos de tolerância">{"{{graceMinutes}}"}</div>
              </div>
            </div>

            {/* Check-in Message */}
            <div className="space-y-2">
              <label className="block text-sm font-bold text-slate-200">Mensagem Padrão de Check-in (Enviada ao Funcionário)</label>
              <textarea
                maxLength={1000}
                rows={4}
                value={settings.whatsappCheckinMessage || ''}
                onChange={(e) => setSettings({ ...settings, whatsappCheckinMessage: e.target.value })}
                className="block w-full px-4 py-3 rounded-lg bg-slate-950 border border-slate-800 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-xs font-sans leading-relaxed"
                placeholder="Deixe em branco para usar o fallback padrão do sistema..."
              />
              <p className="text-[10px] text-slate-500">Fallback: Bom dia, {"{{employeeName}}"}. Você já iniciou sua jornada remota hoje?... (Opções de 1 a 5).</p>
            </div>

            {/* Not Responded Message */}
            <div className="space-y-2">
              <label className="block text-sm font-bold text-slate-200">Mensagem de Sem Resposta (Enviada ao Funcionário)</label>
              <textarea
                maxLength={1000}
                rows={4}
                value={settings.whatsappNotRespondedMessage || ''}
                onChange={(e) => setSettings({ ...settings, whatsappNotRespondedMessage: e.target.value })}
                className="block w-full px-4 py-3 rounded-lg bg-slate-950 border border-slate-800 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-xs font-sans leading-relaxed"
                placeholder="Deixe em branco para usar o fallback padrão do sistema..."
              />
              <p className="text-[10px] text-slate-500">Fallback: Prezado(a) {"{{employeeName}}"}, seu check-in remoto do dia {"{{date}}"} foi marcado como Não Respondido...</p>
            </div>

            {/* Manager Alert Message */}
            <div className="space-y-2">
              <label className="block text-sm font-bold text-slate-200">Mensagem de Alerta ao Gestor (Enviada ao WhatsApp do Gestor)</label>
              <textarea
                maxLength={1000}
                rows={4}
                value={settings.whatsappManagerAlertMessage || ''}
                onChange={(e) => setSettings({ ...settings, whatsappManagerAlertMessage: e.target.value })}
                className="block w-full px-4 py-3 rounded-lg bg-slate-950 border border-slate-800 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-xs font-sans leading-relaxed"
                placeholder="Deixe em branco para usar o fallback padrão do sistema..."
              />
              <p className="text-[10px] text-slate-500">Fallback: Prezado(a) {"{{managerName}}"}, notificamos que o funcionário {"{{employeeName}}"} não respondeu ao check-in...</p>
            </div>
          </div>

          {/* Form Actions */}
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={fetchSettings}
              disabled={isSaving}
              className="px-5 py-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-bold transition-all cursor-pointer disabled:opacity-50"
            >
              Resetar
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="px-6 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-bold shadow-md shadow-indigo-600/10 transition-all cursor-pointer disabled:opacity-50 flex items-center gap-2"
            >
              {isSaving ? 'Salvando...' : 'Salvar Alterações'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
