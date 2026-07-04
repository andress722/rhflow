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
  Activity,
  AlertTriangle,
  CheckCircle,
  HelpCircle,
  ArrowRight,
  Sparkles,
  ChevronUp
} from 'lucide-react';

import { trackEvent } from '@/lib/telemetry';

export default function AdminCustomerSuccessPage() {
  const [items, setItems] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(10);

  // Filters
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<string>('');
  const [plan, setPlan] = useState<string>('');

  // Loading & error states
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [requestId, setRequestId] = useState<string | null>(null);

  const fetchSuccessData = async () => {
    setLoading(true);
    setError(null);
    setRequestId(null);
    try {
      const params = new URLSearchParams();
      if (search) params.append('search', search);
      if (status) params.append('status', status);
      if (plan) params.append('plan', plan);
      params.append('page', page.toString());
      params.append('pageSize', pageSize.toString());

      const response = await api.get(`/admin/support/customer-success?${params.toString()}`) as any;
      if (response && response.success) {
        setItems(response.items || []);
        setTotal(response.total || 0);
      } else {
        setError(response?.error?.message || 'Erro ao carregar lista de sucesso do cliente.');
        setRequestId(response?.error?.requestId || null);
      }
    } catch (err) {
      setError('Erro de rede ao carregar o painel de sucesso do cliente.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSuccessData();
    trackEvent('PAGE_VIEW', 'SUPPORT', { path: '/app/admin/support/customer-success' });
  }, [page, status, plan]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchSuccessData();
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'HEALTHY':
        return 'bg-emerald-500/10 text-emerald-450 border border-emerald-500/20';
      case 'ATTENTION':
        return 'bg-amber-500/10 text-amber-450 border border-amber-500/20';
      case 'CRITICAL':
        return 'bg-red-500/10 text-red-450 border border-red-500/20';
      default:
        return 'bg-slate-800 text-slate-400 border border-slate-700';
    }
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <div className="flex items-center gap-2 text-xs text-indigo-400 font-bold uppercase tracking-wider mb-1">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Suporte da Plataforma</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            Acompanhamento de Sucesso do Piloto
          </h1>
          <p className="text-sm text-slate-400">
            Console geral de health score dos clientes piloto, adoção em 7 dias, riscos e recomendações.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/app/help"
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-indigo-950/30 hover:bg-indigo-900/30 text-indigo-400 border border-indigo-900/40 rounded-lg transition-colors cursor-pointer"
          >
            <HelpCircle className="w-3.5 h-3.5" />
            <span>Ver Manuais</span>
          </Link>
          <Link
            href="/app/admin/support"
            className="px-3.5 py-1.5 text-xs font-semibold bg-slate-800 hover:bg-slate-755 text-slate-300 border border-slate-700 rounded-lg transition-colors cursor-pointer"
          >
            Voltar ao Suporte
          </Link>
          <button
            onClick={() => fetchSuccessData()}
            className="flex items-center gap-2 px-3.5 py-1.5 text-xs font-semibold bg-indigo-650 hover:bg-indigo-600 text-white rounded-lg transition-colors cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Atualizar</span>
          </button>
        </div>
      </div>

      {/* Filters Form */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
        <form onSubmit={handleSearchSubmit} className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
          {/* Search Query */}
          <div>
            <label className="block text-[10px] font-semibold text-slate-400 uppercase mb-1">Buscar Empresa</label>
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-slate-650" />
              <input
                type="text"
                placeholder="Nome ou CNPJ..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-950 border border-slate-800 rounded-lg text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          {/* Status Filter */}
          <div>
            <label className="block text-[10px] font-semibold text-slate-400 uppercase mb-1">Status de Saúde</label>
            <select
              value={status}
              onChange={(e) => {
                setStatus(e.target.value);
                setPage(1);
              }}
              className="w-full px-3 py-1.5 text-xs bg-slate-950 border border-slate-800 rounded-lg text-slate-200 focus:outline-none focus:border-indigo-500 cursor-pointer"
            >
              <option value="">Todos os status</option>
              <option value="HEALTHY">HEALTHY (Saudável)</option>
              <option value="ATTENTION">ATTENTION (Atenção)</option>
              <option value="CRITICAL">CRITICAL (Crítico)</option>
            </select>
          </div>

          {/* Plan Filter */}
          <div>
            <label className="block text-[10px] font-semibold text-slate-400 uppercase mb-1">Plano</label>
            <input
              type="text"
              placeholder="Ex: PRO, STARTER..."
              value={plan}
              onChange={(e) => {
                setPlan(e.target.value);
                setPage(1);
              }}
              className="w-full px-3 py-1.5 text-xs bg-slate-950 border border-slate-800 rounded-lg text-slate-200 placeholder-slate-655 focus:outline-none focus:border-indigo-500"
            />
          </div>

          {/* Search Trigger */}
          <div className="flex items-end">
            <button
              type="submit"
              className="w-full py-1.5 text-xs font-semibold bg-slate-800 hover:bg-slate-750 text-white rounded-lg border border-slate-700 transition-colors cursor-pointer"
            >
              Aplicar Pesquisa
            </button>
          </div>
        </form>
      </div>

      {/* Main Content Area */}
      {error ? (
        <div className="p-4 bg-red-950/20 border border-red-800/50 rounded-xl flex items-center gap-3 text-red-400 text-sm">
          <ShieldAlert className="w-5 h-5 shrink-0" />
          <span>{error}</span>
          {requestId && <span className="text-[10px] text-slate-500 font-mono"> (ID: {requestId})</span>}
        </div>
      ) : loading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3 bg-slate-900 border border-slate-800 rounded-xl">
          <div className="w-8 h-8 border-4 border-indigo-650 border-t-transparent rounded-full animate-spin"></div>
          <span className="text-sm text-slate-400 font-medium">Carregando métricas de sucesso...</span>
        </div>
      ) : items.length === 0 ? (
        <div className="text-center py-16 bg-slate-900 border border-slate-800 rounded-xl">
          <Building2 className="w-8 h-8 text-slate-600 mx-auto mb-3" />
          <h4 className="text-sm font-bold text-slate-400">Nenhum cliente piloto encontrado</h4>
          <p className="text-xs text-slate-600 mt-1">Ajuste os filtros de pesquisa para visualizar as empresas.</p>
        </div>
      ) : (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4 shadow-md">
          <div className="overflow-x-auto border border-slate-850 rounded-lg">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-950 text-slate-400 border-b border-slate-800 font-semibold">
                  <th className="p-3">Empresa</th>
                  <th className="p-3">Plano</th>
                  <th className="p-3 text-center">Health Score</th>
                  <th className="p-3 text-center">Status</th>
                  <th className="p-3 text-center">Adesão (7d)</th>
                  <th className="p-3 text-center">Funcionários Ativos</th>
                  <th className="p-3">Última Atividade</th>
                  <th className="p-3 text-center">Riscos</th>
                  <th className="p-3 text-center">Recomendações</th>
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
                      <span className="font-bold text-slate-300 bg-slate-950/40 px-2 py-0.5 rounded border border-slate-800">
                        {item.plan}
                      </span>
                    </td>
                    <td className="p-3 text-center">
                      <span className="font-extrabold text-sm text-slate-200">{item.healthScore}</span>
                    </td>
                    <td className="p-3 text-center">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${getStatusColor(item.status)}`}>
                        {item.status}
                      </span>
                    </td>
                    <td className="p-3 text-center font-semibold text-slate-200">
                      {item.responseRate7d}%
                    </td>
                    <td className="p-3 text-center text-slate-300 font-medium">
                      {item.activeEmployees}
                    </td>
                    <td className="p-3 text-slate-450">
                      {item.lastActivityAt
                        ? new Date(item.lastActivityAt).toLocaleString()
                        : 'Sem atividade'}
                    </td>
                    <td className="p-3 text-center font-bold text-red-400">
                      {item.risksCount > 0 ? (
                        <span className="px-1.5 py-0.5 rounded bg-red-950/20 border border-red-900/30">
                          {item.risksCount}
                        </span>
                      ) : (
                        <span className="text-slate-650">-</span>
                      )}
                    </td>
                    <td className="p-3 text-center font-bold text-indigo-400">
                      {item.recommendationsCount > 0 ? (
                        <span className="px-1.5 py-0.5 rounded bg-indigo-950/20 border border-indigo-900/30">
                          {item.recommendationsCount}
                        </span>
                      ) : (
                        <span className="text-slate-650">-</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination Controls */}
          <div className="flex items-center justify-between border-t border-slate-800 pt-4">
            <span className="text-xs text-slate-500">
              Mostrando {items.length} de {total} empresas (Página {page})
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
    </div>
  );
}
