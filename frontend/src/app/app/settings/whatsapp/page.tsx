'use client';

import React, { useState, useEffect } from 'react';
import {
  MessageSquare,
  ShieldAlert,
  CheckCircle,
  Info,
  HelpCircle,
  Key,
  RefreshCw,
  AlertCircle,
  Loader2,
  Lock,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { api } from '@/lib/api';
import { getUser } from '@/lib/auth';

export default function WhatsAppSettingsPage() {
  const [user, setUser] = useState<any>(null);
  
  // Channel state
  const [channel, setChannel] = useState<any>(null);
  const [provider, setProvider] = useState('SIMULATED');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [webhookSecret, setWebhookSecret] = useState('');
  const [accessToken, setAccessToken] = useState('');
  
  // providerConfig keys (only permitted allowed keys)
  const [phoneNumberId, setPhoneNumberId] = useState('');
  const [businessAccountId, setBusinessAccountId] = useState('');
  const [apiVersion, setApiVersion] = useState('v18.0');

  // Logs state
  const [logs, setLogs] = useState<any[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalLogs, setTotalLogs] = useState(0);
  const [directionFilter, setDirectionFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingLogs, setIsLoadingLogs] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  useEffect(() => {
    const loggedUser = getUser();
    setUser(loggedUser);

    if (loggedUser && ['ADMIN', 'HR'].includes(loggedUser.role)) {
      fetchData();
    } else {
      setIsLoading(false);
    }
  }, []);

  const fetchData = async () => {
    setIsLoading(true);
    setError('');
    setSuccessMsg('');
    try {
      await fetchChannel();
      await fetchLogs(1);
    } catch (err) {
      setError('Erro de conexão ao carregar dados de faturamento.');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchChannel = async () => {
    const res = await api.get('/whatsapp-channel');
    if (res.success && res.data) {
      const data = res.data;
      setChannel(data);
      setProvider(data.provider);
      setPhoneNumber(data.phoneNumber || '');
      setDisplayName(data.displayName || '');
      setPhoneNumberId(data.providerConfig?.phoneNumberId || '');
      setBusinessAccountId(data.providerConfig?.businessAccountId || '');
      setApiVersion(data.providerConfig?.apiVersion || 'v18.0');
    } else {
      setError(res.error?.message || 'Erro ao carregar canal do WhatsApp.');
    }
  };

  const fetchLogs = async (targetPage = 1) => {
    setIsLoadingLogs(true);
    try {
      const params = new URLSearchParams();
      params.append('page', String(targetPage));
      params.append('limit', '8');
      if (directionFilter) params.append('direction', directionFilter);
      if (statusFilter) params.append('status', statusFilter);

      const res = await api.get(`/whatsapp-channel/logs?${params.toString()}`);
      if (res.success && res.data) {
        setLogs(res.data.logs || []);
        setPage(res.data.pagination.page);
        setTotalPages(res.data.pagination.pages);
        setTotalLogs(res.data.pagination.total);
      }
    } catch (err) {
      console.error('Erro ao carregar logs:', err);
    } finally {
      setIsLoadingLogs(false);
    }
  };

  // Reload logs when filters change
  useEffect(() => {
    if (user && ['ADMIN', 'HR'].includes(user.role)) {
      fetchLogs(1);
    }
  }, [directionFilter, statusFilter]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');
    setIsSaving(true);

    try {
      const payload: any = {
        provider,
        phoneNumber: phoneNumber || null,
        displayName: displayName || null,
        webhookSecret: webhookSecret || null,
        accessToken: accessToken || null,
        providerConfig: provider === 'META_CLOUD' ? {
          phoneNumberId: phoneNumberId || null,
          businessAccountId: businessAccountId || null,
          apiVersion: apiVersion || 'v18.0',
        } : {},
      };

      const res = await api.patch('/whatsapp-channel', payload);
      if (res.success) {
        setSuccessMsg('Configurações do canal salvas com sucesso!');
        setWebhookSecret('');
        setAccessToken('');
        await fetchChannel();
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

  if (isLoading) {
    return (
      <div className="py-20 flex flex-col items-center gap-3">
        <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
        <span className="text-sm text-slate-400">Carregando painel de WhatsApp...</span>
      </div>
    );
  }

  if (user && !['ADMIN', 'HR'].includes(user.role)) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="w-16 h-16 rounded-full bg-red-950/50 border border-red-800 flex items-center justify-center mb-6">
          <ShieldAlert className="w-8 h-8 text-red-400" />
        </div>
        <h2 className="text-2xl font-bold text-white mb-2">Acesso Negado</h2>
        <p className="text-slate-400 max-w-md text-sm leading-relaxed mb-6">
          Seu perfil de usuário ({user.role}) não tem permissão para acessar esta página de configurações de WhatsApp.
        </p>
      </div>
    );
  }

  // Webhook URL calculated dynamically
  const appApiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';
  const webhookUrl = `${appApiUrl}/webhooks/whatsapp/${channel?.channelKey}/inbound`;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white flex items-center gap-3">
            <MessageSquare className="w-8 h-8 text-indigo-500" />
            Configurações de WhatsApp
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            Configure a API oficial da Meta Cloud ou utilize o simulador integrado para disparos e recepções.
          </p>
        </div>
        <button
          onClick={fetchData}
          className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 hover:bg-slate-850 text-slate-400 hover:text-white transition-colors cursor-pointer"
          title="Atualizar"
        >
          <RefreshCw className="w-4.5 h-4.5" />
        </button>
      </div>

      {/* Messages feedback */}
      {error && (
        <div className="flex items-center gap-3 p-4 rounded-lg bg-red-950/50 border border-red-800 text-red-200 text-sm">
          <ShieldAlert className="w-5 h-5 text-red-400 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {successMsg && (
        <div className="flex items-center gap-3 p-4 rounded-lg bg-emerald-950/50 border border-emerald-800 text-emerald-250 text-sm">
          <CheckCircle className="w-5 h-5 text-emerald-400 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Main Grid: Forms and Status Card */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Connection Status Card */}
        <div className="lg:col-span-1 space-y-6">
          <div className="p-6 rounded-xl border border-slate-800 bg-slate-900 shadow-xl space-y-6">
            <h2 className="text-sm font-bold text-white uppercase tracking-wider">Status do Provedor</h2>
            
            <div className="flex flex-col items-center justify-center p-6 bg-slate-950/50 border border-slate-850 rounded-xl text-center space-y-4">
              <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${
                channel?.status === 'SIMULATION' ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20' :
                channel?.status === 'CONNECTED' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                channel?.status === 'ERROR' ? 'bg-rose-500/10 text-rose-400 border-rose-500/20' :
                'bg-slate-850 text-slate-400 border-slate-800'
              }`}>
                {channel?.status === 'SIMULATION' ? 'Simulador Ativo' :
                 channel?.status === 'CONNECTED' ? 'Conectado (Real)' :
                 channel?.status === 'ERROR' ? 'Erro de Conexão' : 'Desconectado'}
              </span>
              
              <div className="space-y-1">
                <p className="text-xs text-slate-500">Nome de Exibição</p>
                <p className="text-sm font-semibold text-slate-200">{channel?.displayName || '-'}</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-slate-500">Telefone Vinculado</p>
                <p className="text-sm font-semibold text-slate-200">{channel?.phoneNumber || '-'}</p>
              </div>
            </div>

            {/* Error alerts if status === ERROR */}
            {channel?.status === 'ERROR' && channel?.lastError && (
              <div className="p-3 bg-rose-500/5 border border-rose-500/10 rounded-lg space-y-1">
                <span className="text-[10px] text-rose-400 font-bold uppercase block">Último erro registrado</span>
                <p className="text-xs text-slate-400 leading-relaxed font-mono">{channel.lastError}</p>
              </div>
            )}

            {/* Timestamps */}
            <div className="space-y-3 pt-3 border-t border-slate-800/80 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-550">Chave do Canal:</span>
                <span className="font-mono text-slate-350">{channel?.channelKey.substring(0, 8)}...</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-550">Mensagem Enviada (Outbound):</span>
                <span className="text-slate-350">
                  {channel?.lastOutboundAt ? new Date(channel.lastOutboundAt).toLocaleDateString('pt-BR') : 'nunca'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-550">Mensagem Recebida (Inbound):</span>
                <span className="text-slate-350">
                  {channel?.lastInboundAt ? new Date(channel.lastInboundAt).toLocaleDateString('pt-BR') : 'nunca'}
                </span>
              </div>
            </div>
          </div>

          {/* Webhook Guide card */}
          <div className="p-6 rounded-xl border border-slate-800 bg-slate-900 shadow-xl space-y-4">
            <h2 className="text-sm font-bold text-white uppercase tracking-wider">Webhook de Integração</h2>
            <div className="p-3 bg-indigo-500/5 border border-indigo-500/10 rounded-lg text-slate-400 text-xs leading-relaxed flex gap-2">
              <Info className="w-4.5 h-4.5 text-indigo-500 shrink-0 mt-0.5" />
              <span>
                Cole a URL abaixo no painel de desenvolvedor do Facebook (Meta Webhook API) para receber mensagens de resposta interativas:
              </span>
            </div>
            <div className="space-y-1">
              <label className="block text-[10px] font-bold text-slate-500 uppercase">Webhook Callback URL</label>
              <textarea
                readOnly
                value={webhookUrl}
                onClick={(e) => (e.target as HTMLTextAreaElement).select()}
                className="w-full h-16 p-2 rounded bg-slate-950 border border-slate-850 font-mono text-[10px] text-indigo-400 select-all cursor-pointer focus:outline-none"
              />
            </div>
            <div className="space-y-1">
              <label className="block text-[10px] font-bold text-slate-500 uppercase">Token de Validação (webhookSecret)</label>
              <input
                type="text"
                readOnly
                value={channel?.webhookSecretMasked || ''}
                className="block w-full px-3 py-1.5 rounded bg-slate-950 border border-slate-850 font-mono text-xs text-slate-400 focus:outline-none"
              />
            </div>
          </div>
        </div>

        {/* Configuration settings form */}
        <div className="lg:col-span-2">
          <form onSubmit={handleSave} className="p-6 rounded-xl border border-slate-800 bg-slate-900 shadow-xl space-y-6">
            <h2 className="text-sm font-bold text-white uppercase tracking-wider">Parâmetros de Conexão</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              
              <div className="space-y-1.5 col-span-2">
                <label className="block text-xs font-semibold text-slate-350">Provedor WhatsApp</label>
                <div className="flex gap-4">
                  <label className="flex-1 p-3 rounded-lg border border-slate-800 bg-slate-950 flex items-center gap-3 cursor-pointer hover:border-slate-700 transition-colors">
                    <input
                      type="radio"
                      name="provider"
                      value="SIMULATED"
                      checked={provider === 'SIMULATED'}
                      onChange={() => setProvider('SIMULATED')}
                      className="accent-indigo-600 w-4 h-4"
                    />
                    <div>
                      <p className="text-xs font-bold text-slate-200">Simulador de WhatsApp</p>
                      <p className="text-[10px] text-slate-500 mt-0.5">Disparos em logs virtuais locais.</p>
                    </div>
                  </label>

                  <label className="flex-1 p-3 rounded-lg border border-slate-800 bg-slate-950 flex items-center gap-3 cursor-pointer hover:border-slate-700 transition-colors">
                    <input
                      type="radio"
                      name="provider"
                      value="META_CLOUD"
                      checked={provider === 'META_CLOUD'}
                      onChange={() => setProvider('META_CLOUD')}
                      className="accent-indigo-600 w-4 h-4"
                    />
                    <div>
                      <p className="text-xs font-bold text-slate-200">Meta Cloud API (Oficial)</p>
                      <p className="text-[10px] text-slate-500 mt-0.5">Integração real de produção.</p>
                    </div>
                  </label>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-slate-350">Telefone Exibição</label>
                <input
                  type="text"
                  placeholder="5511999999999"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  className="block w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-slate-350">Nome Exibição</label>
                <input
                  type="text"
                  placeholder="Suporte PF"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="block w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 text-xs"
                />
              </div>

              <div className="space-y-1.5 col-span-2">
                <label className="block text-xs font-semibold text-slate-350">Webhook Secret Token (Para validação do Meta signature)</label>
                <input
                  type="text"
                  placeholder="Insira um token secreto para validar chamadas de webhook (deixe em branco para manter atual)"
                  value={webhookSecret}
                  onChange={(e) => setWebhookSecret(e.target.value)}
                  className="block w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 text-xs"
                />
                <p className="text-[10px] text-slate-550 leading-normal">
                  Este segredo é usado para verificar a autenticidade dos webhooks gerados pela Meta Cloud. Se informado, o backend exigirá a assinatura `x-hub-signature-256` no cabeçalho das requisições inbound.
                </p>
              </div>

              {provider === 'META_CLOUD' && (
                <>
                  <div className="space-y-1.5 col-span-2 pt-4 border-t border-slate-800/80">
                    <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                      <Lock className="w-3.5 h-3.5 text-indigo-400" />
                      Parâmetros Exclusivos da Meta Cloud API
                    </h3>
                  </div>

                  <div className="space-y-1.5 col-span-2">
                    <label className="block text-xs font-semibold text-slate-350">Access Token (Permanent User Token)</label>
                    <input
                      type="password"
                      placeholder={channel?.hasToken ? "•••••••••••••••••••••••••••••••• (Salvo. Digite um novo token para atualizar)" : "Cole o token de acesso de desenvolvedor do Facebook"}
                      value={accessToken}
                      onChange={(e) => setAccessToken(e.target.value)}
                      className="block w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 text-xs"
                    />
                    <p className="text-[10px] text-slate-550">
                      O token de acesso será criptografado no banco usando AES-256-GCM. Ele nunca é exibido de volta nesta tela.
                    </p>
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-xs font-semibold text-slate-350">ID do Número de Telefone (phoneNumberId)</label>
                    <input
                      type="text"
                      placeholder="Ex: 105948375928374"
                      value={phoneNumberId}
                      onChange={(e) => setPhoneNumberId(e.target.value)}
                      className="block w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 text-xs"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-xs font-semibold text-slate-350">ID da Conta Comercial (businessAccountId)</label>
                    <input
                      type="text"
                      placeholder="Ex: 958473859201"
                      value={businessAccountId}
                      onChange={(e) => setBusinessAccountId(e.target.value)}
                      className="block w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 text-xs"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-xs font-semibold text-slate-350">Versão da Graph API (apiVersion)</label>
                    <input
                      type="text"
                      placeholder="v18.0"
                      value={apiVersion}
                      onChange={(e) => setApiVersion(e.target.value)}
                      className="block w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 text-xs"
                    />
                  </div>
                </>
              )}
            </div>

            <div className="pt-4 border-t border-slate-800 flex justify-end">
              <button
                type="submit"
                disabled={isSaving}
                className="px-6 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold flex items-center gap-2 shadow cursor-pointer disabled:opacity-50"
              >
                {isSaving ? 'Salvando...' : 'Salvar Configurações'}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Message logs section */}
      <div className="p-6 rounded-xl border border-slate-800 bg-slate-900 shadow-xl space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-sm font-bold text-white uppercase tracking-wider">Histórico de Logs de Tráfego</h2>
            <p className="text-slate-500 text-[11px] mt-0.5">Auditoria e rastreio de mensagens enviadas e recebidas.</p>
          </div>
          
          {/* Filters */}
          <div className="flex gap-2">
            <select
              value={directionFilter}
              onChange={(e) => setDirectionFilter(e.target.value)}
              className="px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-300 text-xs cursor-pointer focus:outline-none"
            >
              <option value="">Todas Direções</option>
              <option value="INBOUND">Recebidas (Inbound)</option>
              <option value="OUTBOUND">Enviadas (Outbound)</option>
            </select>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-300 text-xs cursor-pointer focus:outline-none"
            >
              <option value="">Todos Status</option>
              <option value="SENT">Enviadas (SENT)</option>
              <option value="RECEIVED">Recebidas (RECEIVED)</option>
              <option value="SIMULATED">Simuladas (SIMULATED)</option>
              <option value="FAILED">Falhas (FAILED)</option>
            </select>
          </div>
        </div>

        {/* Logs Table */}
        <div className="rounded-lg border border-slate-800/80 overflow-hidden bg-slate-950/30">
          {isLoadingLogs ? (
            <div className="py-12 flex flex-col items-center gap-2">
              <Loader2 className="w-6 h-6 text-indigo-500 animate-spin" />
              <span className="text-[11px] text-slate-550">Buscando logs...</span>
            </div>
          ) : logs.length === 0 ? (
            <div className="py-12 text-center text-xs text-slate-500 italic">
              Nenhuma mensagem correspondente nos logs.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-400 border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-900/60 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                    <th className="px-5 py-3">Horário</th>
                    <th className="px-5 py-3">Direção</th>
                    <th className="px-5 py-3">Provedor</th>
                    <th className="px-5 py-3">De</th>
                    <th className="px-5 py-3">Para</th>
                    <th className="px-5 py-3">Mensagem</th>
                    <th className="px-5 py-3 text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {logs.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-900/40 transition-colors">
                      <td className="px-5 py-3.5 font-mono text-[10px] text-slate-500">
                        {new Date(item.createdAt).toLocaleString('pt-BR')}
                      </td>
                      <td className="px-5 py-3.5">
                        <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${
                          item.direction === 'INBOUND' ? 'bg-blue-500/10 text-blue-400' : 'bg-purple-500/10 text-purple-400'
                        }`}>
                          {item.direction === 'INBOUND' ? 'Recebida' : 'Enviada'}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 font-semibold text-slate-400">
                        {item.provider}
                      </td>
                      <td className="px-5 py-3.5 font-mono text-slate-350">{item.from}</td>
                      <td className="px-5 py-3.5 font-mono text-slate-350">{item.to}</td>
                      <td className="px-5 py-3.5 max-w-xs truncate" title={item.body}>
                        {item.body}
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <span className={`px-2 py-0.5 rounded text-[9px] font-bold border ${
                          item.status === 'SENT' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                          item.status === 'RECEIVED' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' :
                          item.status === 'SIMULATED' ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20' :
                          'bg-rose-500/10 text-rose-400 border-rose-500/20'
                        }`}>
                          {item.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Pagination controls */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between pt-2">
            <span className="text-xs text-slate-500">
              Mostrando página {page} de {totalPages} ({totalLogs} logs no total)
            </span>
            <div className="flex gap-2">
              <button
                disabled={page <= 1}
                onClick={() => fetchLogs(page - 1)}
                className="p-1.5 rounded bg-slate-800 hover:bg-slate-750 text-slate-350 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                disabled={page >= totalPages}
                onClick={() => fetchLogs(page + 1)}
                className="p-1.5 rounded bg-slate-800 hover:bg-slate-750 text-slate-350 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
