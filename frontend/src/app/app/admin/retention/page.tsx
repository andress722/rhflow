'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import {
  ShieldAlert,
  Search,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  DollarSign,
  TrendingDown,
  Building2,
  AlertTriangle,
  CheckCircle,
  Calendar,
  HelpCircle,
  FileText,
  UserCheck,
  Zap,
  Activity,
  Heart
} from 'lucide-react';

export default function RetentionDashboardPage() {
  // List state
  const [items, setItems] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(10);

  // KPIs
  const [kpis, setKpis] = useState({
    activeAccounts: 0,
    paymentPendingAccounts: 0,
    overdueAccounts: 0,
    renewalsNext7Days: 0,
    renewalsNext30Days: 0,
    criticalHealthAccounts: 0,
    attentionHealthAccounts: 0,
    churnRiskAccounts: 0,
    canceledThisMonth: 0,
    manualMrrCents: 0,
  });

  // Filters
  const [search, setSearch] = useState('');
  const [churnRiskLevel, setChurnRiskLevel] = useState('');
  const [effectiveBillingStatus, setEffectiveBillingStatus] = useState('');
  const [healthStatus, setHealthStatus] = useState('');
  const [renewalWindow, setRenewalWindow] = useState('');
  const [plan, setPlan] = useState('');

  // Loading & error states
  const [loading, setLoading] = useState(true);
  const [kpisLoading, setKpisLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchKpis = async () => {
    setKpisLoading(true);
    try {
      const res = await api.get('/admin/retention/overview') as any;
      if (res && res.success) {
        setKpis(res.data);
      }
    } catch (e) {
      console.error('Erro ao buscar KPIs de retenção:', e);
    } finally {
      setKpisLoading(false);
    }
  };

  const fetchAccounts = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (search) params.append('search', search);
      if (churnRiskLevel) params.append('churnRiskLevel', churnRiskLevel);
      if (effectiveBillingStatus) params.append('effectiveBillingStatus', effectiveBillingStatus);
      if (healthStatus) params.append('healthStatus', healthStatus);
      if (renewalWindow) params.append('renewalWindow', renewalWindow);
      if (plan) params.append('plan', plan);
      params.append('page', page.toString());
      params.append('pageSize', pageSize.toString());

      const res = await api.get(`/admin/retention/accounts?${params.toString()}`) as any;
      if (res && res.success) {
        setItems(res.items || []);
        setTotal(res.total || 0);
      } else {
        setError(res?.error?.message || 'Erro ao carregar lista de retenção.');
      }
    } catch (e) {
      setError('Erro de rede ao carregar as contas de retenção.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchKpis();
  }, []);

  useEffect(() => {
    fetchAccounts();
  }, [page, churnRiskLevel, effectiveBillingStatus, healthStatus, renewalWindow]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchAccounts();
  };

  const formatCurrency = (cents: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(cents / 100);
  };

  const formatDate = (isoString: string | null) => {
    if (!isoString) return '-';
    return new Date(isoString).toLocaleDateString('pt-BR');
  };

  const getRiskBadgeClass = (level: string) => {
    switch (level) {
      case 'HIGH':
        return 'bg-rose-500/10 text-rose-400 border border-rose-500/20';
      case 'MEDIUM':
        return 'bg-amber-500/10 text-amber-400 border border-amber-500/20';
      case 'LOW':
        return 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20';
      default:
        return 'bg-slate-500/10 text-slate-400 border border-slate-500/20';
    }
  };

  const getRiskLabel = (level: string) => {
    switch (level) {
      case 'HIGH':
        return 'Alto Risco';
      case 'MEDIUM':
        return 'Médio Risco';
      case 'LOW':
        return 'Baixo Risco';
      default:
        return level;
    }
  };

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case 'ACTIVE':
        return 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20';
      case 'TRIAL':
        return 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20';
      case 'PAYMENT_PENDING':
        return 'bg-amber-500/10 text-amber-400 border border-amber-500/20';
      case 'OVERDUE':
        return 'bg-rose-500/10 text-rose-400 border border-rose-500/20';
      case 'CANCELED':
        return 'bg-slate-500/10 text-slate-400 border border-slate-500/20';
      default:
        return 'bg-slate-500/10 text-slate-400 border border-slate-500/20';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'ACTIVE':
        return 'Ativo';
      case 'TRIAL':
        return 'Trial';
      case 'PAYMENT_PENDING':
        return 'Aguardando Pagamento';
      case 'OVERDUE':
        return 'Vencido';
      case 'CANCELED':
        return 'Cancelado';
      default:
        return status;
    }
  };

  const getHealthBadgeClass = (health: string) => {
    switch (health) {
      case 'GOOD':
        return 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20';
      case 'ATTENTION':
        return 'bg-amber-500/10 text-amber-400 border border-amber-500/20';
      case 'CRITICAL':
        return 'bg-rose-500/10 text-rose-400 border border-rose-500/20';
      default:
        return 'bg-slate-500/10 text-slate-400 border border-slate-500/20';
    }
  };

  const getHealthLabel = (health: string) => {
    switch (health) {
      case 'GOOD':
        return 'Saudável';
      case 'ATTENTION':
        return 'Atenção';
      case 'CRITICAL':
        return 'Crítico';
      default:
        return health;
    }
  };

  const getActionIcon = (action: string) => {
    switch (action) {
      case 'Cobrar pagamento pendente':
        return <DollarSign className="w-3.5 h-3.5 text-rose-400 shrink-0" />;
      case 'Agendar reunião de sucesso':
        return <UserCheck className="w-3.5 h-3.5 text-indigo-400 shrink-0" />;
      case 'Reativar uso com RH':
        return <Zap className="w-3.5 h-3.5 text-amber-400 shrink-0" />;
      case 'Preparar renovação':
        return <Calendar className="w-3.5 h-3.5 text-emerald-400 shrink-0" />;
      case 'Revisar ocorrências abertas':
        return <AlertTriangle className="w-3.5 h-3.5 text-rose-400 shrink-0" />;
      default:
        return <HelpCircle className="w-3.5 h-3.5 text-slate-400 shrink-0" />;
    }
  };

  const totalPages = Math.ceil(total / pageSize);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight flex items-center gap-3">
            <ShieldAlert className="w-8 h-8 text-rose-500" />
            <span>Retenção & Churn Prevention</span>
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            Análise preventiva de risco de cancelamento baseada em adimplência financeira e engajamento operacional.
          </p>
        </div>
        <button
          onClick={() => {
            fetchKpis();
            fetchAccounts();
          }}
          className="flex items-center gap-2 px-4 py-2 bg-slate-900 border border-slate-800 text-slate-200 hover:text-white hover:bg-slate-800 rounded-lg text-sm font-medium transition-all shrink-0 self-start md:self-auto"
        >
          <RefreshCw className="w-4 h-4" />
          <span>Recarregar Painel</span>
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4">
        {/* MRR */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 flex flex-col justify-between shadow-lg">
          <div className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-2">MRR Manual</div>
          <div>
            <h3 className="text-2xl font-bold text-indigo-400">{kpisLoading ? '...' : formatCurrency(kpis.manualMrrCents)}</h3>
            <p className="text-[10px] text-slate-500 mt-1">Receita contratada recorrente</p>
          </div>
        </div>

        {/* Churn Risk High */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 flex flex-col justify-between shadow-lg">
          <div className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-2">Alto Risco (Churn)</div>
          <div>
            <h3 className="text-2xl font-bold text-rose-500">{kpisLoading ? '...' : kpis.churnRiskAccounts}</h3>
            <p className="text-[10px] text-rose-400 mt-1 font-medium">Contas com atenção imediata</p>
          </div>
        </div>

        {/* Overdue */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 flex flex-col justify-between shadow-lg">
          <div className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-2">Contas Vencidas</div>
          <div>
            <h3 className="text-2xl font-bold text-amber-500">{kpisLoading ? '...' : kpis.overdueAccounts}</h3>
            <p className="text-[10px] text-slate-500 mt-1">Atrasos de faturamento offline</p>
          </div>
        </div>

        {/* Renewals 7d */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 flex flex-col justify-between shadow-lg">
          <div className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-2">Renovações 7 Dias</div>
          <div>
            <h3 className="text-2xl font-bold text-emerald-400">{kpisLoading ? '...' : kpis.renewalsNext7Days}</h3>
            <p className="text-[10px] text-slate-500 mt-1">Janela de renovação curta</p>
          </div>
        </div>

        {/* Critical Health */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 flex flex-col justify-between shadow-lg">
          <div className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-2">Saúde Crítica</div>
          <div>
            <h3 className="text-2xl font-bold text-rose-400">{kpisLoading ? '...' : kpis.criticalHealthAccounts}</h3>
            <p className="text-[10px] text-slate-500 mt-1">Uso técnico comprometido</p>
          </div>
        </div>

        {/* Canceled This Month */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 flex flex-col justify-between shadow-lg">
          <div className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-2">Canceladas Mês</div>
          <div>
            <h3 className="text-2xl font-bold text-slate-400">{kpisLoading ? '...' : kpis.canceledThisMonth}</h3>
            <p className="text-[10px] text-slate-500 mt-1">Assinaturas encerradas este mês</p>
          </div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-md">
        <form onSubmit={handleSearchSubmit} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4 items-end">
          {/* Search */}
          <div className="md:col-span-2 space-y-2">
            <label className="text-xs font-semibold text-slate-300">Buscar Empresa</label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-500">
                <Search className="w-4 h-4" />
              </span>
              <input
                type="text"
                placeholder="Buscar por nome ou razão social..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-slate-950 border border-slate-850 focus:border-indigo-600 rounded-lg text-sm text-slate-200 placeholder-slate-650 focus:outline-none transition-colors"
              />
            </div>
          </div>

          {/* Churn Risk Filter */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-300">Risco de Churn</label>
            <select
              value={churnRiskLevel}
              onChange={(e) => setChurnRiskLevel(e.target.value)}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-850 focus:border-indigo-600 rounded-lg text-sm text-slate-200 focus:outline-none transition-colors"
            >
              <option value="">Todos</option>
              <option value="HIGH">Alto Risco</option>
              <option value="MEDIUM">Médio Risco</option>
              <option value="LOW">Baixo Risco</option>
            </select>
          </div>

          {/* Effective Billing Filter */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-300">Status Financeiro</label>
            <select
              value={effectiveBillingStatus}
              onChange={(e) => setEffectiveBillingStatus(e.target.value)}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-850 focus:border-indigo-600 rounded-lg text-sm text-slate-200 focus:outline-none transition-colors"
            >
              <option value="">Todos</option>
              <option value="TRIAL">Trial</option>
              <option value="ACTIVE">Ativo</option>
              <option value="PAYMENT_PENDING">Aguardando Pagamento</option>
              <option value="OVERDUE">Vencido</option>
              <option value="CANCELED">Cancelado</option>
            </select>
          </div>

          {/* Health Status Filter */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-300">Status de Saúde</label>
            <select
              value={healthStatus}
              onChange={(e) => setHealthStatus(e.target.value)}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-850 focus:border-indigo-600 rounded-lg text-sm text-slate-200 focus:outline-none transition-colors"
            >
              <option value="">Todos</option>
              <option value="GOOD">Saudável</option>
              <option value="ATTENTION">Atenção</option>
              <option value="CRITICAL">Crítico</option>
            </select>
          </div>

          {/* Renewal Window Filter */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-300">Janela de Renovação</label>
            <select
              value={renewalWindow}
              onChange={(e) => setRenewalWindow(e.target.value)}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-850 focus:border-indigo-600 rounded-lg text-sm text-slate-200 focus:outline-none transition-colors"
            >
              <option value="">Todas</option>
              <option value="7d">Nos próximos 7 dias</option>
              <option value="30d">Nos próximos 30 dias</option>
            </select>
          </div>

          {/* Plan filter */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-300">Plano</label>
            <input
              type="text"
              placeholder="Ex: PREMIUM"
              value={plan}
              onChange={(e) => setPlan(e.target.value)}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-850 focus:border-indigo-600 rounded-lg text-sm text-slate-200 focus:outline-none transition-colors"
            />
          </div>

          {/* Actions */}
          <div className="lg:col-span-2 flex gap-2 w-full">
            <button
              type="submit"
              className="flex-1 px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold rounded-lg transition-colors"
            >
              Filtrar Contas
            </button>
            <button
              type="button"
              onClick={() => {
                setSearch('');
                setChurnRiskLevel('');
                setEffectiveBillingStatus('');
                setHealthStatus('');
                setRenewalWindow('');
                setPlan('');
                setPage(1);
                setTimeout(fetchAccounts, 50);
              }}
              className="px-4 py-2 bg-slate-950 hover:bg-slate-900 border border-slate-850 text-slate-400 hover:text-slate-200 text-sm font-semibold rounded-lg transition-colors"
            >
              Limpar
            </button>
          </div>
        </form>
      </div>

      {/* Error state */}
      {error && (
        <div className="bg-rose-500/10 border border-rose-500/20 rounded-xl p-5 flex items-start gap-4">
          <ShieldAlert className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
          <div className="flex-1">
            <h4 className="text-sm font-semibold text-rose-400">Falha ao buscar dados</h4>
            <p className="text-xs text-rose-300/80 mt-1">{error}</p>
          </div>
        </div>
      )}

      {/* Loading state */}
      {loading ? (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-20 flex flex-col items-center justify-center gap-3">
          <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
          <span className="text-sm text-slate-400 font-medium">Analisando risco de cancelamento...</span>
        </div>
      ) : items.length === 0 ? (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-16 flex flex-col items-center text-center">
          <div className="w-12 h-12 rounded-full bg-slate-950 flex items-center justify-center mb-4">
            <Building2 className="w-6 h-6 text-slate-500" />
          </div>
          <h3 className="text-lg font-semibold text-white">Nenhum registro encontrado</h3>
          <p className="text-sm text-slate-400 mt-1 max-w-sm">
            Nenhuma conta atende aos filtros de retenção aplicados.
          </p>
        </div>
      ) : (
        /* Data Table */
        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-lg">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="bg-slate-950 text-slate-400 font-semibold border-b border-slate-800">
                  <th className="py-4 px-6">Empresa</th>
                  <th className="py-4 px-4">Plano</th>
                  <th className="py-4 px-4">Saúde</th>
                  <th className="py-4 px-4">Status Cobrança</th>
                  <th className="py-4 px-4">Vencimento</th>
                  <th className="py-4 px-4">Probabilidade Churn</th>
                  <th className="py-4 px-4">Indicadores de Churn</th>
                  <th className="py-4 px-4">Ação Recomendada</th>
                  <th className="py-4 px-6 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-850 text-slate-300">
                {items.map((item) => (
                  <tr key={item.companyId} className="hover:bg-slate-800/20 transition-colors">
                    <td className="py-4 px-6 font-medium text-white">
                      <div>
                        <p>{item.companyName}</p>
                        <p className="text-[10px] text-slate-500 font-mono mt-0.5">{item.companyId}</p>
                      </div>
                    </td>
                    <td className="py-4 px-4">
                      <span className="px-2 py-0.5 rounded bg-slate-950 border border-slate-800 text-xs font-mono uppercase text-slate-400">
                        {item.plan}
                      </span>
                    </td>
                    <td className="py-4 px-4">
                      <div className="flex items-center gap-2">
                        <span className={`inline-flex px-2 py-0.5 rounded text-[10px] uppercase font-bold ${getHealthBadgeClass(item.healthStatus)}`}>
                          {getHealthLabel(item.healthStatus)}
                        </span>
                        <span className="font-bold text-slate-200">{item.healthScore}</span>
                      </div>
                    </td>
                    <td className="py-4 px-4">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${getStatusBadgeClass(item.effectiveBillingStatus)}`}>
                        {getStatusLabel(item.effectiveBillingStatus)}
                      </span>
                    </td>
                    <td className="py-4 px-4 text-slate-400">
                      {formatDate(item.nextBillingAt)}
                    </td>
                    <td className="py-4 px-4">
                      <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-bold ${getRiskBadgeClass(item.churnRiskLevel)}`}>
                        {getRiskLabel(item.churnRiskLevel)}
                      </span>
                    </td>
                    <td className="py-4 px-4 max-w-xs">
                      {item.churnRiskReasons && item.churnRiskReasons.length > 0 ? (
                        <div className="flex flex-col gap-1">
                          {item.churnRiskReasons.map((reason: string, idx: number) => (
                            <span key={idx} className="text-[10px] text-rose-350 bg-rose-500/5 px-2 py-0.5 rounded border border-rose-500/10 w-fit">
                              • {reason}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-slate-500 text-xs">-</span>
                      )}
                    </td>
                    <td className="py-4 px-4">
                      <div className="flex items-center gap-1.5 bg-slate-950/60 border border-slate-850 rounded px-2.5 py-1 text-xs text-slate-200 w-fit">
                        {getActionIcon(item.recommendedAction)}
                        <span className="font-medium">{item.recommendedAction}</span>
                      </div>
                    </td>
                    <td className="py-4 px-6 text-right">
                      <div className="flex justify-end gap-2">
                        <Link
                          href="/app/admin/billing"
                          className="px-2 py-1.5 bg-slate-950 border border-slate-850 hover:bg-slate-800 text-slate-350 hover:text-white rounded text-xs transition-all font-semibold flex items-center gap-1"
                          title="Gerenciar Faturamento"
                        >
                          <DollarSign className="w-3 h-3" />
                          <span>Billing</span>
                        </Link>
                        <Link
                          href="/app/admin/support/customer-success"
                          className="px-2 py-1.5 bg-slate-950 border border-slate-850 hover:bg-slate-800 text-slate-350 hover:text-white rounded text-xs transition-all font-semibold flex items-center gap-1"
                          title="Ver Diagnóstico CS"
                        >
                          <Activity className="w-3 h-3" />
                          <span>Engajamento</span>
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination controls */}
          {totalPages > 1 && (
            <div className="bg-slate-950 px-6 py-4 border-t border-slate-850 flex items-center justify-between text-sm">
              <span className="text-slate-500">
                Página <span className="text-slate-300 font-medium">{page}</span> de{' '}
                <span className="text-slate-300 font-medium">{totalPages}</span> (Total: {total})
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(p - 1, 1))}
                  disabled={page === 1}
                  className="p-2 border border-slate-800 rounded bg-slate-900 text-slate-400 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-slate-800 transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setPage((p) => Math.min(p + 1, totalPages))}
                  disabled={page === totalPages}
                  className="p-2 border border-slate-800 rounded bg-slate-900 text-slate-400 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-slate-800 transition-colors"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
