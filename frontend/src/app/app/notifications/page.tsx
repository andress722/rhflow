'use client';

import React, { useState, useEffect } from 'react';
import { Bell, Check, Trash2, CheckCircle2, AlertTriangle, AlertCircle, Info, Filter, ArrowRight, BookOpen, Calendar, HelpCircle, Zap, XCircle } from 'lucide-react';
import { api } from '@/lib/api';
import { getUser } from '@/lib/auth';
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

interface WorkflowItem {
  id: string;
  eventType: string;
  priority: 'LOW' | 'NORMAL' | 'HIGH' | 'CRITICAL';
  status: 'PENDING' | 'ACTIVE' | 'ACKNOWLEDGED' | 'RESOLVED' | 'CANCELLED' | 'EXHAUSTED' | 'FAILED';
  currentStep: number;
  acknowledgedAt: string | null;
  resolvedAt: string | null;
  resolutionReason: string | null;
  createdAt: string;
  payload?: { title?: string; message?: string; actionUrl?: string | null } | null;
}

export default function NotificationsPage() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<any>(null);
  
  // Tabs: 'all' (standard alerts), 'workflows' (escalation engine), or 'digest' (daily consolidated digest)
  const [activeTab, setActiveTab] = useState<'all' | 'workflows' | 'digest'>('all');

  // Workflow (Notification Engine) states
  const [workflows, setWorkflows] = useState<WorkflowItem[]>([]);
  const [workflowsLoading, setWorkflowsLoading] = useState(false);
  const [workflowsError, setWorkflowsError] = useState('');
  const [workflowStatusFilter, setWorkflowStatusFilter] = useState<string>('ACTIVE');
  const [workflowActionError, setWorkflowActionError] = useState('');

  // List notifications states
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(15);

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>('UNREAD');
  const [severityFilter, setSeverityFilter] = useState<string>('');

  // Digest states
  const [digestData, setDigestData] = useState<any>(null);
  const [digestLoading, setDigestLoading] = useState(false);
  const [digestError, setDigestError] = useState('');

  useEffect(() => {
    const loggedUser = getUser();
    setCurrentUser(loggedUser);
  }, []);

  useEffect(() => {
    if (activeTab === 'all') {
      fetchNotifications();
    } else if (activeTab === 'workflows') {
      fetchWorkflows();
    } else {
      fetchDigest();
    }
  }, [page, statusFilter, severityFilter, activeTab, workflowStatusFilter]);

  const fetchWorkflows = async () => {
    setWorkflowsLoading(true);
    setWorkflowsError('');
    try {
      let url = '/notifications/workflows?pageSize=50';
      if (workflowStatusFilter) url += `&status=${workflowStatusFilter}`;
      const res: any = await api.get(url);
      if (res.success && res.data) {
        setWorkflows(res.data.items);
      } else {
        setWorkflowsError(res.error?.message || 'Erro ao carregar workflows de escalonamento.');
      }
    } catch (err) {
      setWorkflowsError('Erro de conexão ao servidor.');
    } finally {
      setWorkflowsLoading(false);
    }
  };

  const handleWorkflowAction = async (id: string, action: 'acknowledge' | 'resolve' | 'cancel') => {
    setWorkflowActionError('');
    try {
      let payload: any = {};
      if (action === 'resolve') {
        const reasonCode = prompt('Motivo (EMPLOYEE_CONTACTED, ISSUE_RESOLVED, FALSE_ALARM, MANUAL_OVERRIDE, DUPLICATE, OTHER):', 'ISSUE_RESOLVED');
        if (!reasonCode) return;
        payload = { reasonCode };
      }
      const res: any = await api.post(`/notifications/workflows/${id}/${action}`, payload);
      if (res.success) {
        fetchWorkflows();
      } else {
        setWorkflowActionError(res.error?.message || 'Erro ao processar ação.');
      }
    } catch (err) {
      setWorkflowActionError('Erro de conexão ao processar ação.');
    }
  };

  const fetchNotifications = async () => {
    setLoading(true);
    setError('');
    try {
      let url = `/notifications?page=${page}&pageSize=${pageSize}`;
      if (statusFilter) url += `&status=${statusFilter}`;
      if (severityFilter) url += `&severity=${severityFilter}`;

      const res: any = await api.get(url);
      if (res.success && Array.isArray(res.items)) {
        setNotifications(res.items);
        setTotal(res.total ?? 0);
      } else {
        setError(res.error?.message || 'Erro ao carregar notificações.');
      }
    } catch (err) {
      setError('Erro ao carregar dados do servidor.');
    } finally {
      setLoading(false);
    }
  };

  const fetchDigest = async () => {
    setDigestLoading(true);
    setDigestError('');
    try {
      const res: any = await api.get('/notifications/digest/today');
      if (res.success && res.data) {
        setDigestData(res.data);
      } else {
        setDigestError(res.error?.message || 'Nenhum consolidado gerado hoje.');
      }
    } catch (err) {
      setDigestError('Não foi possível carregar o resumo diário de hoje.');
    } finally {
      setDigestLoading(false);
    }
  };

  const handleAction = async (id: string, action: 'read' | 'dismiss' | 'resolve', actionUrl?: string | null) => {
    try {
      const endpoint = `/notifications/${id}/${action}`;
      const res = await api.patch(endpoint);
      if (res.success) {
        if (action === 'read' && actionUrl) {
          router.push(actionUrl);
          return;
        }
        if (activeTab === 'all') fetchNotifications();
      } else {
        alert(res.error?.message || 'Erro ao atualizar notificação.');
      }
    } catch (err) {
      console.error(err);
      alert('Erro de rede ao processar ação.');
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
  const showResolveButton = currentUser && ['ADMIN', 'HR', 'MANAGER'].includes(currentUser.role);
  const showDigestTab = currentUser && ['ADMIN', 'HR', 'MANAGER'].includes(currentUser.role);
  const showWorkflowsTab = currentUser && ['ADMIN', 'HR', 'MANAGER'].includes(currentUser.role);

  const workflowStatusStyles: Record<string, string> = {
    ACTIVE: 'bg-indigo-500/10 border-indigo-500/20 text-indigo-400',
    PENDING: 'bg-slate-500/10 border-slate-500/20 text-slate-400',
    ACKNOWLEDGED: 'bg-amber-500/10 border-amber-500/20 text-amber-400',
    RESOLVED: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400',
    CANCELLED: 'bg-slate-700/20 border-slate-700/30 text-slate-500',
    EXHAUSTED: 'bg-rose-500/10 border-rose-500/20 text-rose-400',
    FAILED: 'bg-rose-500/10 border-rose-500/20 text-rose-400',
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            <Bell className="w-6 h-6 text-indigo-500" />
            Central de Notificações
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Gerencie alertas, ocorrências críticas e tarefas operacionais importantes.
          </p>
        </div>

        {/* Tab Controls */}
        <div className="flex bg-slate-900 border border-slate-800 p-1 rounded-xl shrink-0 self-start md:self-center">
          <button
            onClick={() => setActiveTab('all')}
            className={`px-4 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
              activeTab === 'all'
                ? 'bg-slate-800 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Todas as Notificações
          </button>
          {showWorkflowsTab && (
            <button
              onClick={() => setActiveTab('workflows')}
              className={`px-4 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                activeTab === 'workflows'
                  ? 'bg-slate-800 text-white shadow-md'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Escalonamentos
            </button>
          )}
          {showDigestTab && (
            <button
              onClick={() => setActiveTab('digest')}
              className={`px-4 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                activeTab === 'digest'
                  ? 'bg-slate-800 text-white shadow-md'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Resumo do Dia (Digest)
            </button>
          )}
        </div>
      </div>

      {activeTab === 'all' ? (
        <>
          {/* Filters Toolbar */}
          <div className="flex flex-wrap items-center gap-4 bg-slate-900 border border-slate-800 p-4 rounded-xl">
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-400">
              <Filter className="w-3.5 h-3.5" />
              Filtrar por:
            </div>

            {/* Status Filter */}
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

            {/* Severity Filter */}
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
                <span className="text-xs text-slate-400 font-semibold">Buscando notificações...</span>
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
                <h3 className="text-md font-bold text-white">Tudo em ordem!</h3>
                <p className="text-xs text-slate-400 mt-1 max-w-sm">
                  Não encontramos nenhuma notificação correspondente aos filtros selecionados.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-slate-800/60">
                {notifications.map((notif) => (
                  <div
                    key={notif.id}
                    className={`flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 hover:bg-slate-850/20 transition-all ${
                      notif.status === 'UNREAD' ? 'bg-indigo-950/5' : ''
                    }`}
                  >
                    {/* Left Section */}
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
                              Nova
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
                          className="p-2 rounded-lg bg-slate-950 border border-slate-800 hover:bg-indigo-950/20 hover:border-indigo-800/40 text-slate-400 hover:text-indigo-400 text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer"
                          title="Marcar como lida"
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span className="hidden md:inline">Lida</span>
                        </button>
                      )}

                      {showResolveButton && notif.status !== 'RESOLVED' && (
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
                          className="p-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer shadow-md shadow-indigo-600/10"
                          title="Ir para tela"
                        >
                          <ArrowRight className="w-3.5 h-3.5" />
                          <span className="hidden md:inline">Trabalhar</span>
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
                <span className="font-semibold text-slate-200">{total}</span> notificações
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
      ) : activeTab === 'workflows' ? (
        /* Escalation Workflows Tab (Sprint 54 - Notification Engine) */
        <div className="space-y-6">
          <div className="flex flex-wrap items-center gap-4 bg-slate-900 border border-slate-800 p-4 rounded-xl">
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-400">
              <Filter className="w-3.5 h-3.5" />
              Filtrar por status:
            </div>
            <select
              value={workflowStatusFilter}
              onChange={(e) => setWorkflowStatusFilter(e.target.value)}
              className="bg-slate-950 border border-slate-800 text-xs text-slate-200 rounded-lg px-3 py-1.5 focus:outline-none focus:border-indigo-600 cursor-pointer"
            >
              <option value="ACTIVE">Ativos</option>
              <option value="ACKNOWLEDGED">Confirmados (ACK)</option>
              <option value="RESOLVED">Resolvidos</option>
              <option value="EXHAUSTED">Esgotados (sem resposta)</option>
              <option value="CANCELLED">Cancelados</option>
              <option value="">Todos</option>
            </select>
          </div>

          {workflowActionError && (
            <div className="bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs rounded-lg p-3">{workflowActionError}</div>
          )}

          <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-xl">
            {workflowsLoading ? (
              <div className="flex flex-col items-center justify-center py-20 gap-3">
                <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
                <span className="text-xs text-slate-400 font-semibold">Buscando escalonamentos...</span>
              </div>
            ) : workflowsError ? (
              <div className="flex flex-col items-center justify-center py-16 text-center px-4">
                <AlertCircle className="w-10 h-10 text-red-500 mb-3" />
                <p className="text-sm font-bold text-white">{workflowsError}</p>
              </div>
            ) : workflows.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-24 text-center px-4">
                <div className="w-16 h-16 rounded-full bg-slate-950 flex items-center justify-center mb-4">
                  <Zap className="w-8 h-8 text-slate-600 stroke-[1.5]" />
                </div>
                <h3 className="text-md font-bold text-white">Nenhum escalonamento encontrado</h3>
                <p className="text-xs text-slate-400 mt-1 max-w-sm">
                  Não há workflows de notificação com o status selecionado.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-slate-800/60">
                {workflows.map((wf) => (
                  <div key={wf.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 hover:bg-slate-850/20 transition-all">
                    <div className="flex items-start gap-3.5 max-w-3xl">
                      <div className={`w-10 h-10 rounded-xl border flex items-center justify-center shrink-0 ${workflowStatusStyles[wf.status] || workflowStatusStyles.PENDING}`}>
                        <Zap className="w-5 h-5" />
                      </div>
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-bold text-slate-100">{wf.payload?.title || wf.eventType}</span>
                          <span className="text-[10px] text-slate-500 font-medium">• {formatDate(wf.createdAt)}</span>
                          <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold border ${workflowStatusStyles[wf.status] || workflowStatusStyles.PENDING}`}>
                            {wf.status}
                          </span>
                          <span className="px-1.5 py-0.5 rounded bg-slate-800 text-[9px] font-bold text-slate-400">
                            Passo {wf.currentStep + 1}
                          </span>
                        </div>
                        <p className="text-xs leading-relaxed text-slate-300">{wf.payload?.message || `Evento: ${wf.eventType}`}</p>
                        {wf.resolutionReason && (
                          <p className="text-[10px] text-slate-500 italic">Motivo: {wf.resolutionReason}</p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 self-end sm:self-center">
                      {wf.status === 'ACTIVE' && (
                        <button
                          onClick={() => handleWorkflowAction(wf.id, 'acknowledge')}
                          className="p-2 rounded-lg bg-slate-950 border border-slate-800 hover:bg-amber-950/20 hover:border-amber-800/40 text-slate-400 hover:text-amber-400 text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer"
                          title="Confirmar ciência (ACK)"
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span className="hidden md:inline">Confirmar</span>
                        </button>
                      )}
                      {(wf.status === 'ACTIVE' || wf.status === 'ACKNOWLEDGED') && (
                        <button
                          onClick={() => handleWorkflowAction(wf.id, 'resolve')}
                          className="p-2 rounded-lg bg-slate-950 border border-slate-800 hover:bg-emerald-950/20 hover:border-emerald-800/40 text-slate-400 hover:text-emerald-400 text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer"
                          title="Resolver"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span className="hidden md:inline">Resolver</span>
                        </button>
                      )}
                      {(wf.status === 'ACTIVE' || wf.status === 'ACKNOWLEDGED') && (
                        <button
                          onClick={() => handleWorkflowAction(wf.id, 'cancel')}
                          className="p-2 rounded-lg bg-slate-950 border border-slate-800 hover:bg-rose-950/20 hover:border-rose-800/40 text-slate-400 hover:text-rose-400 text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer"
                          title="Cancelar"
                        >
                          <XCircle className="w-3.5 h-3.5" />
                          <span className="hidden md:inline">Cancelar</span>
                        </button>
                      )}
                      {wf.payload?.actionUrl && (
                        <button
                          onClick={() => router.push(wf.payload!.actionUrl!)}
                          className="p-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer shadow-md shadow-indigo-600/10"
                          title="Ir para tela"
                        >
                          <ArrowRight className="w-3.5 h-3.5" />
                          <span className="hidden md:inline">Trabalhar</span>
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : (
        /* Daily Digest Tab */
        <div className="space-y-6">
          {digestLoading ? (
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-10 flex flex-col items-center justify-center gap-3">
              <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
              <span className="text-xs text-slate-400 font-semibold">Carregando resumo do dia...</span>
            </div>
          ) : digestError || !digestData ? (
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-10 flex flex-col items-center justify-center text-center">
              <Calendar className="w-12 h-12 text-slate-600 mb-3 stroke-[1.2]" />
              <h3 className="text-sm font-bold text-slate-200">Sem resumo diário</h3>
              <p className="text-xs text-slate-400 max-w-sm mt-1">
                {digestError || 'O consolidado de alertas de hoje ainda não foi processado ou está vazio.'}
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Summary Stats Grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl">
                  <span className="text-[10px] font-bold text-slate-400 block">Total de Eventos</span>
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

              {/* By Type Breakdown */}
              {digestData.byType && Object.keys(digestData.byType).length > 0 && (
                <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl space-y-3">
                  <h3 className="text-xs font-bold text-slate-100 uppercase tracking-wider">Resumo por Categoria</h3>
                  <div className="flex flex-wrap gap-2.5">
                    {Object.entries(digestData.byType).map(([type, count]) => (
                      <div
                        key={type}
                        className="px-3 py-1.5 bg-slate-950 border border-slate-850 rounded-lg text-xs flex items-center gap-2"
                      >
                        <span className="font-semibold text-slate-200">{type}</span>
                        <span className="px-1.5 py-0.5 rounded bg-slate-800 text-[10px] font-bold text-slate-400">
                          {count as number}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Items List */}
              <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-xl">
                <div className="px-4 py-3 bg-slate-950/60 border-b border-slate-800 font-bold text-xs text-slate-200 flex items-center gap-1.5">
                  <BookOpen className="w-4 h-4 text-indigo-400" />
                  Notificações consolidadas hoje
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
                            <span className="text-xs font-bold text-slate-200">{item.title}</span>
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
