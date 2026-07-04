'use client';

import React, { useEffect, useState, Suspense } from 'react';
import { api } from '@/lib/api';
import {
  TrendingUp,
  Users,
  Activity,
  Award,
  BookOpen,
  Search,
  FileSpreadsheet,
  FileText,
  AlertTriangle,
  Clock,
  Sparkles,
  RefreshCw,
  Eye,
  Rocket
} from 'lucide-react';

function AdminAnalyticsContent() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAnalytics = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get('/admin/analytics/overview');
      if (res.success) {
        setData(res.data);
      } else {
        setError(res.error?.message || 'Erro ao buscar dados de telemetria.');
      }
    } catch (e) {
      setError('Erro de rede ao carregar analytics.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
  }, []);

  if (loading) {
    return (
      <div className="p-6 text-center text-slate-400 bg-slate-950 min-h-screen flex flex-col justify-center items-center gap-3">
        <div className="w-8 h-8 border-4 border-indigo-650 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-xs">Buscando consolidados de telemetria...</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-6 text-center text-red-400 bg-slate-950 min-h-screen flex flex-col justify-center items-center gap-3">
        <AlertTriangle className="w-8 h-8 text-red-500" />
        <p className="text-xs">{error || 'Erro ao carregar.'}</p>
        <button onClick={fetchAnalytics} className="px-4 py-2 bg-slate-900 border border-slate-800 text-white rounded text-xs font-semibold">Tentar Novamente</button>
      </div>
    );
  }

  const { activeUsers, featureAdoption, topPages, funnel, topArticles } = data;

  const steps = [
    { label: 'Empresas Ativas', value: funnel.totalCompanies, max: funnel.totalCompanies },
    { label: 'Configurações Salvas', value: funnel.settingsConfigured, max: funnel.totalCompanies },
    { label: 'Colaboradores Importados', value: funnel.employeesImported, max: funnel.totalCompanies },
    { label: 'Jornadas Criadas', value: funnel.schedulesConfigured, max: funnel.totalCompanies }
  ];

  return (
    <div className="p-6 space-y-6 text-slate-100 bg-slate-950 min-h-screen">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            <TrendingUp className="w-6 h-6 text-indigo-500" />
            Product Analytics & Telemetria
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            Métricas de engajamento do piloto, funil de ativação de empresas e adoção do cliente final.
          </p>
        </div>
        <button
          onClick={fetchAnalytics}
          className="inline-flex items-center gap-2 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 rounded-lg text-sm font-semibold transition-all cursor-pointer"
        >
          <RefreshCw className="w-4 h-4 text-indigo-400" />
          Atualizar Dados
        </button>
      </div>

      {/* active users cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-slate-900 border border-slate-850 p-4 rounded-xl flex items-center gap-3">
          <div className="p-2.5 bg-indigo-950/40 text-indigo-400 rounded-lg">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] text-slate-500 font-semibold block uppercase">Usuários Ativos (24h)</span>
            <span className="text-xl font-extrabold text-white">{activeUsers.dau}</span>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-850 p-4 rounded-xl flex items-center gap-3">
          <div className="p-2.5 bg-indigo-950/40 text-indigo-400 rounded-lg">
            <Activity className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] text-slate-500 font-semibold block uppercase">Usuários Ativos (30d)</span>
            <span className="text-xl font-extrabold text-white">{activeUsers.mau}</span>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-850 p-4 rounded-xl flex items-center gap-3">
          <div className="p-2.5 bg-emerald-950/40 text-emerald-450 rounded-lg">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] text-slate-500 font-semibold block uppercase">Engajamento (DAU/MAU)</span>
            <span className="text-xl font-extrabold text-white">
              {activeUsers.mau > 0 ? `${Math.round((activeUsers.dau / activeUsers.mau) * 100)}%` : '0%'}
            </span>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-850 p-4 rounded-xl flex items-center gap-3">
          <div className="p-2.5 bg-indigo-950/40 text-indigo-400 rounded-lg">
            <Rocket className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] text-slate-500 font-semibold block uppercase">Total Empresas</span>
            <span className="text-xl font-extrabold text-white">{funnel.totalCompanies}</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Onboarding Conversion Funnel */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-lg">
          <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2 uppercase tracking-wider">
            Funil de Ativação Onboarding (Empresas)
          </h3>
          <div className="space-y-4">
            {steps.map((step, idx) => {
              const pct = step.max > 0 ? Math.round((step.value / step.max) * 100) : 0;
              return (
                <div key={idx} className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-400 font-medium">{step.label}</span>
                    <span className="font-semibold text-white">{step.value} / {step.max} ({pct}%)</span>
                  </div>
                  <div className="w-full bg-slate-950 rounded-full h-2.5 overflow-hidden border border-slate-850">
                    <div
                      className="bg-indigo-500 h-full rounded-full transition-all duration-300"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Feature Adoption Stats */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-lg">
          <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2 uppercase tracking-wider">
            Adoção por Funcionalidade (Ações)
          </h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-slate-950 border border-slate-850 p-4 rounded-xl text-center space-y-1">
              <span className="text-slate-500 text-[10px] font-bold uppercase">Check-ins Disparados</span>
              <span className="text-lg font-extrabold text-white block">{featureAdoption.checkinCount}</span>
            </div>
            <div className="bg-slate-950 border border-slate-850 p-4 rounded-xl text-center space-y-1">
              <span className="text-slate-500 text-[10px] font-bold uppercase">Atestados Validados</span>
              <span className="text-lg font-extrabold text-white block">{featureAdoption.certificateCount}</span>
            </div>
            <div className="bg-slate-950 border border-slate-850 p-4 rounded-xl text-center space-y-1">
              <span className="text-slate-500 text-[10px] font-bold uppercase">Ocorrências Resolvidas</span>
              <span className="text-lg font-extrabold text-white block">{featureAdoption.occurrencesResolved}</span>
            </div>
            <div className="bg-slate-950 border border-slate-850 p-4 rounded-xl text-center space-y-1">
              <span className="text-slate-500 text-[10px] font-bold uppercase">Relatórios Exportados</span>
              <span className="text-lg font-extrabold text-white block">{featureAdoption.reportExportsEvents}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Most Accessed Screens */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-lg">
          <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2 uppercase tracking-wider">
            Telas Mais Acessadas (PAGE_VIEW)
          </h3>
          {topPages.length === 0 ? (
            <p className="text-xs text-slate-500 italic py-6">Nenhum tráfego de visualizações capturado.</p>
          ) : (
            <div className="divide-y divide-slate-805/65">
              {topPages.map((page: any, idx: number) => (
                <div key={idx} className="flex justify-between items-center py-2.5 text-xs">
                  <span className="font-mono text-slate-350">{page.path}</span>
                  <span className="font-semibold text-white bg-slate-950 border border-slate-850 px-2 py-0.5 rounded font-mono text-[11px]">
                    {page.count} visualizações
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Knowledge Base Usage */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-lg">
          <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2 uppercase tracking-wider">
            Tutoriais Mais Lidos (Help Center)
          </h3>
          {topArticles.length === 0 ? (
            <p className="text-xs text-slate-500 italic py-6">Nenhum artigo lido na central de ajuda.</p>
          ) : (
            <div className="divide-y divide-slate-805/65">
              {topArticles.map((art: any, idx: number) => (
                <div key={idx} className="flex justify-between items-center py-2.5 text-xs">
                  <span className="text-slate-350">{art.title}</span>
                  <span className="font-semibold text-emerald-450 bg-slate-950 border border-slate-850 px-2 py-0.5 rounded font-mono text-[11px]">
                    {art.count} leituras
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function AdminAnalyticsPage() {
  return (
    <Suspense fallback={
      <div className="p-6 text-center text-slate-400 bg-slate-950 min-h-screen">
        Carregando painel de telemetria...
      </div>
    }>
      <AdminAnalyticsContent />
    </Suspense>
  );
}
