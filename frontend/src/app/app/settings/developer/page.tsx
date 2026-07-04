'use client';

import React, { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import {
  Code,
  Plus,
  Trash2,
  Copy,
  Check,
  AlertTriangle,
  Globe,
  Settings,
} from 'lucide-react';

export default function DeveloperSettingsPage() {
  const [keys, setKeys] = useState<any[]>([]);
  const [webhooks, setWebhooks] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Forms
  const [newKeyName, setNewKeyName] = useState('');
  const [newKeyScopes, setNewKeyScopes] = useState<string[]>(['read:checkins']);
  const [generatedKey, setGeneratedKey] = useState<string | null>(null);

  const [newWebhookUrl, setNewWebhookUrl] = useState('');
  const [newWebhookEvents, setNewWebhookEvents] = useState<string[]>(['checkin.created']);

  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const keysRes: any = await api.get('/developer/keys');
      const webhooksRes: any = await api.get('/developer/webhooks');
      if (keysRes.success) setKeys(keysRes.data || []);
      if (webhooksRes.success) setWebhooks(webhooksRes.data || []);
    } catch (err) {
      console.error('Error fetching developer data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateKey = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newKeyName.trim()) return;

    try {
      const res: any = await api.post('/developer/keys', {
        name: newKeyName,
        scopes: newKeyScopes,
      });

      if (res.success && res.data) {
        setGeneratedKey(res.data.rawToken);
        setNewKeyName('');
        fetchData();
      }
    } catch (err) {
      alert('Erro ao gerar chave de API.');
    }
  };

  const handleRevokeKey = async (id: string) => {
    if (!confirm('Tem certeza que deseja revogar esta chave de API permanentemente?')) return;

    try {
      const res: any = await api.delete(`/developer/keys/${id}`);
      if (res.success) {
        fetchData();
      }
    } catch (err) {
      alert('Erro ao revogar chave de API.');
    }
  };

  const handleCreateWebhook = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newWebhookUrl.trim()) return;

    try {
      const res: any = await api.post('/developer/webhooks', {
        url: newWebhookUrl,
        events: newWebhookEvents,
      });

      if (res.success) {
        setNewWebhookUrl('');
        fetchData();
      }
    } catch (err) {
      alert('Erro ao cadastrar webhook.');
    }
  };

  const handleRevokeWebhook = async (id: string) => {
    if (!confirm('Deseja excluir esta inscrição de Webhook?')) return;

    try {
      const res: any = await api.delete(`/developer/webhooks/${id}`);
      if (res.success) {
        fetchData();
      }
    } catch (err) {
      alert('Erro ao remover webhook.');
    }
  };

  const handleCopyKey = () => {
    if (!generatedKey) return;
    navigator.clipboard.writeText(generatedKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (isLoading) {
    return (
      <div className="py-20 flex flex-col items-center gap-3">
        <div className="w-8 h-8 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
        <span className="text-xs text-slate-400 font-semibold">Carregando painel de integrações...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-white flex items-center gap-2">
          <Code className="w-8 h-8 text-indigo-500" />
          Configurações de Desenvolvedor & API
        </h1>
        <p className="text-slate-400 text-sm mt-1">
          Integre sistemas externos (Totvs, Senior, SAP) e assine webhooks de presença e conciliação em tempo real.
        </p>
      </div>

      {/* Generated key banner */}
      {generatedKey && (
        <div className="p-4 rounded-xl bg-indigo-950/20 border border-indigo-500/30 text-indigo-300 space-y-3 animate-fadeIn">
          <div className="flex gap-2 items-start">
            <AlertTriangle className="w-5 h-5 text-indigo-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <h4 className="text-xs font-bold text-white uppercase">Chave Secreta de API Gerada!</h4>
              <p className="text-[11px] leading-relaxed text-slate-400">
                Copie a chave abaixo agora. Por motivos de segurança, você não poderá visualizá-la novamente depois que sair desta página.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 bg-slate-950/60 p-2.5 rounded-lg border border-slate-850 font-mono text-[10px] select-all overflow-x-auto whitespace-nowrap">
            <span className="text-slate-200">{generatedKey}</span>
            <button
              onClick={handleCopyKey}
              className="ml-auto p-1 rounded bg-slate-800 hover:bg-slate-750 text-indigo-400 hover:text-white transition-colors cursor-pointer"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
          </div>
          <button
            onClick={() => setGeneratedKey(null)}
            className="text-[10px] text-indigo-400 hover:text-indigo-300 font-bold transition-all underline cursor-pointer"
          >
            Concluir Cópia
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* API Keys Panel */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-xl space-y-4">
          <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
            <Settings className="w-4 h-4 text-indigo-400" />
            Tokens de API Ativos
          </h3>

          <form onSubmit={handleCreateKey} className="flex gap-2">
            <input
              type="text"
              placeholder="Nome da chave (ex: ERP Senior)"
              value={newKeyName}
              onChange={(e) => setNewKeyName(e.target.value)}
              className="flex-1 px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
            <button
              type="submit"
              className="px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs transition-colors cursor-pointer flex items-center gap-1 shrink-0"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Gerar Chave</span>
            </button>
          </form>

          <div className="space-y-2.5">
            {keys.length === 0 ? (
              <p className="text-xs text-slate-500 italic py-6 text-center">Nenhum token de API cadastrado ainda.</p>
            ) : (
              keys.map((key) => (
                <div key={key.id} className="flex items-center justify-between p-3 rounded-lg bg-slate-950/40 border border-slate-850">
                  <div>
                    <h5 className="text-xs font-bold text-slate-200">{key.name}</h5>
                    <p className="text-[10px] text-slate-500 font-mono mt-0.5">
                      Filtro: {key.keyPrefix}.*** | Escopos: {key.scopes?.join(', ')}
                    </p>
                  </div>
                  <button
                    onClick={() => handleRevokeKey(key.id)}
                    className="p-1.5 rounded bg-red-950/20 hover:bg-red-900/20 border border-red-900/30 text-red-400 transition-colors cursor-pointer"
                    title="Revogar Chave"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Webhooks Panel */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-xl space-y-4">
          <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
            <Globe className="w-4 h-4 text-emerald-400" />
            Inscrições de Webhooks
          </h3>

          <form onSubmit={handleCreateWebhook} className="flex gap-2">
            <input
              type="url"
              placeholder="https://sua-api.com/webhooks/checkins"
              value={newWebhookUrl}
              onChange={(e) => setNewWebhookUrl(e.target.value)}
              className="flex-1 px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
            <button
              type="submit"
              className="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition-colors cursor-pointer flex items-center gap-1 shrink-0"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Assinar</span>
            </button>
          </form>

          <div className="space-y-2.5">
            {webhooks.length === 0 ? (
              <p className="text-xs text-slate-500 italic py-6 text-center">Nenhum webhook assinado ainda.</p>
            ) : (
              webhooks.map((sub) => (
                <div key={sub.id} className="flex items-center justify-between p-3 rounded-lg bg-slate-950/40 border border-slate-850">
                  <div className="overflow-hidden mr-2">
                    <p className="text-xs font-bold text-slate-200 truncate" title={sub.url}>{sub.url}</p>
                    <p className="text-[10px] text-slate-500 font-mono mt-0.5">
                      Eventos: {sub.events?.join(', ')}
                    </p>
                  </div>
                  <button
                    onClick={() => handleRevokeWebhook(sub.id)}
                    className="p-1.5 rounded bg-red-950/20 hover:bg-red-900/20 border border-red-900/30 text-red-400 transition-colors cursor-pointer shrink-0"
                    title="Remover Webhook"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
