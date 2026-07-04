'use client';

import React, { useState, useEffect } from 'react';
import { Bell, Check, Trash2, CheckCircle2, AlertTriangle, AlertCircle, Info, Filter, ArrowRight, Settings, Sliders, Calendar, BookOpen, Plus, ToggleLeft, ToggleRight } from 'lucide-react';
import { api } from '@/lib/api';
import { useRouter } from 'next/navigation';

interface NotificationItem {
  id: string;
  title: string;
  message: string;
  severity: 'INFO' | 'SUCCESS' | 'WARNING' | 'CRITICAL';
  status: 'UNREAD' | 'READ' | 'DISMISSED' | 'RESOLVED';
  actionUrl?: string | null;
  createdAt: string;
}

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

interface EscalationRule {
  id: string;
  companyId?: string | null;
  scope: 'PLATFORM' | 'COMPANY';
  type?: string | null;
  severity?: 'INFO' | 'SUCCESS' | 'WARNING' | 'CRITICAL' | null;
  escalateAfterMinutes: number;
  targetRole: string;
  enabled: boolean;
}

export default function AdminNotificationsPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'alerts' | 'preferences' | 'rules' | 'digest'>('alerts');

  // List alerts states
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(15);

  const [statusFilter, setStatusFilter] = useState<string>('UNREAD');
  const [severityFilter, setSeverityFilter] = useState<string>('');

  // Preferences states
  const [preferences, setPreferences] = useState<PreferenceItem[]>([]);
  const [prefLoading, setPrefLoading] = useState(false);
  const [prefSaving, setPrefSaving] = useState(false);

  // Escalation rules states
  const [rules, setRules] = useState<EscalationRule[]>([]);
  const [rulesLoading, setRulesLoading] = useState(false);
  const [rulesSaving, setRulesSaving] = useState(false);
  
  // New rule form
  const [newRule, setNewRule] = useState({
    scope: 'COMPANY' as 'PLATFORM' | 'COMPANY',
    companyId: '',
    type: '',
    severity: '' as any,
    escalateAfterMinutes: 60,
    targetRole: 'SUPER_ADMIN',
  });

  // Digest states
  const [digestData, setDigestData] = useState<any>(null);
  const [digestLoading, setDigestLoading] = useState(false);
  const [digestError, setDigestError] = useState('');

  useEffect(() => {
    if (activeTab === 'alerts') {
      fetchNotifications();
    } else if (activeTab === 'preferences') {
      fetchPreferences();
    } else if (activeTab === 'rules') {
      fetchRules();
    } else if (activeTab === 'digest') {
      fetchDigest();
    }
  }, [page, statusFilter, severityFilter, activeTab]);

  const fetchNotifications = async () => {
    setLoading(true);
    setError('');
    try {
      let url = `/admin/notifications?page=${page}&pageSize=${pageSize}`;
      if (statusFilter) url += `&status=${statusFilter}`;
      if (severityFilter) url += `&severity=${severityFilter}`;

      const res: any = await api.get(url);
      if (res.success && Array.isArray(res.items)) {
        setNotifications(res.items);
        setTotal(res.total ?? 0);
      } else {
        setError(res.error?.message || 'Erro ao carregar notificações de plataforma.');
      }
    } catch (err) {
      setError('Erro ao carregar dados do servidor.');
    } finally {
      setLoading(false);
    }
  };

  const fetchPreferences = async () => {
    setPrefLoading(true);
    try {
      const res: any = await api.get('/admin/notification-preferences');
      if (res.success && Array.isArray(res.data)) {
        setPreferences(res.data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setPrefLoading(false);
    }
  };

  const fetchRules = async () => {
    setRulesLoading(true);
    try {
      const res: any = await api.get('/admin/notification-escalation-rules');
      if (res.success && Array.isArray(res.data)) {
        setRules(res.data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setRulesLoading(false);
    }
  };

  const fetchDigest = async () => {
    setDigestLoading(true);
    setDigestError('');
    try {
      const res: any = await api.get('/admin/notifications/digest/today');
      if (res.success && res.data) {
        setDigestData(res.data);
      } else {
        setDigestError(res.error?.message || 'Resumo do dia não gerado para plataforma.');
      }
    } catch (err) {
      setDigestError('Erro de conexão ao buscar resumo.');
    } finally {
      setDigestLoading(false);
    }
  };

  const handleAction = async (id: string, action: 'read' | 'dismiss' | 'resolve', actionUrl?: string | null) => {
    try {
      const endpoint = `/admin/notifications/${id}/${action}`;
      const res: any = await api.patch(endpoint);
      if (res.success) {
        if (action === 'read' && actionUrl) {
          router.push(actionUrl);
          return;
        }
        fetchNotifications();
      } else {
        alert(res.error?.message || 'Erro ao processar ação.');
      }
    } catch (err) {
      console.error(err);
      alert('Erro de rede.');
    }
  };

  // Preference save
  const handleSavePreferences = async (e: React.FormEvent) => {
    e.preventDefault();
    setPrefSaving(true);
    try {
      const res: any = await api.patch('/admin/notification-preferences', {
        preferences,
      });
      if (res.success) {
        alert('Preferências salvas!');
        fetchPreferences();
      } else {
        alert(res.error?.message || 'Erro ao salvar.');
      }
    } catch (err) {
      console.error(err);
    } finally {
      setPrefSaving(false);
    }
  };

  const togglePreference = (index: number) => {
    setPreferences((prev) =>
      prev.map((pref, i) => (i === index ? { ...pref, enabled: !pref.enabled } : pref))
    );
  };

  // Escalation Rule CRUD
  const handleCreateRule = async (e: React.FormEvent) => {
    e.preventDefault();
    setRulesSaving(true);
    try {
      const payload = {
        ...newRule,
        companyId: newRule.companyId || null,
        type: newRule.type || null,
        severity: newRule.severity || null,
        escalateAfterMinutes: parseInt(String(newRule.escalateAfterMinutes), 10),
      };
      const res: any = await api.post('/admin/notification-escalation-rules', payload);
      if (res.success) {
        alert('Regra criada com sucesso!');
        setNewRule({
          scope: 'COMPANY',
          companyId: '',
          type: '',
          severity: '',
          escalateAfterMinutes: 60,
          targetRole: 'SUPER_ADMIN',
        });
        fetchRules();
      } else {
        alert(res.error?.message || 'Erro ao criar regra.');
      }
    } catch (err) {
      console.error(err);
    } finally {
      setRulesSaving(false);
    }
  };

  const toggleRule = async (id: string, currentEnabled: boolean) => {
    try {
      const res: any = await api.patch(`/admin/notification-escalation-rules/${id}`, {
        enabled: !currentEnabled,
      });
      if (res.success) {
        setRules((prev) =>
          prev.map((r) => (r.id === id ? { ...r, enabled: !currentEnabled } : r))
        );
      }
    } catch (err) {
      console.error(err);
    }
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'CRITICAL':
        return <AlertCircle className="w-5 h-5 text-red-500" />;
      case 'WARNING':
        return <AlertTriangle className="w-5 h-5 text-amber-500" />;
      case 'SUCCESS':
        return <CheckCircle2 className="w-5 h-5 text-emerald-500" />;
      default:
        return <Info className="w-5 h-5 text-slate-400" />;
    }
  };

  const getSeverityStyles = (severity: string) => {
    switch (severity) {
      case 'CRITICAL':
        return 'bg-red-500/10 border-red-500/20 text-red-400';
      case 'WARNING':
        return 'bg-amber-500/10 border-amber-500/20 text-amber-400';
      case 'SUCCESS':
        return 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400';
      default:
        return 'bg-slate-500/10 border-slate-500/20 text-slate-400';
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const totalPages = Math.ceil(total / pageSize);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            <Bell className="w-6 h-6 text-rose-500" />
            Central de Alertas de Plataforma
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Monitoramento, regras de escalação, resumos e preferências de supressão para Super Admins.
          </p>
        </div>

        {/* Navigation Tabs */}
        <div className="flex flex-wrap bg-slate-900 border border-slate-800 p-1 rounded-xl gap-1">
          <button
            onClick={() => setActiveTab('alerts')}
            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
              activeTab === 'alerts' ? 'bg-slate-800 text-white shadow-md' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Alertas
          </button>
          <button
            onClick={() => setActiveTab('preferences')}
            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
              activeTab === 'preferences' ? 'bg-slate-800 text-white shadow-md' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Preferências (Mute)
          </button>
          <button
            onClick={() => setActiveTab('rules')}
            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
              activeTab === 'rules' ? 'bg-slate-800 text-white shadow-md' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Regras de Escalação
          </button>
          <button
            onClick={() => setActiveTab('digest')}
            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
              activeTab === 'digest' ? 'bg-slate-800 text-white shadow-md' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Resumo Diário
          </button>
        </div>
      </div>

      {activeTab === 'alerts' && (
        <>
          {/* Filters Toolbar */}
          <div className="flex flex-wrap items-center gap-4 bg-slate-900 border border-slate-800 p-4 rounded-xl">
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-400">
              <Filter className="w-3.5 h-3.5" />
              Filtrar por:
            </div>

            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
              className="bg-slate-950 border border-slate-800 text-xs text-slate-200 rounded-lg px-3 py-1.5 focus:outline-none focus:border-indigo-600 cursor-pointer"
            >
              <option value="UNREAD">Não lidas</option>
              <option value="READ">Lidas</option>
              <option value="DISMISSED">Dispensadas</option>
              <option value="RESOLVED">Resolvidas</option>
              <option value="">Todas</option>
            </select>

            <select
              value={severityFilter}
              onChange={(e) => {
                setSeverityFilter(e.target.value);
                setPage(1);
              }}
              className="bg-slate-950 border border-slate-800 text-xs text-slate-200 rounded-lg px-3 py-1.5 focus:outline-none focus:border-indigo-600 cursor-pointer"
            >
              <option value="">Todas as severidades</option>
              <option value="INFO">Informação (INFO)</option>
              <option value="SUCCESS">Sucesso (SUCCESS)</option>
              <option value="WARNING">Atenção (WARNING)</option>
              <option value="CRITICAL">Crítico (CRITICAL)</option>
            </select>
          </div>

          {/* List Container */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-xl">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-20 gap-3">
                <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
                <span className="text-xs text-slate-400 font-semibold">Buscando alertas de plataforma...</span>
              </div>
            ) : error ? (
              <div className="flex flex-col items-center justify-center py-16 text-center px-4">
                <AlertCircle className="w-10 h-10 text-red-500 mb-3" />
                <p className="text-sm font-bold text-white">{error}</p>
                <button
                  onClick={fetchNotifications}
                  className="mt-4 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold rounded-lg text-white transition-colors cursor-pointer"
                >
                  Recarregar
                </button>
              </div>
            ) : notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-24 text-center px-4">
                <div className="w-16 h-16 rounded-full bg-slate-950 flex items-center justify-center mb-4">
                  <Bell className="w-8 h-8 text-slate-600 stroke-[1.5]" />
                </div>
                <h3 className="text-md font-bold text-white">Sem pendências globais</h3>
                <p className="text-xs text-slate-400 mt-1 max-w-sm">
                  Nenhum alerta de plataforma em aberto para os filtros selecionados.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-slate-800/60">
                {notifications.map((notif) => (
                  <div
                    key={notif.id}
                    className={`flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 hover:bg-slate-850/20 transition-all ${
                      notif.status === 'UNREAD' ? 'bg-rose-950/5' : ''
                    }`}
                  >
                    <div className="flex items-start gap-3.5 max-w-3xl">
                      <div className={`w-10 h-10 rounded-xl border flex items-center justify-center shrink-0 ${getSeverityStyles(notif.severity)}`}>
                        {getSeverityIcon(notif.severity)}
                      </div>
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className={`text-sm font-bold ${
                            notif.status === 'UNREAD' ? 'text-slate-100' : 'text-slate-300'
                          }`}>
                            {notif.title}
                          </span>
                          <span className="text-[10px] text-slate-500 font-medium">
                            • {formatDate(notif.createdAt)}
                          </span>
                          {notif.status === 'UNREAD' && (
                            <span className="px-1.5 py-0.5 rounded bg-rose-500/10 text-rose-400 text-[9px] font-bold">
                              Não lido
                            </span>
                          )}
                        </div>
                        <p className={`text-xs leading-relaxed ${
                          notif.status === 'UNREAD' ? 'text-slate-200' : 'text-slate-400'
                        }`}>
                          {notif.message}
                        </p>
                      </div>
                    </div>

                    {/* Actions Toolbar */}
                    <div className="flex items-center gap-2 self-end sm:self-center">
                      {notif.status === 'UNREAD' && (
                        <button
                          onClick={() => handleAction(notif.id, 'read')}
                          className="p-2 rounded-lg bg-slate-950 border border-slate-800 hover:bg-rose-950/20 hover:border-rose-800/40 text-slate-400 hover:text-rose-400 text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer"
                          title="Marcar como lida"
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span className="hidden md:inline">Lida</span>
                        </button>
                      )}

                      {notif.status !== 'RESOLVED' && (
                        <button
                          onClick={() => handleAction(notif.id, 'resolve')}
                          className="p-2 rounded-lg bg-slate-950 border border-slate-800 hover:bg-emerald-950/20 hover:border-emerald-800/40 text-slate-400 hover:text-emerald-400 text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer"
                          title="Resolver"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span className="hidden md:inline">Resolver</span>
                        </button>
                      )}

                      {notif.status !== 'DISMISSED' && (
                        <button
                          onClick={() => handleAction(notif.id, 'dismiss')}
                          className="p-2 rounded-lg bg-slate-950 border border-slate-800 hover:bg-rose-950/20 hover:border-rose-800/40 text-slate-400 hover:text-rose-400 text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer"
                          title="Dispensar"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span className="hidden md:inline">Dispensar</span>
                        </button>
                      )}

                      {notif.actionUrl && (
                        <button
                          onClick={() => handleAction(notif.id, 'read', notif.actionUrl)}
                          className="p-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer shadow-md shadow-rose-600/10"
                          title="Ver detalhes"
                        >
                          <ArrowRight className="w-3.5 h-3.5" />
                          <span className="hidden md:inline">Tratar</span>
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Pagination Footer */}
          {!loading && totalPages > 1 && (
            <div className="flex items-center justify-between bg-slate-900 border border-slate-800 p-4 rounded-xl">
              <span className="text-xs text-slate-400">
                Mostrando <span className="font-semibold text-slate-200">{(page - 1) * pageSize + 1}</span> a{' '}
                <span className="font-semibold text-slate-200">{Math.min(page * pageSize, total)}</span> de{' '}
                <span className="font-semibold text-slate-200">{total}</span> notificações de plataforma
              </span>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="px-3 py-1.5 border border-slate-800 bg-slate-950 rounded-lg text-xs font-semibold text-slate-400 hover:text-slate-200 disabled:opacity-50 transition-colors cursor-pointer"
                >
                  Anterior
                </button>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="px-3 py-1.5 border border-slate-800 bg-slate-950 rounded-lg text-xs font-semibold text-slate-400 hover:text-slate-200 disabled:opacity-50 transition-colors cursor-pointer"
                >
                  Próxima
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {activeTab === 'preferences' && (
        <form onSubmit={handleSavePreferences} className="bg-slate-900 border border-slate-800 p-5 rounded-xl space-y-6">
          <div>
            <h2 className="text-sm font-bold text-slate-100 flex items-center gap-2">
              <Settings className="w-4.5 h-4.5 text-rose-500" />
              Preferências Globais da Plataforma (Mute)
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Silencie alertas específicos da plataforma para evitar spam operacional. Alertas críticos de faturamento ignoram esta configuração.
            </p>
          </div>

          {prefLoading ? (
            <div className="py-10 text-center text-slate-500 text-xs">Carregando preferências globais...</div>
          ) : preferences.length === 0 ? (
            <div className="py-10 text-center text-slate-500 text-xs italic">
              Nenhuma preferência global encontrada no banco de dados.
            </div>
          ) : (
            <div className="border border-slate-800 rounded-lg overflow-hidden">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-950/60 border-b border-slate-800 text-slate-400 font-semibold">
                    <th className="p-3">Tipo de Alerta</th>
                    <th className="p-3">Severidade</th>
                    <th className="p-3">Status de Envio</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-slate-300">
                  {preferences.map((pref, index) => (
                    <tr key={pref.id || index} className="hover:bg-slate-950/10">
                      <td className="p-3 font-semibold text-slate-250">{pref.type || 'Qualquer tipo'}</td>
                      <td className="p-3 text-slate-400">{pref.severity || 'Qualquer severidade'}</td>
                      <td className="p-3">
                        <button
                          type="button"
                          onClick={() => togglePreference(index)}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-bold rounded-full border cursor-pointer transition-all"
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              pref.enabled ? 'bg-emerald-500' : 'bg-rose-500'
                            }`}
                          ></span>
                          {pref.enabled ? 'Ativo' : 'Silenciado'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={prefSaving}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-xs font-bold text-white rounded-lg shadow transition-colors cursor-pointer"
            >
              {prefSaving ? 'Salvando...' : 'Salvar Mutes Globais'}
            </button>
          </div>
        </form>
      )}

      {activeTab === 'rules' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Rules List (Left/Middle) */}
          <div className="lg:col-span-2 bg-slate-900 border border-slate-800 p-5 rounded-xl space-y-4">
            <div>
              <h2 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                <Sliders className="w-4.5 h-4.5 text-rose-500" />
                Regras de Escalação Ativas
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Confira o tempo e papéis de destino para alertas não resolvidos.
              </p>
            </div>

            {rulesLoading ? (
              <div className="py-10 text-center text-slate-500 text-xs">Carregando regras...</div>
            ) : rules.length === 0 ? (
              <div className="py-10 text-center text-slate-500 text-xs italic">
                Nenhuma regra de escalação cadastrada.
              </div>
            ) : (
              <div className="border border-slate-800 rounded-lg overflow-hidden">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-950/60 border-b border-slate-800 text-slate-400 font-semibold">
                      <th className="p-3">Escopo</th>
                      <th className="p-3">Filtros (Tipo/Grav.)</th>
                      <th className="p-3">Atraso</th>
                      <th className="p-3">Destino</th>
                      <th className="p-3 text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 text-slate-300">
                    {rules.map((rule) => (
                      <tr key={rule.id} className="hover:bg-slate-950/10">
                        <td className="p-3 font-semibold text-slate-200">{rule.scope}</td>
                        <td className="p-3 text-slate-400">
                          {rule.type || rule.severity ? (
                            <span>
                              {rule.type && `Tipo: ${rule.type}`}
                              {rule.type && rule.severity && ' + '}
                              {rule.severity && `Severidade: ${rule.severity}`}
                            </span>
                          ) : (
                            'Qualquer Alerta'
                          )}
                        </td>
                        <td className="p-3 font-bold text-indigo-400">{rule.escalateAfterMinutes} min</td>
                        <td className="p-3 text-slate-250 font-medium">{rule.targetRole}</td>
                        <td className="p-3 text-right">
                          <button
                            type="button"
                            onClick={() => toggleRule(rule.id, rule.enabled)}
                            className="text-slate-400 hover:text-white cursor-pointer"
                          >
                            {rule.enabled ? (
                              <ToggleRight className="w-8 h-8 text-indigo-500" />
                            ) : (
                              <ToggleLeft className="w-8 h-8 text-slate-600" />
                            )}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Create Rule (Right) */}
          <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl space-y-4 h-fit">
            <h2 className="text-sm font-bold text-slate-100 flex items-center gap-1.5">
              <Plus className="w-4.5 h-4.5 text-rose-500" />
              Criar Nova Regra
            </h2>

            <form onSubmit={handleCreateRule} className="space-y-4 text-xs">
              <div>
                <label className="text-[10px] text-slate-400 font-bold block mb-1">Escopo da Regra</label>
                <select
                  value={newRule.scope}
                  onChange={(e) => setNewRule({ ...newRule, scope: e.target.value as any })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-200"
                >
                  <option value="PLATFORM">Plataforma (SUPER_ADMIN)</option>
                  <option value="COMPANY">Empresa (Corporativo)</option>
                </select>
              </div>

              {newRule.scope === 'COMPANY' && (
                <div>
                  <label className="text-[10px] text-slate-400 font-bold block mb-1">ID da Empresa (companyId opcional)</label>
                  <input
                    type="text"
                    placeholder="UUID da empresa"
                    value={newRule.companyId}
                    onChange={(e) => setNewRule({ ...newRule, companyId: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 focus:outline-none"
                  />
                </div>
              )}

              <div>
                <label className="text-[10px] text-slate-400 font-bold block mb-1">Tipo da Notificação (opcional)</label>
                <input
                  type="text"
                  placeholder="Ex: WHATSAPP_CHANNEL_ERROR"
                  value={newRule.type}
                  onChange={(e) => setNewRule({ ...newRule, type: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 focus:outline-none"
                />
              </div>

              <div>
                <label className="text-[10px] text-slate-400 font-bold block mb-1">Severidade Mínima (opcional)</label>
                <select
                  value={newRule.severity}
                  onChange={(e) => setNewRule({ ...newRule, severity: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-200"
                >
                  <option value="">Qualquer uma</option>
                  <option value="INFO">INFO</option>
                  <option value="SUCCESS">SUCCESS</option>
                  <option value="WARNING">WARNING</option>
                  <option value="CRITICAL">CRITICAL</option>
                </select>
              </div>

              <div>
                <label className="text-[10px] text-slate-400 font-bold block mb-1">Minutos de atraso para escalação</label>
                <input
                  type="number"
                  value={newRule.escalateAfterMinutes}
                  onChange={(e) => setNewRule({ ...newRule, escalateAfterMinutes: parseInt(e.target.value, 10) || 60 })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 focus:outline-none"
                />
              </div>

              <div>
                <label className="text-[10px] text-slate-400 font-bold block mb-1">Papel Destinatário</label>
                <input
                  type="text"
                  placeholder="Ex: SUPER_ADMIN ou HR"
                  value={newRule.targetRole}
                  onChange={(e) => setNewRule({ ...newRule, targetRole: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 focus:outline-none"
                />
              </div>

              <button
                type="submit"
                disabled={rulesSaving}
                className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 font-bold text-white rounded-lg shadow-lg cursor-pointer"
              >
                {rulesSaving ? 'Salvando...' : 'Criar Regra'}
              </button>
            </form>
          </div>
        </div>
      )}

      {activeTab === 'digest' && (
        <div className="space-y-6">
          {digestLoading ? (
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-10 flex flex-col items-center justify-center gap-3">
              <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
              <span className="text-xs text-slate-400 font-semibold">Carregando resumo da plataforma...</span>
            </div>
          ) : digestError || !digestData ? (
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-10 flex flex-col items-center justify-center text-center">
              <Calendar className="w-12 h-12 text-slate-600 mb-3 stroke-[1.2]" />
              <h3 className="text-sm font-bold text-slate-250">Sem resumo diário</h3>
              <p className="text-xs text-slate-400 max-w-sm mt-1">
                {digestError || 'Nenhum consolidado diário processado para a plataforma hoje.'}
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Stats */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl">
                  <span className="text-[10px] font-bold text-slate-400 block">Total de Alertas</span>
                  <span className="text-2xl font-bold text-white mt-1 block">{digestData.totalCount || 0}</span>
                </div>
                <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl">
                  <span className="text-[10px] font-bold text-slate-400 block">Não Lidas</span>
                  <span className="text-2xl font-bold text-indigo-400 mt-1 block">{digestData.unreadCount || 0}</span>
                </div>
                <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl">
                  <span className="text-[10px] font-bold text-rose-400 block">Alertas Críticos</span>
                  <span className="text-2xl font-bold text-rose-500 mt-1 block">{digestData.criticalCount || 0}</span>
                </div>
                <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl">
                  <span className="text-[10px] font-bold text-amber-400 block">Alertas de Atenção</span>
                  <span className="text-2xl font-bold text-amber-500 mt-1 block">{digestData.warningCount || 0}</span>
                </div>
              </div>

              {/* Items List */}
              <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-xl">
                <div className="px-4 py-3 bg-slate-950/60 border-b border-slate-800 font-bold text-xs text-slate-200 flex items-center gap-1.5">
                  <BookOpen className="w-4 h-4 text-rose-500" />
                  Logs consolidados da plataforma hoje
                </div>
                <div className="divide-y divide-slate-800/60">
                  {(!digestData.items || digestData.items.length === 0) ? (
                    <div className="p-8 text-center text-slate-500 italic text-xs">
                      Nenhum item individual no log do resumo.
                    </div>
                  ) : (
                    digestData.items.map((item: any) => (
                      <div key={item.id} className="flex gap-3.5 p-4 hover:bg-slate-850/10">
                        <div className={`w-9 h-9 rounded-lg border flex items-center justify-center shrink-0 ${getSeverityStyles(item.severity)}`}>
                          {getSeverityIcon(item.severity)}
                        </div>
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-slate-250">{item.title}</span>
                            <span className="text-[9px] text-slate-500 font-medium">
                              {formatDate(item.createdAt)}
                            </span>
                          </div>
                          <p className="text-xs text-slate-400 leading-relaxed">{item.message}</p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
