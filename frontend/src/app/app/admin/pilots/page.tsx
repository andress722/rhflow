'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
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
  HelpCircle,
  ArrowRight,
  Award,
  DollarSign,
  TrendingUp,
  XCircle,
  Clock,
  ClipboardList,
  Edit2,
  FileText,
  UserCheck,
  Check,
  Activity,
  Layers
} from 'lucide-react';

export default function PilotsManagementPage() {
  // Page state
  const [items, setItems] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(10);

  // KPIs
  const [kpis, setKpis] = useState({
    activePilots: 0,
    proposalsSent: 0,
    wonPilots: 0,
    lostPilots: 0,
    expiringIn7Days: 0,
  });

  // Filters
  const [search, setSearch] = useState('');
  const [pilotStatus, setPilotStatus] = useState('');
  const [plan, setPlan] = useState('');
  const [healthStatus, setHealthStatus] = useState('');

  // Loading & error states
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [requestId, setRequestId] = useState<string | null>(null);

  // Detail Modal/Drawer states
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(null);
  const [detailData, setDetailData] = useState<any>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [plans, setPlans] = useState<any[]>([]);

  // Update form states
  const [formStatus, setFormStatus] = useState('');
  const [formStartedAt, setFormStartedAt] = useState('');
  const [formEndsAt, setFormEndsAt] = useState('');
  const [formProposalSentAt, setFormProposalSentAt] = useState('');
  const [formConvertedAt, setFormConvertedAt] = useState('');
  const [formLostReason, setFormLostReason] = useState('');
  const [formNotes, setFormNotes] = useState('');
  const [formPlanId, setFormPlanId] = useState('');
  const [updating, setUpdating] = useState(false);

  // Proposal Summary states
  const [summaryMarkdown, setSummaryMarkdown] = useState<string | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);

  const fetchPlans = async () => {
    try {
      const res = await api.get('/admin/plans') as any;
      if (res && res.success) {
        setPlans(res.data || []);
      }
    } catch (e) {}
  };

  const fetchPilots = async () => {
    setLoading(true);
    setError(null);
    setRequestId(null);
    try {
      const params = new URLSearchParams();
      if (search) params.append('search', search);
      if (pilotStatus) params.append('pilotStatus', pilotStatus);
      if (plan) params.append('plan', plan);
      if (healthStatus) params.append('healthStatus', healthStatus);
      params.append('page', page.toString());
      params.append('pageSize', pageSize.toString());

      const res = await api.get(`/admin/pilots?${params.toString()}`) as any;
      if (res && res.success) {
        setItems(res.items || []);
        setTotal(res.total || 0);
        setKpis({
          activePilots: res.activePilots || 0,
          proposalsSent: res.proposalsSent || 0,
          wonPilots: res.wonPilots || 0,
          lostPilots: res.lostPilots || 0,
          expiringIn7Days: res.expiringIn7Days || 0,
        });
      } else {
        setError(res?.error?.message || 'Erro ao carregar pilotos.');
        setRequestId(res?.error?.requestId || null);
      }
    } catch (e) {
      setError('Erro de rede ao carregar painel comercial de pilotos.');
    } finally {
      setLoading(false);
    }
  };

  const fetchPilotDetails = async (companyId: string) => {
    setDetailLoading(true);
    setSummaryMarkdown(null);
    try {
      const res = await api.get(`/admin/pilots/${companyId}`) as any;
      if (res && res.success) {
        setDetailData(res.data);
        const data = res.data;
        // Populate update form fields
        setFormStatus(data.pilotStatus);
        setFormStartedAt(data.pilotStartedAt ? data.pilotStartedAt.split('T')[0] : '');
        setFormEndsAt(data.pilotEndsAt ? data.pilotEndsAt.split('T')[0] : '');
        setFormProposalSentAt(data.proposalSentAt ? data.proposalSentAt.split('T')[0] : '');
        setFormConvertedAt(data.convertedAt ? data.convertedAt.split('T')[0] : '');
        setFormLostReason(data.pilotLostReason || '');
        setFormNotes(data.commercialNotes || '');
        setFormPlanId(data.currentSubscription?.planId || '');
      } else {
        alert(res?.error?.message || 'Erro ao carregar detalhes do piloto.');
      }
    } catch (e) {
      alert('Erro ao buscar dados do piloto.');
    } finally {
      setDetailLoading(false);
    }
  };

  const handleUpdateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCompanyId || updating) return;

    if (formStatus === 'LOST' && !formLostReason.trim()) {
      alert('O motivo da perda é obrigatório para o status LOST.');
      return;
    }

    setUpdating(true);
    try {
      const payload = {
        pilotStatus: formStatus,
        pilotStartedAt: formStartedAt ? new Date(formStartedAt).toISOString() : null,
        pilotEndsAt: formEndsAt ? new Date(formEndsAt).toISOString() : null,
        proposalSentAt: formProposalSentAt ? new Date(formProposalSentAt).toISOString() : null,
        convertedAt: formConvertedAt ? new Date(formConvertedAt).toISOString() : null,
        pilotLostReason: formLostReason || null,
        commercialNotes: formNotes || null,
        planId: formPlanId || null,
      };

      const res = await api.patch(`/admin/pilots/${selectedCompanyId}`, payload) as any;
      if (res && res.success) {
        // Refresh detail view and list view
        await Promise.all([
          fetchPilotDetails(selectedCompanyId),
          fetchPilots()
        ]);
        alert('Cadastro de piloto comercial atualizado com sucesso.');
      } else {
        alert(res?.error?.message || 'Erro ao atualizar dados do piloto.');
      }
    } catch (err) {
      alert('Erro de rede ao salvar alterações.');
    } finally {
      setUpdating(false);
    }
  };

  const handleGenerateSummary = async () => {
    if (!selectedCompanyId || summaryLoading) return;
    setSummaryLoading(true);
    try {
      const res = await api.post(`/admin/pilots/${selectedCompanyId}/generate-proposal-summary`, {}) as any;
      if (res && res.success) {
        setSummaryMarkdown(res.summaryMarkdown);
      } else {
        alert(res?.error?.message || 'Erro ao gerar resumo da proposta.');
      }
    } catch (e) {
      alert('Erro de rede ao gerar resumo.');
    } finally {
      setSummaryLoading(false);
    }
  };

  useEffect(() => {
    fetchPilots();
    fetchPlans();
  }, [page, pilotStatus, plan, healthStatus]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchPilots();
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ACTIVE':
        return 'bg-emerald-500/10 text-emerald-450 border border-emerald-500/20';
      case 'PROPOSAL_SENT':
        return 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20';
      case 'WON':
        return 'bg-blue-500/10 text-blue-400 border border-blue-500/20';
      case 'LOST':
        return 'bg-red-500/10 text-red-400 border border-red-500/20';
      default:
        return 'bg-slate-800 text-slate-400 border border-slate-700';
    }
  };

  const getHealthColor = (health: string) => {
    switch (health) {
      case 'HEALTHY':
        return 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20';
      case 'ATTENTION':
        return 'bg-amber-500/10 text-amber-400 border border-amber-500/20';
      case 'CRITICAL':
        return 'bg-red-500/10 text-red-400 border border-red-500/20';
      default:
        return 'bg-slate-800 text-slate-450';
    }
  };

  return (
    <div className="space-y-8 pb-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            <Award className="w-6 h-6 text-indigo-500" />
            <span>Conversão e Gestão de Pilotos</span>
          </h1>
          <p className="text-sm text-slate-400">
            Acompanhamento do funil comercial de pilotos, propostas operacionais enviadas, conversão manual e taxas de retenção.
          </p>
        </div>
        <button
          onClick={() => fetchPilots()}
          className="flex items-center gap-2 px-3.5 py-1.5 text-xs font-semibold bg-slate-850 hover:bg-slate-800 text-slate-200 border border-slate-750 rounded-lg transition-colors cursor-pointer"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Atualizar Dados</span>
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl flex flex-col justify-between">
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Pilotos Ativos</span>
          <span className="text-2xl font-black text-white mt-1">{kpis.activePilots}</span>
        </div>
        <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl flex flex-col justify-between">
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Propostas Enviadas</span>
          <span className="text-2xl font-black text-indigo-400 mt-1">{kpis.proposalsSent}</span>
        </div>
        <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl flex flex-col justify-between">
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Ganhos / Won</span>
          <span className="text-2xl font-black text-blue-400 mt-1">{kpis.wonPilots}</span>
        </div>
        <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl flex flex-col justify-between">
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Perdidos / Lost</span>
          <span className="text-2xl font-black text-red-400 mt-1">{kpis.lostPilots}</span>
        </div>
        <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl flex flex-col justify-between col-span-2 md:col-span-1">
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Vencendo em 7 dias</span>
          <span className="text-2xl font-black text-amber-400 mt-1">{kpis.expiringIn7Days}</span>
        </div>
      </div>

      {/* Filters Form */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
        <form onSubmit={handleSearchSubmit} className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-4">
          {/* Search */}
          <div>
            <label className="block text-[10px] font-semibold text-slate-400 uppercase mb-1">Buscar Empresa</label>
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-slate-600" />
              <input
                type="text"
                placeholder="Nome ou CNPJ..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-950 border border-slate-800 rounded-lg text-slate-200 placeholder-slate-650 focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          {/* Status Filter */}
          <div>
            <label className="block text-[10px] font-semibold text-slate-400 uppercase mb-1">Status Comercial</label>
            <select
              value={pilotStatus}
              onChange={(e) => {
                setPilotStatus(e.target.value);
                setPage(1);
              }}
              className="w-full px-3 py-1.5 text-xs bg-slate-950 border border-slate-800 rounded-lg text-slate-200 focus:outline-none focus:border-indigo-500 cursor-pointer"
            >
              <option value="">Todos os status</option>
              <option value="NOT_STARTED">NOT_STARTED (Não iniciado)</option>
              <option value="ACTIVE">ACTIVE (Em andamento)</option>
              <option value="PROPOSAL_SENT">PROPOSAL_SENT (Proposta enviada)</option>
              <option value="WON">WON (Ganho / Convertido)</option>
              <option value="LOST">LOST (Perdido)</option>
            </select>
          </div>

          {/* Plan Filter */}
          <div>
            <label className="block text-[10px] font-semibold text-slate-400 uppercase mb-1">Plano</label>
            <input
              type="text"
              placeholder="Ex: STARTER, PRO..."
              value={plan}
              onChange={(e) => {
                setPlan(e.target.value);
                setPage(1);
              }}
              className="w-full px-3 py-1.5 text-xs bg-slate-950 border border-slate-800 rounded-lg text-slate-200 placeholder-slate-650 focus:outline-none focus:border-indigo-500"
            />
          </div>

          {/* Health Filter */}
          <div>
            <label className="block text-[10px] font-semibold text-slate-400 uppercase mb-1">Saúde do Piloto</label>
            <select
              value={healthStatus}
              onChange={(e) => {
                setHealthStatus(e.target.value);
                setPage(1);
              }}
              className="w-full px-3 py-1.5 text-xs bg-slate-950 border border-slate-800 rounded-lg text-slate-200 focus:outline-none focus:border-indigo-500 cursor-pointer"
            >
              <option value="">Todas as integridades</option>
              <option value="HEALTHY">HEALTHY (Saudável)</option>
              <option value="ATTENTION">ATTENTION (Atenção)</option>
              <option value="CRITICAL">CRITICAL (Crítico)</option>
            </select>
          </div>

          {/* Submit */}
          <div className="flex items-end">
            <button
              type="submit"
              className="w-full py-1.5 text-xs font-semibold bg-slate-800 hover:bg-slate-750 text-white rounded-lg border border-slate-700 transition-colors cursor-pointer"
            >
              Filtrar Funil
            </button>
          </div>
        </form>
      </div>

      {/* Pilots Table */}
      {error ? (
        <div className="p-4 bg-red-950/20 border border-red-800/50 rounded-xl flex items-center gap-3 text-red-400 text-sm">
          <ShieldAlert className="w-5 h-5 shrink-0" />
          <span>{error}</span>
          {requestId && <span className="text-[10px] text-slate-500 font-mono"> (ID: {requestId})</span>}
        </div>
      ) : loading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3 bg-slate-900 border border-slate-800 rounded-xl">
          <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
          <span className="text-sm text-slate-400 font-medium">Carregando funil comercial...</span>
        </div>
      ) : items.length === 0 ? (
        <div className="text-center py-16 bg-slate-900 border border-slate-800 rounded-xl">
          <Building2 className="w-8 h-8 text-slate-650 mx-auto mb-3" />
          <h4 className="text-sm font-bold text-slate-400">Nenhuma empresa piloto encontrada</h4>
          <p className="text-xs text-slate-600 mt-1">Nenhum resultado corresponde à busca comercial.</p>
        </div>
      ) : (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4 shadow-md">
          <div className="overflow-x-auto border border-slate-850 rounded-lg">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-950 text-slate-400 border-b border-slate-800 font-semibold">
                  <th className="p-3">Empresa</th>
                  <th className="p-3">Plano</th>
                  <th className="p-3 text-center">Status Comercial</th>
                  <th className="p-3 text-center">Health Score</th>
                  <th className="p-3 text-center">Saúde</th>
                  <th className="p-3 text-center">Adesão (7d)</th>
                  <th className="p-3 text-center font-bold">Colaboradores</th>
                  <th className="p-3 text-center">Fim do Piloto</th>
                  <th className="p-3 text-center">Última Atividade</th>
                  <th className="p-3 text-center">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-slate-300">
                {items.map((item) => (
                  <tr key={item.companyId} className="hover:bg-slate-950/40 transition-colors">
                    <td className="p-3">
                      <span className="font-semibold text-slate-200 block">{item.companyName}</span>
                      <span className="text-[10px] text-slate-600 block font-mono">{item.companyId}</span>
                    </td>
                    <td className="p-3">
                      <span className="font-bold text-slate-350 bg-slate-950/30 px-2 py-0.5 rounded border border-slate-800">
                        {item.plan}
                      </span>
                    </td>
                    <td className="p-3 text-center">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${getStatusColor(item.pilotStatus)}`}>
                        {item.pilotStatus}
                      </span>
                    </td>
                    <td className="p-3 text-center">
                      <span className="font-extrabold text-sm text-slate-200">{item.healthScore}</span>
                    </td>
                    <td className="p-3 text-center">
                      <span className={`px-2.5 py-0.5 rounded text-[10px] font-bold ${getHealthColor(item.healthStatus)}`}>
                        {item.healthStatus}
                      </span>
                    </td>
                    <td className="p-3 text-center font-semibold text-slate-200">{item.responseRate7d}%</td>
                    <td className="p-3 text-center text-slate-400 font-semibold">{item.activeEmployees}</td>
                    <td className="p-3 text-center text-slate-450">
                      {item.pilotEndsAt
                        ? new Date(item.pilotEndsAt).toLocaleDateString('pt-BR')
                        : 'Sem prazo'}
                    </td>
                    <td className="p-3 text-center text-slate-450">
                      {item.lastActivityAt
                        ? new Date(item.lastActivityAt).toLocaleDateString('pt-BR')
                        : 'Sem registro'}
                    </td>
                    <td className="p-3 text-center flex items-center justify-center gap-2">
                      <Link
                        href={`/app/admin/pilot-feedback?companyId=${item.companyId}`}
                        className="inline-flex items-center gap-1 bg-slate-905 hover:bg-slate-800 text-slate-350 border border-slate-800 px-2.5 py-1 rounded text-[11px] font-semibold cursor-pointer transition-colors"
                      >
                        Feedbacks
                      </Link>
                      <Link
                        href={`/app/admin/pilot-backlog?companyId=${item.companyId}`}
                        className="inline-flex items-center gap-1 bg-slate-905 hover:bg-slate-800 text-slate-350 border border-slate-800 px-2.5 py-1 rounded text-[11px] font-semibold cursor-pointer transition-colors"
                      >
                        Backlog
                      </Link>
                      <Link
                        href={`/app/admin/executive-reports?companyId=${item.companyId}`}
                        className="inline-flex items-center gap-1 bg-slate-800 hover:bg-slate-750 text-indigo-400 border border-slate-750 px-2.5 py-1 rounded text-[11px] font-semibold cursor-pointer transition-colors"
                      >
                        Relatório
                      </Link>
                      <button
                        onClick={() => {
                          setSelectedCompanyId(item.companyId);
                          fetchPilotDetails(item.companyId);
                        }}
                        className="inline-flex items-center gap-1 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 px-2.5 py-1 rounded text-[11px] font-semibold cursor-pointer transition-colors"
                      >
                        <Edit2 className="w-3 h-3" />
                        <span>Gerenciar</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between border-t border-slate-800 pt-4">
            <span className="text-xs text-slate-500">
              Mostrando {items.length} de {total} pilotos comerciais (Página {page})
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => setPage(prev => Math.max(1, prev - 1))}
                disabled={page === 1 || loading}
                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-750 text-slate-300 disabled:opacity-40 transition-colors cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={() => setPage(prev => prev + 1)}
                disabled={items.length < pageSize || loading}
                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-750 text-slate-300 disabled:opacity-40 transition-colors cursor-pointer"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Detail Drawer Modal */}
      {selectedCompanyId && detailData && (
        <div className="fixed inset-0 z-50 flex items-center justify-end bg-slate-950/80 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-2xl bg-slate-900 border-l border-slate-800 h-full shadow-2xl flex flex-col justify-between overflow-hidden">
            {/* Header */}
            <div className="p-4 border-b border-slate-850 flex items-center justify-between bg-slate-950/40">
              <div>
                <h3 className="font-bold text-white text-md flex items-center gap-1.5">
                  <Building2 className="w-4 h-4 text-indigo-400" />
                  <span>{detailData.companyName}</span>
                </h3>
                <p className="text-[10px] text-slate-500 font-mono mt-0.5">Empresa ID: {detailData.companyId}</p>
              </div>
              <button
                onClick={() => {
                  setSelectedCompanyId(null);
                  setDetailData(null);
                  setSummaryMarkdown(null);
                }}
                className="px-3 py-1.5 text-xs font-semibold bg-slate-800 hover:bg-slate-750 border border-slate-700 rounded text-slate-300 cursor-pointer"
              >
                Fechar
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 p-6 overflow-y-auto space-y-6">
              {detailLoading ? (
                <div className="py-20 flex flex-col items-center justify-center gap-3">
                  <RefreshCw className="w-8 h-8 text-indigo-500 animate-spin" />
                  <span className="text-slate-450 text-xs">Atualizando dados do piloto...</span>
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Health and Readiness Overview */}
                  <div className="grid grid-cols-3 gap-4 bg-slate-950/50 p-4 rounded-xl border border-slate-850">
                    <div className="text-center">
                      <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider block">Health Score</span>
                      <span className="text-lg font-black text-white">{detailData.healthScore}</span>
                    </div>
                    <div className="text-center">
                      <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider block">Saúde</span>
                      <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold mt-1 ${getHealthColor(detailData.healthStatus)}`}>
                        {detailData.healthStatus}
                      </span>
                    </div>
                    <div className="text-center">
                      <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider block">Assinatura Atual</span>
                      <span className="text-xs font-bold text-slate-350 block mt-1">{detailData.currentSubscription?.planName}</span>
                    </div>
                  </div>

                  {/* Form fields */}
                  <form onSubmit={handleUpdateSubmit} className="space-y-4 border-t border-slate-850 pt-4">
                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                      <ClipboardList className="w-3.5 h-3.5 text-indigo-400" />
                      <span>Parâmetros Comerciais</span>
                    </h4>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {/* Pilot Status dropdown */}
                      <div>
                        <label className="block text-[10px] font-semibold text-slate-400 uppercase mb-1">Status Comercial</label>
                        <select
                          value={formStatus}
                          onChange={(e) => setFormStatus(e.target.value)}
                          className="w-full px-3 py-1.5 text-xs bg-slate-950 border border-slate-800 rounded-lg text-slate-200 focus:outline-none focus:border-indigo-500 cursor-pointer"
                        >
                          <option value="NOT_STARTED">NOT_STARTED (Não iniciado)</option>
                          <option value="ACTIVE">ACTIVE (Em andamento)</option>
                          <option value="PROPOSAL_SENT">PROPOSAL_SENT (Proposta enviada)</option>
                          <option value="WON">WON (Ganho / Convertido)</option>
                          <option value="LOST">LOST (Perdido)</option>
                        </select>
                      </div>

                      {/* Plan update dropdown */}
                      <div>
                        <label className="block text-[10px] font-semibold text-slate-400 uppercase mb-1">Plano do Piloto (Manual)</label>
                        <select
                          value={formPlanId}
                          onChange={(e) => setFormPlanId(e.target.value)}
                          className="w-full px-3 py-1.5 text-xs bg-slate-950 border border-slate-800 rounded-lg text-slate-200 focus:outline-none focus:border-indigo-500 cursor-pointer"
                        >
                          <option value="">Sem alteração de plano</option>
                          {plans.map((p: any) => (
                            <option key={p.id} value={p.id}>
                              {p.name} ({p.code})
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Dates */}
                      <div>
                        <label className="block text-[10px] font-semibold text-slate-400 uppercase mb-1">Início do Piloto</label>
                        <input
                          type="date"
                          value={formStartedAt}
                          onChange={(e) => setFormStartedAt(e.target.value)}
                          className="w-full px-3 py-1.5 text-xs bg-slate-950 border border-slate-800 rounded-lg text-slate-200 focus:outline-none focus:border-indigo-500"
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] font-semibold text-slate-400 uppercase mb-1">Fim do Piloto</label>
                        <input
                          type="date"
                          value={formEndsAt}
                          onChange={(e) => setFormEndsAt(e.target.value)}
                          className="w-full px-3 py-1.5 text-xs bg-slate-950 border border-slate-800 rounded-lg text-slate-200 focus:outline-none focus:border-indigo-500"
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] font-semibold text-slate-400 uppercase mb-1">Proposta Enviada Em</label>
                        <input
                          type="date"
                          value={formProposalSentAt}
                          onChange={(e) => setFormProposalSentAt(e.target.value)}
                          className="w-full px-3 py-1.5 text-xs bg-slate-950 border border-slate-800 rounded-lg text-slate-200 focus:outline-none focus:border-indigo-500"
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] font-semibold text-slate-400 uppercase mb-1">Convertido Em</label>
                        <input
                          type="date"
                          value={formConvertedAt}
                          onChange={(e) => setFormConvertedAt(e.target.value)}
                          className="w-full px-3 py-1.5 text-xs bg-slate-950 border border-slate-800 rounded-lg text-slate-200 focus:outline-none focus:border-indigo-500"
                        />
                      </div>
                    </div>

                    {/* Lost Reason (only visible if status is LOST) */}
                    {formStatus === 'LOST' && (
                      <div className="space-y-1">
                        <label className="block text-[10px] font-semibold text-red-400 uppercase">Motivo de Perda (Obrigatório)</label>
                        <textarea
                          placeholder="Digite o motivo detalhado para a perda comercial..."
                          value={formLostReason}
                          onChange={(e) => setFormLostReason(e.target.value)}
                          rows={3}
                          className="w-full px-3 py-2 text-xs bg-slate-950 border border-slate-800 rounded-lg text-slate-250 placeholder-slate-650 focus:outline-none focus:border-red-500 focus:ring-0 resize-none"
                        />
                      </div>
                    )}

                    {/* Commercial Notes */}
                    <div className="space-y-1">
                      <label className="block text-[10px] font-semibold text-slate-400 uppercase">Notas Comerciais</label>
                      <textarea
                        placeholder="Observações do follow-up, propostas comerciais ou particularidades do cliente..."
                        value={formNotes}
                        onChange={(e) => setFormNotes(e.target.value)}
                        rows={4}
                        className="w-full px-3 py-2 text-xs bg-slate-950 border border-slate-800 rounded-lg text-slate-250 placeholder-slate-650 focus:outline-none focus:border-indigo-500 focus:ring-0 resize-none"
                      />
                    </div>

                    {/* Submit Update button */}
                    <div className="flex justify-end pt-2">
                      <button
                        type="submit"
                        disabled={updating}
                        className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold bg-indigo-650 hover:bg-indigo-600 disabled:bg-indigo-850 text-white rounded-lg transition-colors cursor-pointer disabled:cursor-not-allowed shadow-md"
                      >
                        {updating ? (
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Check className="w-3.5 h-3.5" />
                        )}
                        <span>Salvar Parâmetros</span>
                      </button>
                    </div>
                  </form>

                  {/* Proposal Summary Section */}
                  <div className="border-t border-slate-850 pt-6 space-y-4">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                        <FileText className="w-3.5 h-3.5 text-indigo-400" />
                        <span>Resumo Executivo para Proposta</span>
                      </h4>
                      <button
                        type="button"
                        onClick={handleGenerateSummary}
                        disabled={summaryLoading}
                        className="px-3 py-1.5 text-[10px] font-bold bg-slate-800 hover:bg-slate-750 text-indigo-400 rounded border border-slate-700 transition-colors cursor-pointer disabled:cursor-not-allowed"
                      >
                        {summaryLoading ? 'Gerando...' : 'Gerar Resumo Operacional'}
                      </button>
                    </div>

                    {summaryMarkdown && (
                      <div className="space-y-2">
                        <p className="text-[10px] text-slate-500">Copie o resumo em Markdown abaixo para embasar a proposta comercial:</p>
                        <div className="p-4 bg-slate-950 border border-slate-850 rounded-xl max-h-[300px] overflow-y-auto">
                          <pre className="text-[11px] text-slate-300 font-mono whitespace-pre-wrap leading-relaxed select-all">
                            {summaryMarkdown}
                          </pre>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
