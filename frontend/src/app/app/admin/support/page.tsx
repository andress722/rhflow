'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import {
  Building2,
  Users,
  CheckCircle2,
  Clock,
  FileText,
  AlertTriangle,
  MessageSquare,
  BarChart3,
  Sliders,
  Search,
  RefreshCw,
  Calendar,
  AlertCircle,
  Eye,
  ChevronLeft,
  ChevronRight,
  Database
} from 'lucide-react';

export default function SupportDashboardPage() {
  const [activeTab, setActiveTab] = useState<'overview' | 'errors' | 'health'>('overview');
  
  // Loading & error states
  const [overviewLoading, setOverviewLoading] = useState(true);
  const [errorsLoading, setErrorsLoading] = useState(false);
  const [healthLoading, setHealthLoading] = useState(false);
  const [metricsLoading, setMetricsLoading] = useState(false);

  const [overviewError, setOverviewError] = useState<string | null>(null);
  const [errorsError, setErrorsError] = useState<string | null>(null);
  const [healthError, setHealthError] = useState<string | null>(null);
  const [metricsError, setMetricsError] = useState<string | null>(null);

  // Overview Data
  const [overview, setOverview] = useState<any>({
    totalCompanies: 0,
    activeCompanies: 0,
    inactiveCompanies: 0,
    activeUsers: 0,
    checkinsToday: 0,
    openOccurrences: 0,
    pendingMedicalCertificates: 0,
    jobsToday: null,
    whatsappChannelsInError: 0,
    companiesNearPlanLimit: 0,
  });

  // Recent Errors Data
  const [errors, setErrors] = useState<any[]>([]);
  const [errorFilters, setErrorFilters] = useState({
    companyId: '',
    errorCode: '',
    statusCode: '',
    from: '',
    to: '',
    page: 1,
    limit: 20,
  });

  // Request ID Trace Data
  const [searchRequestId, setSearchRequestId] = useState('');
  const [traceData, setTraceData] = useState<any>(null);
  const [traceLoading, setTraceLoading] = useState(false);
  const [traceError, setTraceError] = useState<string | null>(null);

  // Company Health Data
  const [companiesHealth, setCompaniesHealth] = useState<any[]>([]);
  const [healthSearch, setHealthSearch] = useState('');
  const [healthPage, setHealthPage] = useState(1);
  const [healthLimit] = useState(20);

  // Pilot Metrics Data (Date range defaults to last 7 days)
  const getSevenDaysAgoStr = () => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return d.toISOString().split('T')[0];
  };
  const getTodayStr = () => {
    return new Date().toISOString().split('T')[0];
  };

  const [metricsDates, setMetricsDates] = useState({
    from: getSevenDaysAgoStr(),
    to: getTodayStr(),
  });
  
  const [pilotMetrics, setPilotMetrics] = useState<any>({
    checkinsSent: 0,
    responseRate: 0,
    notRespondedCount: 0,
    occurrencesCreated: 0,
    medicalCertificatesReceived: 0,
    reportsExported: 0,
    activeUsers: 0,
    errorsByCode: [],
    errorsByRoute: [],
  });

  // Selected error trace modal
  const [selectedTraceItem, setSelectedTraceItem] = useState<any>(null);

  // Fetch Overview data
  const fetchOverview = async () => {
    setOverviewLoading(true);
    setOverviewError(null);
    try {
      const response = await api.get('/admin/support/overview');
      if (response.success) {
        setOverview(response.data);
      } else {
        setOverviewError(response.error?.message || 'Erro ao carregar dados gerais.');
      }
    } catch (err) {
      setOverviewError('Erro de rede ao carregar visão geral.');
    } finally {
      setOverviewLoading(false);
    }
  };

  // Fetch Recent Errors data
  const fetchRecentErrors = async () => {
    setErrorsLoading(true);
    setErrorsError(null);
    try {
      const params = new URLSearchParams();
      if (errorFilters.companyId) params.append('companyId', errorFilters.companyId);
      if (errorFilters.errorCode) params.append('errorCode', errorFilters.errorCode);
      if (errorFilters.statusCode) params.append('statusCode', errorFilters.statusCode);
      if (errorFilters.from) params.append('from', errorFilters.from);
      if (errorFilters.to) params.append('to', errorFilters.to);
      params.append('limit', errorFilters.limit.toString());
      params.append('page', errorFilters.page.toString());

      const response = await api.get(`/admin/support/recent-errors?${params.toString()}`);
      if (response.success) {
        setErrors(response.data || []);
      } else {
        setErrorsError(response.error?.message || 'Erro ao buscar logs de erro.');
      }
    } catch (err) {
      setErrorsError('Erro de rede ao carregar erros.');
    } finally {
      setErrorsLoading(false);
    }
  };

  // Fetch Company Health data
  const fetchCompanyHealth = async () => {
    setHealthLoading(true);
    setHealthError(null);
    try {
      const params = new URLSearchParams();
      if (healthSearch) params.append('search', healthSearch);
      params.append('limit', healthLimit.toString());
      params.append('page', healthPage.toString());

      const response = await api.get(`/admin/support/company-health?${params.toString()}`);
      if (response.success) {
        setCompaniesHealth(response.data || []);
      } else {
        setHealthError(response.error?.message || 'Erro ao buscar saúde das empresas.');
      }
    } catch (err) {
      setHealthError('Erro de rede ao carregar saúde das empresas.');
    } finally {
      setHealthLoading(false);
    }
  };

  // Fetch Pilot Metrics data
  const fetchPilotMetrics = async () => {
    setMetricsLoading(true);
    setMetricsError(null);
    try {
      const params = new URLSearchParams();
      if (metricsDates.from) params.append('from', metricsDates.from);
      if (metricsDates.to) params.append('to', metricsDates.to);

      const response = await api.get(`/admin/support/pilot-metrics?${params.toString()}`);
      if (response.success) {
        setPilotMetrics(response.data);
      } else {
        setMetricsError(response.error?.message || 'Erro ao carregar métricas.');
      }
    } catch (err) {
      setMetricsError('Erro de rede ao carregar métricas.');
    } finally {
      setMetricsLoading(false);
    }
  };

  // Search Request ID Trace
  const handleTraceSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!searchRequestId.trim()) return;

    setTraceLoading(true);
    setTraceError(null);
    setTraceData(null);
    try {
      const response = await api.get(`/admin/support/request/${searchRequestId.trim()}`);
      if (response.success) {
        setTraceData(response.data);
      } else {
        setTraceError(response.error?.message || 'Nenhum trace encontrado para esta requisição.');
      }
    } catch (err) {
      setTraceError('Erro de rede ao buscar requestId.');
    } finally {
      setTraceLoading(false);
    }
  };

  // Effect to load on mount and tab switch
  useEffect(() => {
    fetchOverview();
    fetchPilotMetrics();
  }, []);

  useEffect(() => {
    if (activeTab === 'errors') {
      fetchRecentErrors();
    } else if (activeTab === 'health') {
      fetchCompanyHealth();
    }
  }, [activeTab, errorFilters.page, healthPage]);

  // Apply filters triggers
  const handleFilterSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorFilters(prev => ({ ...prev, page: 1 }));
    fetchRecentErrors();
  };

  const handleHealthSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setHealthPage(1);
    fetchCompanyHealth();
  };

  const handleMetricsSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchPilotMetrics();
  };

  const getDiffDays = () => {
    const fromDate = new Date(metricsDates.from);
    const toDate = new Date(metricsDates.to);
    const diffTime = Math.abs(toDate.getTime() - fromDate.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return isNaN(diffDays) ? 7 : diffDays;
  };

  return (
    <div className="space-y-8">
      {/* Header section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Painel de Suporte & Diagnóstico</h1>
          <p className="text-sm text-slate-400">
            Acompanhamento técnico, telemetria de erros, integridade das empresas e adoção do piloto.
          </p>
        </div>
        <button
          onClick={() => {
            fetchOverview();
            fetchPilotMetrics();
            if (activeTab === 'errors') fetchRecentErrors();
            if (activeTab === 'health') fetchCompanyHealth();
          }}
          className="flex items-center gap-2 px-3.5 py-2 text-sm font-medium bg-slate-800 hover:bg-slate-700 active:bg-slate-900 border border-slate-700 rounded-lg text-slate-200 transition-colors self-start md:self-auto"
        >
          <RefreshCw className="w-4 h-4" />
          <span>Atualizar Todos</span>
        </button>
      </div>

      {/* Tabs list */}
      <div className="flex border-b border-slate-800">
        <button
          onClick={() => setActiveTab('overview')}
          className={`px-5 py-3 text-sm font-medium border-b-2 transition-all ${
            activeTab === 'overview'
              ? 'border-indigo-500 text-indigo-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          Visão Geral & Métricas
        </button>
        <button
          onClick={() => setActiveTab('errors')}
          className={`px-5 py-3 text-sm font-medium border-b-2 transition-all ${
            activeTab === 'errors'
              ? 'border-indigo-500 text-indigo-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          Erros Recentes & Rastreio
        </button>
        <button
          onClick={() => setActiveTab('health')}
          className={`px-5 py-3 text-sm font-medium border-b-2 transition-all ${
            activeTab === 'health'
              ? 'border-indigo-500 text-indigo-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          Saúde das Empresas
        </button>
        <Link
          href="/app/admin/support/customer-success"
          className="px-5 py-3 text-sm font-medium border-b-2 border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-800 transition-all flex items-center gap-1.5"
        >
          Sucesso do Piloto
        </Link>
      </div>

      {/* Tab: Overview & Pilot Metrics */}
      {activeTab === 'overview' && (
        <div className="space-y-8">
          {/* Stat Cards */}
          {overviewLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {[...Array(8)].map((_, i) => (
                <div key={i} className="h-28 bg-slate-900/50 border border-slate-800 rounded-xl animate-pulse"></div>
              ))}
            </div>
          ) : overviewError ? (
            <div className="p-4 bg-red-950/20 border border-red-800/50 rounded-xl flex items-center gap-3 text-red-400 text-sm">
              <AlertCircle className="w-5 h-5 shrink-0" />
              <span>{overviewError}</span>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl flex items-start justify-between">
                <div>
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Empresas Ativas</p>
                  <p className="text-2xl font-bold text-white mt-1">
                    {overview.activeCompanies} <span className="text-xs font-normal text-slate-500">/ {overview.totalCompanies} total</span>
                  </p>
                </div>
                <div className="p-2.5 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-400">
                  <Building2 className="w-5 h-5" />
                </div>
              </div>

              <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl flex items-start justify-between">
                <div>
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Usuários Ativos</p>
                  <p className="text-2xl font-bold text-white mt-1">{overview.activeUsers}</p>
                </div>
                <div className="p-2.5 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
                  <Users className="w-5 h-5" />
                </div>
              </div>

              <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl flex items-start justify-between">
                <div>
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Check-ins Hoje</p>
                  <p className="text-2xl font-bold text-white mt-1">{overview.checkinsToday}</p>
                </div>
                <div className="p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
              </div>

              <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl flex items-start justify-between">
                <div>
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Ocorrências Abertas</p>
                  <p className="text-2xl font-bold text-white mt-1">{overview.openOccurrences}</p>
                </div>
                <div className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400">
                  <Clock className="w-5 h-5" />
                </div>
              </div>

              <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl flex items-start justify-between">
                <div>
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Atestados Pendentes</p>
                  <p className="text-2xl font-bold text-white mt-1">{overview.pendingMedicalCertificates}</p>
                </div>
                <div className="p-2.5 rounded-lg bg-teal-500/10 border border-teal-500/20 text-teal-400">
                  <FileText className="w-5 h-5" />
                </div>
              </div>

              <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl flex items-start justify-between">
                <div>
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Jobs Executados Hoje</p>
                  <p className="text-2xl font-bold text-white mt-1">
                    {overview.jobsToday !== null ? overview.jobsToday : 'N/A'}
                  </p>
                </div>
                <div className="p-2.5 rounded-lg bg-purple-500/10 border border-purple-500/20 text-purple-400">
                  <Database className="w-5 h-5" />
                </div>
              </div>

              <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl flex items-start justify-between">
                <div>
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">WhatsApp com Erro</p>
                  <p className="text-2xl font-bold text-red-400 mt-1">{overview.whatsappChannelsInError}</p>
                </div>
                <div className="p-2.5 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400">
                  <MessageSquare className="w-5 h-5" />
                </div>
              </div>

              <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl flex items-start justify-between">
                <div>
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Perto do Limite de Plano</p>
                  <p className="text-2xl font-bold text-amber-400 mt-1">{overview.companiesNearPlanLimit}</p>
                </div>
                <div className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-500">
                  <AlertTriangle className="w-5 h-5" />
                </div>
              </div>
            </div>
          )}

          {/* Pilot Adoption & Telemetry Section */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
              <div className="flex items-center gap-3">
                <BarChart3 className="w-5 h-5 text-indigo-400" />
                <h3 className="text-lg font-bold text-white">Métricas de Adoção do Piloto</h3>
              </div>

              {/* Date Filters Form */}
              <form onSubmit={handleMetricsSubmit} className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-2 bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5">
                  <Calendar className="w-4 h-4 text-slate-500" />
                  <input
                    type="date"
                    value={metricsDates.from}
                    onChange={(e) => setMetricsDates(prev => ({ ...prev, from: e.target.value }))}
                    className="bg-transparent text-xs text-slate-300 border-none outline-none focus:ring-0 w-28"
                  />
                  <span className="text-slate-600 text-xs">até</span>
                  <input
                    type="date"
                    value={metricsDates.to}
                    onChange={(e) => setMetricsDates(prev => ({ ...prev, to: e.target.value }))}
                    className="bg-transparent text-xs text-slate-300 border-none outline-none focus:ring-0 w-28"
                  />
                </div>
                <button
                  type="submit"
                  disabled={metricsLoading}
                  className="px-3 py-1.5 text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white rounded-lg transition-colors flex items-center gap-1.5"
                >
                  {metricsLoading ? 'Carregando...' : 'Filtrar'}
                </button>
              </form>
            </div>

            {metricsError ? (
              <div className="p-4 bg-red-950/20 border border-red-800/50 rounded-xl flex items-center gap-3 text-red-400 text-sm">
                <AlertCircle className="w-5 h-5 shrink-0" />
                <span>{metricsError}</span>
              </div>
            ) : metricsLoading ? (
              <div className="flex flex-col items-center justify-center py-20 gap-3">
                <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
                <span className="text-sm text-slate-400 font-medium">Carregando métricas...</span>
              </div>
            ) : (
              <div className="space-y-8">
                {/* Micro indicators */}
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
                  <div className="bg-slate-950/50 border border-slate-800/80 p-4 rounded-xl text-center">
                    <p className="text-[10px] font-semibold text-slate-500 uppercase">Check-ins Disparados</p>
                    <p className="text-xl font-extrabold text-white mt-1">{pilotMetrics.checkinsSent}</p>
                  </div>
                  <div className="bg-slate-950/50 border border-slate-800/80 p-4 rounded-xl text-center">
                    <p className="text-[10px] font-semibold text-slate-500 uppercase">Taxa de Resposta</p>
                    <p className="text-xl font-extrabold text-indigo-400 mt-1">
                      {pilotMetrics.responseRate.toFixed(1)}%
                    </p>
                  </div>
                  <div className="bg-slate-950/50 border border-slate-800/80 p-4 rounded-xl text-center">
                    <p className="text-[10px] font-semibold text-slate-500 uppercase">Não Respondidos</p>
                    <p className="text-xl font-extrabold text-amber-500 mt-1">{pilotMetrics.notRespondedCount}</p>
                  </div>
                  <div className="bg-slate-950/50 border border-slate-800/80 p-4 rounded-xl text-center">
                    <p className="text-[10px] font-semibold text-slate-500 uppercase">Ocorrências Criadas</p>
                    <p className="text-xl font-extrabold text-white mt-1">{pilotMetrics.occurrencesCreated}</p>
                  </div>
                  <div className="bg-slate-950/50 border border-slate-800/80 p-4 rounded-xl text-center">
                    <p className="text-[10px] font-semibold text-slate-500 uppercase">Atestados Submetidos</p>
                    <p className="text-xl font-extrabold text-white mt-1">{pilotMetrics.medicalCertificatesReceived}</p>
                  </div>
                  <div className="bg-slate-950/50 border border-slate-800/80 p-4 rounded-xl text-center">
                    <p className="text-[10px] font-semibold text-slate-500 uppercase">Exportação de Relatórios</p>
                    <p className="text-xl font-extrabold text-white mt-1">{pilotMetrics.reportsExported}</p>
                  </div>
                  <div className="bg-slate-950/50 border border-slate-800/80 p-4 rounded-xl text-center">
                    <p className="text-[10px] font-semibold text-slate-500 uppercase">Usuários Ativos (Filtro)</p>
                    <p className="text-xl font-extrabold text-indigo-400 mt-1">{pilotMetrics.activeUsers}</p>
                  </div>
                </div>

                {/* Error Lists Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Errors By Code */}
                  <div className="bg-slate-950 border border-slate-800 rounded-xl p-5 space-y-4">
                    <h4 className="text-sm font-bold text-slate-200 border-b border-slate-800 pb-2 flex items-center justify-between">
                      <span>Erros por Código</span>
                      <span className="text-xs font-normal text-slate-500">Últimos {getDiffDays()} dias</span>
                    </h4>
                    {pilotMetrics.errorsByCode.length === 0 ? (
                      <p className="text-xs text-slate-500 py-6 text-center">Nenhum erro registrado neste período.</p>
                    ) : (
                      <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                        {pilotMetrics.errorsByCode.map((err: any, idx: number) => (
                          <div key={idx} className="flex items-center justify-between px-3 py-2 bg-slate-900/40 rounded-lg border border-slate-800 text-xs">
                            <span className="font-semibold text-slate-300 font-mono">{err.errorCode}</span>
                            <span className="px-2 py-0.5 rounded bg-red-950/40 border border-red-800/40 text-red-400 font-medium">{err.count} ocorrências</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Errors By Route */}
                  <div className="bg-slate-950 border border-slate-800 rounded-xl p-5 space-y-4">
                    <h4 className="text-sm font-bold text-slate-200 border-b border-slate-800 pb-2 flex items-center justify-between">
                      <span>Erros por Rota/Endpoint</span>
                      <span className="text-xs font-normal text-slate-500">Ordenados por volume</span>
                    </h4>
                    {pilotMetrics.errorsByRoute.length === 0 ? (
                      <p className="text-xs text-slate-500 py-6 text-center">Nenhum erro registrado neste período.</p>
                    ) : (
                      <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                        {pilotMetrics.errorsByRoute.map((err: any, idx: number) => (
                          <div key={idx} className="flex items-center justify-between px-3 py-2 bg-slate-900/40 rounded-lg border border-slate-800 text-xs gap-3">
                            <div className="flex items-center gap-2 overflow-hidden">
                              <span className="px-1.5 py-0.5 rounded bg-slate-800 text-[9px] font-bold text-slate-400">{err.method}</span>
                              <span className="text-slate-300 font-mono truncate">{err.route}</span>
                            </div>
                            <span className="px-2 py-0.5 rounded bg-slate-800/50 border border-slate-700/50 text-slate-300 font-medium shrink-0">{err.count} logs</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab: Recent Errors & Request ID lookup */}
      {activeTab === 'errors' && (
        <div className="space-y-8 animate-fadeIn">
          {/* Request ID Trace Search */}
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-xl space-y-4">
            <div>
              <h3 className="text-base font-bold text-white">Investigar por Request ID</h3>
              <p className="text-xs text-slate-400">Rastreie o ciclo de vida e logs associados a uma requisição específica usando o identificador único.</p>
            </div>
            
            <form onSubmit={handleTraceSearch} className="flex gap-3 max-w-xl">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-500" />
                <input
                  type="text"
                  placeholder="Cole o x-request-id aqui..."
                  value={searchRequestId}
                  onChange={(e) => setSearchRequestId(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 text-sm bg-slate-950 border border-slate-800 rounded-lg text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                />
              </div>
              <button
                type="submit"
                disabled={traceLoading}
                className="px-4 py-2 text-sm font-semibold bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white rounded-lg transition-all"
              >
                {traceLoading ? 'Buscando...' : 'Buscar Trace'}
              </button>
            </form>

            {traceError && (
              <div className="p-3 bg-red-950/20 border border-red-800/50 rounded-lg text-red-400 text-xs">
                {traceError}
              </div>
            )}

            {/* Trace results */}
            {traceData && (
              <div className="bg-slate-950 border border-slate-800 rounded-xl p-5 mt-4 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse"></div>
                    <span className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Logs da Requisição:</span>
                    <span className="text-xs font-mono text-indigo-400 font-bold">{traceData.requestId}</span>
                  </div>
                  <button 
                    onClick={() => setTraceData(null)}
                    className="text-xs text-slate-500 hover:text-slate-300"
                  >
                    Limpar Busca
                  </button>
                </div>

                <div className="space-y-3">
                  {traceData.items.map((item: any, idx: number) => (
                    <div key={idx} className="p-4 bg-slate-900 border border-slate-800 rounded-lg space-y-3">
                      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-red-400">{item.errorCode}</span>
                          <span className="text-slate-500">|</span>
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            item.statusCode >= 500 ? 'bg-red-950 text-red-400' : 'bg-amber-950 text-amber-400'
                          }`}>
                            HTTP {item.statusCode}
                          </span>
                          <span className="text-slate-500">|</span>
                          <span className="px-1.5 py-0.5 rounded bg-slate-800 text-[10px] font-mono font-semibold">{item.method}</span>
                          <span className="text-slate-300 font-mono">{item.route}</span>
                        </div>
                        <span className="text-slate-500">{new Date(item.createdAt).toLocaleString()}</span>
                      </div>

                      <p className="text-xs text-slate-300 bg-slate-950/60 p-2.5 rounded border border-slate-900 font-mono whitespace-pre-wrap">{item.message}</p>
                      
                      {item.metadata && (
                        <div>
                          <button
                            type="button"
                            onClick={() => setSelectedTraceItem(item)}
                            className="flex items-center gap-1.5 text-xs text-indigo-400 hover:text-indigo-300 font-medium"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>Visualizar Metadata e Stack Trace</span>
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Recent Errors Log */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-6">
            <h3 className="text-base font-bold text-white border-b border-slate-800 pb-3 flex items-center justify-between">
              <span>Painel Geral de Logs de Erros</span>
              <span className="text-xs font-normal text-slate-400">Filtrar e navegar pelos últimos registros</span>
            </h3>

            {/* Error Filters */}
            <form onSubmit={handleFilterSubmit} className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              <div>
                <label className="block text-[10px] font-semibold text-slate-400 uppercase mb-1">Empresa ID</label>
                <input
                  type="text"
                  placeholder="UUID da empresa..."
                  value={errorFilters.companyId}
                  onChange={(e) => setErrorFilters(prev => ({ ...prev, companyId: e.target.value }))}
                  className="w-full px-3 py-1.5 text-xs bg-slate-950 border border-slate-800 rounded-lg text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-[10px] font-semibold text-slate-400 uppercase mb-1">Código de Erro</label>
                <input
                  type="text"
                  placeholder="EX: VALIDATION_ERROR..."
                  value={errorFilters.errorCode}
                  onChange={(e) => setErrorFilters(prev => ({ ...prev, errorCode: e.target.value }))}
                  className="w-full px-3 py-1.5 text-xs bg-slate-950 border border-slate-800 rounded-lg text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-[10px] font-semibold text-slate-400 uppercase mb-1">Status HTTP</label>
                <input
                  type="text"
                  placeholder="Ex: 400, 500..."
                  value={errorFilters.statusCode}
                  onChange={(e) => setErrorFilters(prev => ({ ...prev, statusCode: e.target.value }))}
                  className="w-full px-3 py-1.5 text-xs bg-slate-950 border border-slate-800 rounded-lg text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-[10px] font-semibold text-slate-400 uppercase mb-1">A partir de</label>
                <input
                  type="date"
                  value={errorFilters.from}
                  onChange={(e) => setErrorFilters(prev => ({ ...prev, from: e.target.value }))}
                  className="w-full px-3 py-1.5 text-xs bg-slate-950 border border-slate-800 rounded-lg text-slate-200 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-[10px] font-semibold text-slate-400 uppercase mb-1">Até</label>
                <input
                  type="date"
                  value={errorFilters.to}
                  onChange={(e) => setErrorFilters(prev => ({ ...prev, to: e.target.value }))}
                  className="w-full px-3 py-1.5 text-xs bg-slate-950 border border-slate-800 rounded-lg text-slate-200 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="flex items-end">
                <button
                  type="submit"
                  disabled={errorsLoading}
                  className="w-full py-1.5 text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition-colors"
                >
                  {errorsLoading ? 'Carregando...' : 'Aplicar'}
                </button>
              </div>
            </form>

            {errorsError ? (
              <div className="p-4 bg-red-950/20 border border-red-800/50 rounded-xl flex items-center gap-3 text-red-400 text-sm">
                <AlertCircle className="w-5 h-5 shrink-0" />
                <span>{errorsError}</span>
              </div>
            ) : errorsLoading ? (
              <div className="flex flex-col items-center justify-center py-20 gap-3">
                <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
                <span className="text-sm text-slate-400 font-medium">Carregando erros...</span>
              </div>
            ) : errors.length === 0 ? (
              <div className="text-center py-16 bg-slate-950/20 border border-slate-800/60 rounded-xl">
                <AlertCircle className="w-8 h-8 text-slate-600 mx-auto mb-3" />
                <h4 className="text-sm font-bold text-slate-400">Nenhum log de erro encontrado</h4>
                <p className="text-xs text-slate-600 mt-1">Ajuste os filtros de pesquisa acima.</p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="overflow-x-auto border border-slate-800 rounded-lg">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-950/80 text-slate-400 border-b border-slate-800 font-semibold">
                        <th className="p-3">Data</th>
                        <th className="p-3">Código</th>
                        <th className="p-3">Mensagem</th>
                        <th className="p-3">Status</th>
                        <th className="p-3">Método / Rota</th>
                        <th className="p-3">Request ID</th>
                        <th className="p-3 text-center">Ações</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/70 text-slate-300">
                      {errors.map((err) => (
                        <tr key={err.id} className="hover:bg-slate-900/40 transition-colors">
                          <td className="p-3 whitespace-nowrap text-slate-500">
                            {new Date(err.createdAt).toLocaleString()}
                          </td>
                          <td className="p-3 font-semibold text-red-400 font-mono">{err.errorCode}</td>
                          <td className="p-3 max-w-xs truncate" title={err.message}>
                            {err.message}
                          </td>
                          <td className="p-3 whitespace-nowrap">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              err.statusCode >= 500
                                ? 'bg-red-500/10 text-red-400 border border-red-500/20'
                                : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                            }`}>
                              {err.statusCode}
                            </span>
                          </td>
                          <td className="p-3 whitespace-nowrap">
                            <span className="px-1 py-0.5 rounded bg-slate-800 text-[9px] font-bold mr-1.5 font-mono text-slate-400">{err.method}</span>
                            <span className="font-mono text-slate-400">{err.route}</span>
                          </td>
                          <td className="p-3 font-mono text-[11px] text-slate-400">
                            <button
                              onClick={() => {
                                setSearchRequestId(err.requestId || '');
                                handleTraceSearch();
                              }}
                              className="hover:text-indigo-400 hover:underline text-left cursor-pointer"
                            >
                              {err.requestId ? `${err.requestId.substring(0, 8)}...` : 'N/A'}
                            </button>
                          </td>
                          <td className="p-3 text-center">
                            <button
                              onClick={() => {
                                setSearchRequestId(err.requestId || '');
                                // Simulate submit trace search
                                setTraceLoading(true);
                                setTraceError(null);
                                setTraceData(null);
                                api.get(`/admin/support/request/${err.requestId}`)
                                  .then(res => {
                                    if (res.success) setTraceData(res.data);
                                    else setTraceError(res.error?.message || 'Nenhum trace encontrado.');
                                  })
                                  .catch(() => setTraceError('Erro de rede.'))
                                  .finally(() => setTraceLoading(false));
                              }}
                              className="text-[10px] bg-slate-800 hover:bg-slate-700 hover:text-white px-2 py-1 rounded text-slate-300 border border-slate-700 transition-colors"
                            >
                              Trace
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Pagination */}
                <div className="flex items-center justify-between border-t border-slate-800 pt-4">
                  <span className="text-xs text-slate-500">Página {errorFilters.page}</span>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setErrorFilters(prev => ({ ...prev, page: Math.max(1, prev.page - 1) }))}
                      disabled={errorFilters.page === 1 || errorsLoading}
                      className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 disabled:opacity-40 transition-colors"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setErrorFilters(prev => ({ ...prev, page: prev.page + 1 }))}
                      disabled={errors.length < errorFilters.limit || errorsLoading}
                      className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 disabled:opacity-40 transition-colors"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab: Company Health */}
      {activeTab === 'health' && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-6 animate-fadeIn">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
            <div>
              <h3 className="text-base font-bold text-white">Consola de Integridade de Tenants</h3>
              <p className="text-xs text-slate-400">Verifique status WhatsApp, cota de planos, atestados e ocorrências ativas em tempo real.</p>
            </div>

            {/* Search filter */}
            <form onSubmit={handleHealthSearchSubmit} className="flex gap-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-2 w-3.5 h-3.5 text-slate-500" />
                <input
                  type="text"
                  placeholder="Buscar empresa..."
                  value={healthSearch}
                  onChange={(e) => setHealthSearch(e.target.value)}
                  className="pl-8 pr-3 py-1.5 text-xs bg-slate-950 border border-slate-800 rounded-lg text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500"
                />
              </div>
              <button
                type="submit"
                className="px-3 py-1.5 text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition-colors"
              >
                Buscar
              </button>
            </form>
          </div>

          {healthError ? (
            <div className="p-4 bg-red-950/20 border border-red-800/50 rounded-xl flex items-center gap-3 text-red-400 text-sm">
              <AlertCircle className="w-5 h-5 shrink-0" />
              <span>{healthError}</span>
            </div>
          ) : healthLoading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
              <span className="text-sm text-slate-400 font-medium">Carregando dados das empresas...</span>
            </div>
          ) : companiesHealth.length === 0 ? (
            <div className="text-center py-16 bg-slate-950/20 border border-slate-800/60 rounded-xl">
              <Building2 className="w-8 h-8 text-slate-600 mx-auto mb-3" />
              <h4 className="text-sm font-bold text-slate-400">Nenhuma empresa cadastrada</h4>
              <p className="text-xs text-slate-600 mt-1">Nenhum resultado corresponde à busca.</p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="overflow-x-auto border border-slate-800 rounded-lg">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-950/80 text-slate-400 border-b border-slate-800 font-semibold">
                      <th className="p-3">Empresa</th>
                      <th className="p-3 text-center">Status</th>
                      <th className="p-3">Plano</th>
                      <th className="p-3">WhatsApp</th>
                      <th className="p-3 text-center">Uso de Plano</th>
                      <th className="p-3 text-center">Colaboradores</th>
                      <th className="p-3 text-center">Ocorrências</th>
                      <th className="p-3 text-center">Atestados</th>
                      <th className="p-3 text-center">Check-ins (7d)</th>
                      <th className="p-3">Último Login</th>
                      <th className="p-3">Último Erro</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/70 text-slate-300">
                    {companiesHealth.map((item) => (
                      <tr key={item.companyId} className="hover:bg-slate-900/40 transition-colors">
                        <td className="p-3">
                          <p className="font-semibold text-slate-200">{item.tradeName}</p>
                          {item.legalName && <p className="text-[10px] text-slate-500 truncate max-w-xs">{item.legalName}</p>}
                        </td>
                        <td className="p-3 text-center">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            item.isActive
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                              : 'bg-red-500/10 text-red-400 border border-red-500/20'
                          }`}>
                            {item.isActive ? 'Ativa' : 'Inativa'}
                          </span>
                        </td>
                        <td className="p-3">
                          <p className="font-semibold text-slate-200">{item.plan}</p>
                          <p className="text-[10px] text-slate-500 uppercase">{item.subscriptionStatus}</p>
                        </td>
                        <td className="p-3">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${
                            item.whatsappStatus === 'CONNECTED'
                              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                              : item.whatsappStatus === 'ERROR'
                              ? 'bg-red-500/10 text-red-400 border-red-500/20'
                              : 'bg-slate-800 text-slate-400 border-slate-700'
                          }`}>
                            {item.whatsappStatus}
                          </span>
                        </td>
                        <td className="p-3 text-center">
                          <div className="flex items-center justify-center gap-2">
                            <div className="w-16 bg-slate-950 h-2 rounded-full overflow-hidden border border-slate-800">
                              <div
                                className={`h-full rounded-full ${
                                  item.planUsagePercent >= 90
                                    ? 'bg-red-500'
                                    : item.planUsagePercent >= 75
                                    ? 'bg-amber-500'
                                    : 'bg-indigo-500'
                                }`}
                                style={{ width: `${item.planUsagePercent}%` }}
                              ></div>
                            </div>
                            <span className="font-bold">{item.planUsagePercent.toFixed(0)}%</span>
                          </div>
                        </td>
                        <td className="p-3 text-center font-semibold">{item.activeEmployees}</td>
                        <td className="p-3 text-center font-semibold">
                          <span className={item.openOccurrences > 0 ? 'text-amber-400' : 'text-slate-400'}>
                            {item.openOccurrences}
                          </span>
                        </td>
                        <td className="p-3 text-center font-semibold">
                          <span className={item.pendingMedicalCertificates > 0 ? 'text-indigo-400' : 'text-slate-400'}>
                            {item.pendingMedicalCertificates}
                          </span>
                        </td>
                        <td className="p-3 text-center font-semibold text-slate-400">{item.checkinsLast7Days}</td>
                        <td className="p-3 text-slate-400 text-[11px] whitespace-nowrap">
                          {item.lastLoginAt ? new Date(item.lastLoginAt).toLocaleString() : 'Nunca'}
                        </td>
                        <td className="p-3 text-[11px] whitespace-nowrap">
                          {item.lastErrorAt ? (
                            <span className="text-red-400 font-semibold">{new Date(item.lastErrorAt).toLocaleString()}</span>
                          ) : (
                            <span className="text-slate-500">Nenhum</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              <div className="flex items-center justify-between border-t border-slate-800 pt-4">
                <span className="text-xs text-slate-500">Página {healthPage}</span>
                <div className="flex gap-2">
                  <button
                    onClick={() => setHealthPage(prev => Math.max(1, prev - 1))}
                    disabled={healthPage === 1 || healthLoading}
                    className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 disabled:opacity-40 transition-colors"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setHealthPage(prev => prev + 1)}
                    disabled={companiesHealth.length < healthLimit || healthLoading}
                    className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 disabled:opacity-40 transition-colors"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Metadata Detail Modal */}
      {selectedTraceItem && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-xl w-full max-w-4xl max-h-[85vh] flex flex-col shadow-2xl">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
              <div className="space-y-1">
                <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                  <span className="text-red-400 font-mono">{selectedTraceItem.errorCode}</span>
                  <span className="text-slate-500">|</span>
                  <span>Detalhes do Erro</span>
                </h3>
                <p className="text-xs text-slate-500 font-mono truncate max-w-md">ID: {selectedTraceItem.requestId || 'N/A'}</p>
              </div>
              <button
                onClick={() => setSelectedTraceItem(null)}
                className="text-slate-400 hover:text-slate-200 text-sm font-semibold transition-colors"
              >
                Fechar
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-5 flex-1">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 bg-slate-950 p-4 border border-slate-800 rounded-lg text-xs">
                <div>
                  <p className="text-[10px] font-semibold text-slate-500 uppercase">Status HTTP</p>
                  <p className="text-slate-200 mt-1 font-bold">{selectedTraceItem.statusCode}</p>
                </div>
                <div>
                  <p className="text-[10px] font-semibold text-slate-500 uppercase">Método</p>
                  <p className="text-slate-200 mt-1 font-mono font-bold">{selectedTraceItem.method}</p>
                </div>
                <div>
                  <p className="text-[10px] font-semibold text-slate-500 uppercase">Rota / Endpoint</p>
                  <p className="text-slate-200 mt-1 font-mono">{selectedTraceItem.route}</p>
                </div>
                <div>
                  <p className="text-[10px] font-semibold text-slate-500 uppercase">Tenant ID (Company)</p>
                  <p className="text-slate-200 mt-1 font-mono">{selectedTraceItem.companyId || 'N/A'}</p>
                </div>
              </div>

              <div className="space-y-1">
                <p className="text-[10px] font-semibold text-slate-400 uppercase">Mensagem de Erro</p>
                <p className="text-xs text-slate-200 font-mono bg-slate-950 p-3 border border-slate-800 rounded-lg">{selectedTraceItem.message}</p>
              </div>

              {selectedTraceItem.metadata && (
                <div className="space-y-2">
                  <p className="text-[10px] font-semibold text-slate-400 uppercase">Metadata Sanitizada</p>
                  <pre className="text-xs text-indigo-300 font-mono bg-slate-950 p-4 border border-slate-800 rounded-lg overflow-x-auto max-h-96">
                    {JSON.stringify(selectedTraceItem.metadata, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
