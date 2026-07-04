'use client';

import React, { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import {
  Building2,
  Search,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  ShieldAlert,
  Calendar,
  AlertTriangle,
  CheckCircle,
  Clock,
  Edit2,
  FileText,
  DollarSign,
  TrendingUp,
  XCircle,
  X,
  FileSpreadsheet
} from 'lucide-react';

export default function ManualBillingPage() {
  // List state
  const [items, setItems] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(10);

  // KPIs
  const [kpis, setKpis] = useState({
    activeSubscriptions: 0,
    paymentPendingSubscriptions: 0,
    overdueSubscriptions: 0,
    canceledSubscriptions: 0,
    monthlyContractedRevenueCents: 0,
  });

  // Filters
  const [search, setSearch] = useState('');
  const [billingStatus, setBillingStatus] = useState('');
  const [effectiveBillingStatus, setEffectiveBillingStatus] = useState('');
  const [plan, setPlan] = useState('');
  const [overdue, setOverdue] = useState(false);

  // Loading & error states
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [requestId, setRequestId] = useState<string | null>(null);

  // Drawer / Detail states
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(null);
  const [detailData, setDetailData] = useState<any>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // Form states
  const [formBillingStatus, setFormBillingStatus] = useState('');
  const [formContractedAmount, setFormContractedAmount] = useState('0');
  const [formBillingCycle, setFormBillingCycle] = useState('MONTHLY');
  const [formContractSentAt, setFormContractSentAt] = useState('');
  const [formContractSignedAt, setFormContractSignedAt] = useState('');
  const [formSubscriptionStartedAt, setFormSubscriptionStartedAt] = useState('');
  const [formNextBillingAt, setFormNextBillingAt] = useState('');
  const [formCanceledAt, setFormCanceledAt] = useState('');
  const [formCancellationReason, setFormCancellationReason] = useState('');
  const [formFinanceNotes, setFormFinanceNotes] = useState('');
  const [updating, setUpdating] = useState(false);

  const fetchAccounts = async () => {
    setLoading(true);
    setError(null);
    setRequestId(null);
    try {
      const params = new URLSearchParams();
      if (search) params.append('search', search);
      if (billingStatus) params.append('billingStatus', billingStatus);
      if (effectiveBillingStatus) params.append('effectiveBillingStatus', effectiveBillingStatus);
      if (plan) params.append('plan', plan);
      if (overdue) params.append('overdue', 'true');
      params.append('page', page.toString());
      params.append('pageSize', pageSize.toString());

      const res = await api.get(`/admin/billing/accounts?${params.toString()}`) as any;
      if (res && res.success) {
        setItems(res.items || []);
        setTotal(res.total || 0);
        if (res.kpis) {
          setKpis(res.kpis);
        }
      } else {
        setError(res?.error?.message || 'Erro ao carregar contas de faturamento.');
        setRequestId(res?.error?.requestId || null);
      }
    } catch (e) {
      setError('Erro de rede ao carregar o painel financeiro.');
    } finally {
      setLoading(false);
    }
  };

  const fetchAccountDetails = async (companyId: string) => {
    setDetailLoading(true);
    try {
      const res = await api.get(`/admin/billing/accounts/${companyId}`) as any;
      if (res && res.success) {
        const data = res.data;
        setDetailData(data);

        // Populate update form fields
        setFormBillingStatus(data.billingStatus);
        setFormContractedAmount((data.contractedAmountCents / 100).toString());
        setFormBillingCycle(data.billingCycle);
        setFormContractSentAt(data.contractSentAt ? data.contractSentAt.split('T')[0] : '');
        setFormContractSignedAt(data.contractSignedAt ? data.contractSignedAt.split('T')[0] : '');
        setFormSubscriptionStartedAt(data.subscriptionStartedAt ? data.subscriptionStartedAt.split('T')[0] : '');
        setFormNextBillingAt(data.nextBillingAt ? data.nextBillingAt.split('T')[0] : '');
        setFormCanceledAt(data.canceledAt ? data.canceledAt.split('T')[0] : '');
        setFormCancellationReason(data.cancellationReason || '');
        setFormFinanceNotes(data.financeNotes || '');
      } else {
        alert(res?.error?.message || 'Erro ao carregar detalhes do faturamento.');
      }
    } catch (e) {
      alert('Erro ao buscar faturamento da empresa.');
    } finally {
      setDetailLoading(false);
    }
  };

  useEffect(() => {
    fetchAccounts();
  }, [page, billingStatus, effectiveBillingStatus, overdue]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchAccounts();
  };

  const handleUpdateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCompanyId) return;

    // Validate contractedAmountCents
    const amountVal = parseFloat(formContractedAmount);
    if (isNaN(amountVal) || amountVal < 0) {
      alert('O valor contratado não pode ser negativo.');
      return;
    }
    if (amountVal * 100 > 100000000) {
      alert('O valor contratado não pode exceder R$ 1.000.000,00.');
      return;
    }

    // Validate dates order
    if (formContractSentAt && formContractSignedAt && new Date(formContractSignedAt) < new Date(formContractSentAt)) {
      alert('A data de assinatura do contrato não pode ser anterior à data de envio.');
      return;
    }
    if (formContractSignedAt && formSubscriptionStartedAt && new Date(formSubscriptionStartedAt) < new Date(formContractSignedAt)) {
      alert('A data de início da assinatura não pode ser anterior à data de assinatura do contrato.');
      return;
    }

    const finalCanceledAt = formBillingStatus === 'CANCELED' 
      ? (formCanceledAt || new Date().toISOString().split('T')[0]) 
      : '';
    if (formSubscriptionStartedAt && finalCanceledAt && new Date(finalCanceledAt) < new Date(formSubscriptionStartedAt)) {
      alert('A data de cancelamento não pode ser anterior à data de início da assinatura.');
      return;
    }

    // Validate CANCELED status has reason
    if (formBillingStatus === 'CANCELED' && !formCancellationReason.trim()) {
      alert('A justificativa de cancelamento é obrigatória.');
      return;
    }

    setUpdating(true);
    try {
      const cents = Math.round(amountVal * 100);
      const payload: any = {
        billingStatus: formBillingStatus,
        contractedAmountCents: cents,
        billingCycle: formBillingCycle,
        contractSentAt: formContractSentAt || null,
        contractSignedAt: formContractSignedAt || null,
        subscriptionStartedAt: formSubscriptionStartedAt || null,
        nextBillingAt: formNextBillingAt || null,
        canceledAt: formCanceledAt || null,
        cancellationReason: formCancellationReason || null,
        financeNotes: formFinanceNotes || null,
      };

      const res = await api.patch(`/admin/billing/accounts/${selectedCompanyId}`, payload) as any;
      if (res && res.success) {
        alert('Dados financeiros atualizados com sucesso!');
        fetchAccountDetails(selectedCompanyId);
        fetchAccounts();
      } else {
        alert(res?.error?.message || 'Erro ao atualizar faturamento.');
      }
    } catch (e) {
      alert('Erro de rede ao salvar faturamento.');
    } finally {
      setUpdating(false);
    }
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
        return 'bg-emerald-500/10 text-emerald-400';
      case 'WARNING':
        return 'bg-amber-500/10 text-amber-400';
      case 'CRITICAL':
        return 'bg-rose-500/10 text-rose-400';
      default:
        return 'bg-slate-500/10 text-slate-400';
    }
  };

  const totalPages = Math.ceil(total / pageSize);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight">Faturamento e Contratos</h1>
          <p className="text-slate-400 text-sm mt-1">
            Controle manual de assinaturas, status financeiro, ciclos de faturamento e datas de contratos.
          </p>
        </div>
        <button
          onClick={fetchAccounts}
          className="flex items-center gap-2 px-4 py-2 bg-slate-900 border border-slate-800 text-slate-200 hover:text-white hover:bg-slate-800 rounded-lg text-sm font-medium transition-all"
        >
          <RefreshCw className="w-4 h-4" />
          <span>Sincronizar</span>
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* MRR */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 flex flex-col justify-between shadow-lg">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Receita Mensal (MRR)</span>
            <DollarSign className="w-5 h-5 text-indigo-400" />
          </div>
          <div>
            <h3 className="text-2xl font-bold text-white">{formatCurrency(kpis.monthlyContractedRevenueCents)}</h3>
            <p className="text-[10px] text-slate-500 mt-1">Manual contratado ativo/pendente</p>
          </div>
        </div>

        {/* Active */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 flex flex-col justify-between shadow-lg">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Assinaturas Ativas</span>
            <TrendingUp className="w-5 h-5 text-emerald-400" />
          </div>
          <div>
            <h3 className="text-2xl font-bold text-white">{kpis.activeSubscriptions}</h3>
            <p className="text-[10px] text-slate-500 mt-1">Clientes com faturamento ativo</p>
          </div>
        </div>

        {/* Payment Pending */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 flex flex-col justify-between shadow-lg">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Pagamento Pendente</span>
            <Clock className="w-5 h-5 text-amber-400" />
          </div>
          <div>
            <h3 className="text-2xl font-bold text-white">{kpis.paymentPendingSubscriptions}</h3>
            <p className="text-[10px] text-slate-500 mt-1">Cobranças administrativas enviadas</p>
          </div>
        </div>

        {/* Overdue */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 flex flex-col justify-between shadow-lg">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Vencidas (Status Efetivo)</span>
            <AlertTriangle className="w-5 h-5 text-rose-400" />
          </div>
          <div>
            <h3 className="text-2xl font-bold text-white">{kpis.overdueSubscriptions}</h3>
            <p className="text-[10px] text-rose-400 mt-1 font-medium">Atrasos calculados/persistidos</p>
          </div>
        </div>

        {/* Canceled */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 flex flex-col justify-between shadow-lg">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Canceladas</span>
            <XCircle className="w-5 h-5 text-slate-400" />
          </div>
          <div>
            <h3 className="text-2xl font-bold text-white">{kpis.canceledSubscriptions}</h3>
            <p className="text-[10px] text-slate-500 mt-1">Clientes inativos financeiramente</p>
          </div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-md">
        <form onSubmit={handleSearchSubmit} className="flex flex-col lg:flex-row gap-4 items-end">
          <div className="flex-1 w-full space-y-2">
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
                className="w-full pl-9 pr-4 py-2 bg-slate-950 border border-slate-850 focus:border-indigo-600 rounded-lg text-sm text-slate-200 placeholder-slate-600 focus:outline-none transition-colors"
              />
            </div>
          </div>

          {/* Billing Status Filter */}
          <div className="w-full lg:w-44 space-y-2">
            <label className="text-xs font-semibold text-slate-300">Status Financeiro</label>
            <select
              value={billingStatus}
              onChange={(e) => setBillingStatus(e.target.value)}
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

          {/* Effective Billing Status Filter */}
          <div className="w-full lg:w-44 space-y-2">
            <label className="text-xs font-semibold text-slate-300">Status Efetivo</label>
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

          {/* Plan filter */}
          <div className="w-full lg:w-32 space-y-2">
            <label className="text-xs font-semibold text-slate-300">Plano</label>
            <input
              type="text"
              placeholder="Ex: STARTER"
              value={plan}
              onChange={(e) => setPlan(e.target.value)}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-850 focus:border-indigo-600 rounded-lg text-sm text-slate-200 focus:outline-none transition-colors"
            />
          </div>

          {/* Overdue Checkbox */}
          <div className="flex items-center gap-2 h-10 pb-2">
            <input
              type="checkbox"
              id="overdue-filter"
              checked={overdue}
              onChange={(e) => setOverdue(e.target.checked)}
              className="w-4 h-4 rounded border-slate-800 bg-slate-950 text-indigo-600 focus:ring-0 cursor-pointer"
            />
            <label htmlFor="overdue-filter" className="text-sm text-slate-300 cursor-pointer select-none">
              Apenas Vencidos
            </label>
          </div>

          {/* Buttons */}
          <div className="flex gap-2 w-full lg:w-auto">
            <button
              type="submit"
              className="flex-1 lg:flex-initial px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold rounded-lg transition-colors"
            >
              Filtrar
            </button>
            <button
              type="button"
              onClick={() => {
                setSearch('');
                setBillingStatus('');
                setEffectiveBillingStatus('');
                setPlan('');
                setOverdue(false);
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
            {requestId && (
              <p className="text-[10px] text-slate-500 mt-2">ID do pedido de suporte: <span className="font-mono">{requestId}</span></p>
            )}
          </div>
        </div>
      )}

      {/* Loading state */}
      {loading ? (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-20 flex flex-col items-center justify-center gap-3">
          <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
          <span className="text-sm text-slate-400 font-medium">Buscando contas de faturamento...</span>
        </div>
      ) : items.length === 0 ? (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-16 flex flex-col items-center text-center">
          <div className="w-12 h-12 rounded-full bg-slate-950 flex items-center justify-center mb-4">
            <Building2 className="w-6 h-6 text-slate-500" />
          </div>
          <h3 className="text-lg font-semibold text-white">Nenhum registro encontrado</h3>
          <p className="text-sm text-slate-400 mt-1 max-w-sm">
            Nenhuma conta de faturamento condiz com os filtros aplicados. Tente ajustar os parâmetros.
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
                  <th className="py-4 px-4">Status Cobrança</th>
                  <th className="py-4 px-4">Status Efetivo</th>
                  <th className="py-4 px-4">Valor Contratado</th>
                  <th className="py-4 px-4">Ciclo</th>
                  <th className="py-4 px-4">MRR Equivalente</th>
                  <th className="py-4 px-4">Próxima Cobrança</th>
                  <th className="py-4 px-4 text-center">Contrato</th>
                  <th className="py-4 px-4 text-center">Health</th>
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
                      <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-semibold ${getStatusBadgeClass(item.billingStatus)}`}>
                        {getStatusLabel(item.billingStatus)}
                      </span>
                    </td>
                    <td className="py-4 px-4">
                      <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-semibold ${getStatusBadgeClass(item.effectiveBillingStatus)}`}>
                        {getStatusLabel(item.effectiveBillingStatus)}
                      </span>
                    </td>
                    <td className="py-4 px-4 font-semibold text-slate-200">
                      {formatCurrency(item.contractedAmountCents)}
                    </td>
                    <td className="py-4 px-4 text-slate-400">
                      {item.billingCycle === 'MONTHLY' ? 'Mensal' : item.billingCycle === 'QUARTERLY' ? 'Trimestral' : 'Anual'}
                    </td>
                    <td className="py-4 px-4 font-semibold text-indigo-400">
                      {formatCurrency(item.monthlyEquivalentCents)}
                    </td>
                    <td className="py-4 px-4 text-slate-400">
                      {formatDate(item.nextBillingAt)}
                    </td>
                    <td className="py-4 px-4 text-center">
                      {item.contractSigned ? (
                        <span className="inline-flex items-center gap-1 text-emerald-400 text-xs bg-emerald-500/5 px-2 py-0.5 border border-emerald-500/10 rounded">
                          <CheckCircle className="w-3 h-3" />
                          <span>Assinado</span>
                        </span>
                      ) : (
                        <span className="text-slate-500 text-xs">-</span>
                      )}
                    </td>
                    <td className="py-4 px-4 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <span className={`w-2.5 h-2.5 rounded-full ${getHealthBadgeClass(item.healthStatus)}`} />
                        <span className="font-bold text-slate-200">{item.healthScore}</span>
                      </div>
                    </td>
                    <td className="py-4 px-6 text-right">
                      <button
                        onClick={() => {
                          setSelectedCompanyId(item.companyId);
                          fetchAccountDetails(item.companyId);
                        }}
                        className="p-2 bg-slate-950 border border-slate-850 hover:bg-slate-800 hover:text-white rounded-lg text-slate-400 transition-all"
                        title="Editar faturamento"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
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

      {/* Drawer Detalhe / Form */}
      {selectedCompanyId && (
        <div className="fixed inset-0 bg-black/60 z-50 flex justify-end backdrop-blur-sm transition-all duration-300 overflow-y-auto">
          <div className="w-full max-w-2xl bg-slate-900 min-h-full border-l border-slate-800 flex flex-col text-slate-100 shadow-2xl relative">
            {/* Drawer Header */}
            <div className="h-16 border-b border-slate-800 px-6 flex items-center justify-between bg-slate-950 shrink-0">
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="w-5 h-5 text-indigo-400" />
                <span className="font-bold text-white text-md">Gestão Financeira & Contrato</span>
              </div>
              <button
                onClick={() => setSelectedCompanyId(null)}
                className="p-1.5 hover:bg-slate-800 text-slate-400 hover:text-white rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Drawer Body */}
            <div className="flex-1 p-6 space-y-6">
              {detailLoading ? (
                <div className="flex flex-col items-center justify-center py-20 gap-3">
                  <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
                  <span className="text-xs text-slate-400">Buscando faturamento detalhado...</span>
                </div>
              ) : detailData ? (
                <>
                  {/* Company Summary Info */}
                  <div className="bg-slate-950 border border-slate-850 rounded-xl p-5 space-y-3">
                    <h3 className="text-lg font-bold text-white">{detailData.companyName}</h3>
                    <div className="grid grid-cols-2 gap-y-2 gap-x-4 text-xs">
                      <p className="text-slate-500">Razão Social: <span className="text-slate-300 font-medium">{detailData.legalName || '-'}</span></p>
                      <p className="text-slate-500">CNPJ: <span className="text-slate-300 font-medium">{detailData.cnpj || '-'}</span></p>
                      <p className="text-slate-500">Plano Técnico: <span className="text-slate-300 font-mono uppercase font-semibold">{detailData.plan}</span></p>
                      <p className="text-slate-500">Status Comercial: <span className="text-slate-300 font-medium capitalize">{detailData.pilotStatus}</span></p>
                      <p className="text-slate-500">Convertido em: <span className="text-slate-300 font-medium">{formatDate(detailData.convertedAt)}</span></p>
                      <p className="text-slate-500">Última Atividade: <span className="text-slate-300 font-medium">{formatDate(detailData.lastActivityAt)}</span></p>
                    </div>

                    {/* Health Score Overview */}
                    <div className="border-t border-slate-850 pt-3 mt-3 flex items-center justify-between text-xs">
                      <span className="text-slate-500">Score de Saúde / Adesão (7d):</span>
                      <div className="flex items-center gap-3">
                        <span className={`px-2 py-0.5 rounded font-semibold text-[10px] uppercase ${getHealthBadgeClass(detailData.healthStatus)}`}>
                          {detailData.healthStatus === 'GOOD' ? 'Saudável' : detailData.healthStatus === 'WARNING' ? 'Atenção' : 'Crítico'}
                        </span>
                        <span className="font-bold text-white text-sm">{detailData.healthScore}/100 ({detailData.responseRate7d}% resp.)</span>
                      </div>
                    </div>
                  </div>

                  {/* Manual Billing Update Form */}
                  <form onSubmit={handleUpdateSubmit} className="space-y-6">
                    <div className="space-y-4">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 border-b border-slate-800 pb-2">Configurações Financeiras</h4>
                      
                      <div className="grid grid-cols-2 gap-4">
                        {/* billingStatus */}
                        <div className="space-y-1.5">
                          <label className="text-xs font-semibold text-slate-300">Status Cobrança</label>
                          <select
                            value={formBillingStatus}
                            onChange={(e) => setFormBillingStatus(e.target.value)}
                            className="w-full px-3 py-2 bg-slate-950 border border-slate-850 focus:border-indigo-600 rounded-lg text-sm text-slate-200 focus:outline-none transition-colors"
                          >
                            <option value="TRIAL">Trial (Avaliação)</option>
                            <option value="ACTIVE">Ativo</option>
                            <option value="PAYMENT_PENDING">Aguardando Pagamento</option>
                            <option value="OVERDUE">Vencido</option>
                            <option value="CANCELED">Cancelado</option>
                          </select>
                        </div>

                        {/* billingCycle */}
                        <div className="space-y-1.5">
                          <label className="text-xs font-semibold text-slate-300">Ciclo de Faturamento</label>
                          <select
                            value={formBillingCycle}
                            onChange={(e) => setFormBillingCycle(e.target.value)}
                            className="w-full px-3 py-2 bg-slate-950 border border-slate-850 focus:border-indigo-600 rounded-lg text-sm text-slate-200 focus:outline-none transition-colors"
                          >
                            <option value="MONTHLY">Mensal</option>
                            <option value="QUARTERLY">Trimestral</option>
                            <option value="YEARLY">Anual</option>
                          </select>
                        </div>
                      </div>

                      {/* contractedAmount */}
                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-slate-300">Valor Contratado (R$)</label>
                        <div className="relative">
                          <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-500 text-sm">R$</span>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            max="1000000"
                            placeholder="0,00"
                            value={formContractedAmount}
                            onChange={(e) => setFormContractedAmount(e.target.value)}
                            className="w-full pl-9 pr-4 py-2 bg-slate-950 border border-slate-850 focus:border-indigo-600 rounded-lg text-sm text-slate-200 placeholder-slate-650 focus:outline-none transition-colors"
                            required
                          />
                        </div>
                        <p className="text-[10px] text-slate-500">Valor financeiro manual máximo R$ 1.000.000,00.</p>
                      </div>

                      <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 border-b border-slate-800 pb-2 pt-4">Datas & Contratos</h4>
                      
                      <div className="grid grid-cols-2 gap-4">
                        {/* contractSentAt */}
                        <div className="space-y-1.5">
                          <label className="text-xs font-semibold text-slate-300">Contrato Enviado em</label>
                          <input
                            type="date"
                            value={formContractSentAt}
                            onChange={(e) => setFormContractSentAt(e.target.value)}
                            className="w-full px-3 py-2 bg-slate-950 border border-slate-850 focus:border-indigo-600 rounded-lg text-sm text-slate-200 focus:outline-none transition-colors"
                          />
                        </div>

                        {/* contractSignedAt */}
                        <div className="space-y-1.5">
                          <label className="text-xs font-semibold text-slate-300">Contrato Assinado em</label>
                          <input
                            type="date"
                            value={formContractSignedAt}
                            onChange={(e) => setFormContractSignedAt(e.target.value)}
                            className="w-full px-3 py-2 bg-slate-950 border border-slate-850 focus:border-indigo-600 rounded-lg text-sm text-slate-200 focus:outline-none transition-colors"
                          />
                        </div>

                        {/* subscriptionStartedAt */}
                        <div className="space-y-1.5">
                          <label className="text-xs font-semibold text-slate-300">Início da Assinatura</label>
                          <input
                            type="date"
                            value={formSubscriptionStartedAt}
                            onChange={(e) => setFormSubscriptionStartedAt(e.target.value)}
                            className="w-full px-3 py-2 bg-slate-950 border border-slate-850 focus:border-indigo-600 rounded-lg text-sm text-slate-200 focus:outline-none transition-colors"
                          />
                        </div>

                        {/* nextBillingAt */}
                        <div className="space-y-1.5">
                          <label className="text-xs font-semibold text-slate-300">Próximo Vencimento</label>
                          <input
                            type="date"
                            value={formNextBillingAt}
                            onChange={(e) => setFormNextBillingAt(e.target.value)}
                            className="w-full px-3 py-2 bg-slate-950 border border-slate-850 focus:border-indigo-600 rounded-lg text-sm text-slate-200 focus:outline-none transition-colors"
                          />
                        </div>
                      </div>

                      {/* If CANCELED, show cancellation details */}
                      {formBillingStatus === 'CANCELED' && (
                        <div className="space-y-4 bg-rose-500/5 border border-rose-550/20 rounded-xl p-4 mt-2">
                          <div className="space-y-1.5">
                            <label className="text-xs font-semibold text-rose-400">Data de Cancelamento</label>
                            <input
                              type="date"
                              value={formCanceledAt}
                              onChange={(e) => setFormCanceledAt(e.target.value)}
                              className="w-full px-3 py-2 bg-slate-950 border border-rose-950 focus:border-rose-600 rounded-lg text-sm text-slate-200 focus:outline-none transition-colors"
                            />
                          </div>

                          <div className="space-y-1.5">
                            <label className="text-xs font-semibold text-rose-400">Justificativa de Cancelamento *</label>
                            <textarea
                              rows={3}
                              placeholder="Obrigatorio. Digite o motivo do cancelamento da assinatura..."
                              value={formCancellationReason}
                              onChange={(e) => setFormCancellationReason(e.target.value)}
                              className="w-full px-3 py-2 bg-slate-950 border border-rose-950 focus:border-rose-600 rounded-lg text-sm text-slate-200 placeholder-slate-700 focus:outline-none transition-colors resize-none"
                              required={formBillingStatus === 'CANCELED'}
                            />
                          </div>
                        </div>
                      )}

                      {/* financeNotes */}
                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-slate-300">Observações Financeiras (Internas)</label>
                        <textarea
                          rows={4}
                          placeholder="Digite anotações operacionais, histórico de faturamento offline..."
                          value={formFinanceNotes}
                          onChange={(e) => setFormFinanceNotes(e.target.value)}
                          className="w-full px-3 py-2 bg-slate-950 border border-slate-850 focus:border-indigo-600 rounded-lg text-sm text-slate-200 placeholder-slate-750 focus:outline-none transition-colors resize-none"
                        />
                      </div>
                    </div>

                    {/* Submit Button */}
                    <div className="pt-4 flex gap-3 shrink-0">
                      <button
                        type="submit"
                        disabled={updating}
                        className="flex-1 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-750 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-lg transition-colors flex items-center justify-center gap-2"
                      >
                        {updating && <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>}
                        <span>{updating ? 'Gravando Alterações...' : 'Salvar Alterações'}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setSelectedCompanyId(null)}
                        className="px-5 py-2.5 bg-slate-950 hover:bg-slate-850 border border-slate-850 text-slate-400 hover:text-slate-200 text-sm font-semibold rounded-lg transition-colors"
                      >
                        Cancelar
                      </button>
                    </div>
                  </form>
                </>
              ) : (
                <div className="text-center py-20 text-slate-450">Nenhum dado encontrado para carregar.</div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
