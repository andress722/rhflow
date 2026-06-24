'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import {
  Heart,
  TrendingUp,
  AlertTriangle,
  CheckCircle,
  HelpCircle,
  FileText,
  MessageSquare,
  Users,
  Activity,
  Calendar,
  Clock,
  ArrowRight,
  ShieldAlert,
  RefreshCw,
  Zap,
  Info
} from 'lucide-react';

export default function CustomerSuccessPage() {
  const [healthData, setHealthData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [requestId, setRequestId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const fetchHealthData = async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError(null);
    setRequestId(null);
    try {
      const response = await api.get('/customer-success/health') as any;
      if (response && response.success) {
        setHealthData(response);
      } else {
        setError(response?.error?.message || 'Erro ao carregar os dados de saúde.');
        setRequestId(response?.error?.requestId || null);
      }
    } catch (err) {
      setError('Erro de conexão ao carregar dados do sucesso do cliente.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchHealthData();
  }, []);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'HEALTHY':
        return {
          bg: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400',
          indicator: 'bg-emerald-500',
          text: 'Saudável',
          desc: 'A operação do piloto está ativa, com boa taxa de engajamento e sem riscos operacionais críticos.'
        };
      case 'ATTENTION':
        return {
          bg: 'bg-amber-500/10 border-amber-500/20 text-amber-400',
          indicator: 'bg-amber-500',
          text: 'Atenção',
          desc: 'Existem pontos de atenção que necessitam de intervenção para garantir a integridade da operação.'
        };
      case 'CRITICAL':
        return {
          bg: 'bg-red-500/10 border-red-500/20 text-red-400',
          indicator: 'bg-red-500',
          text: 'Crítico',
          desc: 'A operação piloto possui bloqueios severos ou baixíssima adoção que impedem o sucesso da implantação.'
        };
      default:
        return {
          bg: 'bg-slate-800 border-slate-700 text-slate-400',
          indicator: 'bg-slate-400',
          text: 'Pendente',
          desc: 'Calculando status operacional.'
        };
    }
  };

  const getRiskSeverityStyles = (severity: string) => {
    switch (severity) {
      case 'HIGH':
        return 'bg-red-500/10 text-red-400 border border-red-500/20';
      case 'MEDIUM':
        return 'bg-amber-500/10 text-amber-400 border border-amber-500/20';
      default:
        return 'bg-blue-500/10 text-blue-400 border border-blue-500/20';
    }
  };

  const getRecPriorityStyles = (priority: string) => {
    switch (priority) {
      case 'HIGH':
        return 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20';
      case 'MEDIUM':
        return 'bg-slate-800 text-slate-300 border border-slate-700';
      default:
        return 'bg-slate-900 text-slate-400 border border-slate-800';
    }
  };

  if (loading) {
    return (
      <div className="py-16 flex flex-col items-center justify-center gap-3">
        <RefreshCw className="w-8 h-8 text-indigo-500 animate-spin" />
        <span className="text-slate-400 text-sm font-semibold">Carregando telemetria de sucesso do cliente...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="py-12 text-center text-red-455 max-w-md mx-auto space-y-4">
        <ShieldAlert className="w-12 h-12 text-red-500 mx-auto" />
        <p className="text-sm font-semibold">{error}</p>
        {requestId && <p className="text-[10px] text-slate-500 font-mono">ID do erro: {requestId}</p>}
        <button
          onClick={() => fetchHealthData()}
          className="px-4 py-2 text-xs font-semibold rounded bg-slate-800 text-slate-300 hover:text-white transition-all cursor-pointer border border-slate-700"
        >
          Tentar Novamente
        </button>
      </div>
    );
  }

  if (!healthData) {
    return (
      <div className="text-center py-16">
        <Info className="w-10 h-10 text-slate-600 mx-auto mb-3" />
        <h3 className="text-white font-bold text-lg">Sem informações</h3>
        <p className="text-slate-400 text-sm">Não foi possível calcular o Health Score do piloto.</p>
      </div>
    );
  }

  const { healthScore, status, periodStart, periodEnd, isOnboardingIncomplete, adoptionMetrics, operationalMetrics, riskSignals, recommendations } = healthData;
  const statusInfo = getStatusColor(status);

  return (
    <div className="space-y-8 max-w-6xl mx-auto pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Heart className="w-6 h-6 text-red-500 fill-current" />
            <span>Sucesso do Cliente Piloto</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1 max-w-2xl leading-relaxed">
            Painel consolidado de saúde da operação, taxas de engajamento dos colaboradores, riscos técnicos e guias de correção rápida.
          </p>
        </div>
        <button
          onClick={() => fetchHealthData(true)}
          disabled={refreshing}
          className="flex items-center gap-2 px-3.5 py-1.5 text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg transition-colors cursor-pointer disabled:cursor-not-allowed"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
          <span>{refreshing ? 'Atualizando...' : 'Atualizar'}</span>
        </button>
      </div>

      {/* Main Score & Status Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl relative overflow-hidden">
        {/* Radial Score Gauge */}
        <div className="flex flex-col items-center justify-center text-center p-4 border-b lg:border-b-0 lg:border-r border-slate-800">
          <div className="relative w-28 h-28 flex items-center justify-center">
            {/* Outer Circular Track */}
            <svg className="absolute w-full h-full transform -rotate-90">
              <circle
                cx="56"
                cy="56"
                r="48"
                className="stroke-slate-850"
                strokeWidth="8"
                fill="transparent"
              />
              <circle
                cx="56"
                cy="56"
                r="48"
                className={`transition-all duration-500 ${
                  status === 'HEALTHY'
                    ? 'stroke-emerald-500'
                    : status === 'ATTENTION'
                    ? 'stroke-amber-500'
                    : 'stroke-red-500'
                }`}
                strokeWidth="8"
                fill="transparent"
                strokeDasharray={2 * Math.PI * 48}
                strokeDashoffset={2 * Math.PI * 48 * (1 - healthScore / 100)}
              />
            </svg>
            <div className="flex flex-col items-center justify-center">
              <span className="text-3xl font-extrabold text-white">{healthScore}</span>
              <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Health Score</span>
            </div>
          </div>

          <div className="mt-4 space-y-1">
            <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold ${statusInfo.bg}`}>
              <span className={`w-2 h-2 rounded-full ${statusInfo.indicator}`} />
              {statusInfo.text}
            </span>
          </div>
        </div>

        {/* Status Explanation */}
        <div className="lg:col-span-2 flex flex-col justify-between p-4 space-y-4">
          <div className="space-y-2">
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Status da Operação</h3>
            <p className="text-sm font-semibold text-slate-200">{statusInfo.desc}</p>
            {isOnboardingIncomplete && (
              <div className="p-3 bg-indigo-950/20 border border-indigo-900/30 text-indigo-400 rounded-lg text-xs leading-relaxed flex gap-2 items-start mt-2">
                <Info className="w-4 h-4 shrink-0 mt-0.5" />
                <span>
                  <strong>Setup Inicial Incompleto</strong>: O onboarding técnico básico da empresa ainda possui etapas pendentes de configuração. Aconselhamos concluir todas as configurações.
                </span>
              </div>
            )}
          </div>

          <div className="pt-3 border-t border-slate-850 flex items-center justify-between text-xs text-slate-500">
            <span>Período analisado:</span>
            <span className="font-semibold text-slate-400">
              {new Date(periodStart).toLocaleDateString()} a {new Date(periodEnd).toLocaleDateString()}
            </span>
          </div>
        </div>
      </div>

      {/* Metrics Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Adoption Metrics */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
          <h3 className="text-sm font-bold text-white flex items-center gap-2 border-b border-slate-800 pb-2">
            <TrendingUp className="w-4 h-4 text-indigo-400" />
            <span>Métricas de Adoção e Engajamento</span>
          </h3>

          <div className="grid grid-cols-2 gap-4">
            <div className="p-3 bg-slate-950/40 border border-slate-850 rounded-lg">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Colaboradores Ativos</span>
              <span className="text-lg font-bold text-white">{adoptionMetrics.activeEmployees}</span>
            </div>

            <div className="p-3 bg-slate-950/40 border border-slate-850 rounded-lg">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Taxa de Resposta (7d)</span>
              <span className="text-lg font-bold text-white">{adoptionMetrics.responseRate7d}%</span>
            </div>

            <div className="p-3 bg-slate-950/40 border border-slate-850 rounded-lg">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Check-ins Disparados (7d)</span>
              <span className="text-lg font-bold text-white">{adoptionMetrics.remoteCheckinsSent7d}</span>
            </div>

            <div className="p-3 bg-slate-950/40 border border-slate-850 rounded-lg">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Check-ins Respondidos (7d)</span>
              <span className="text-lg font-bold text-white">{adoptionMetrics.remoteCheckinsResponded7d}</span>
            </div>

            <div className="p-3 bg-slate-950/40 border border-slate-850 rounded-lg">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Relatórios Vistos/Exportados (7d)</span>
              <span className="text-lg font-bold text-white">{adoptionMetrics.reportsViewedOrExported7d}</span>
            </div>

            <div className="p-3 bg-slate-950/40 border border-slate-850 rounded-lg">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Última Atividade</span>
              <span className="text-[11px] font-semibold text-slate-300 block truncate">
                {adoptionMetrics.lastActivityAt
                  ? new Date(adoptionMetrics.lastActivityAt).toLocaleString()
                  : 'Sem registro'}
              </span>
            </div>
          </div>
        </div>

        {/* Operational Metrics */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
          <h3 className="text-sm font-bold text-white flex items-center gap-2 border-b border-slate-800 pb-2">
            <Activity className="w-4 h-4 text-emerald-450" />
            <span>Métricas Operacionais</span>
          </h3>

          <div className="grid grid-cols-2 gap-4">
            <div className="p-3 bg-slate-950/40 border border-slate-850 rounded-lg">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Ocorrências Abertas</span>
              <span className="text-lg font-bold text-white">{operationalMetrics.openOccurrences}</span>
            </div>

            <div className="p-3 bg-slate-950/40 border border-slate-850 rounded-lg">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Ocorrências Criadas (7d)</span>
              <span className="text-lg font-bold text-white">{operationalMetrics.occurrencesCreated7d}</span>
            </div>

            <div className="p-3 bg-slate-950/40 border border-slate-850 rounded-lg">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Ocorrências Resolvidas (7d)</span>
              <span className="text-lg font-bold text-white">{operationalMetrics.occurrencesResolved7d}</span>
            </div>

            <div className="p-3 bg-slate-950/40 border border-slate-850 rounded-lg">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Atestados Enviados (7d)</span>
              <span className="text-lg font-bold text-white">{operationalMetrics.medicalCertificatesUploaded7d}</span>
            </div>

            <div className="p-3 bg-slate-950/40 border border-slate-850 rounded-lg">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Atestados Revisados (7d)</span>
              <span className="text-lg font-bold text-white">{operationalMetrics.medicalCertificatesReviewed7d}</span>
            </div>

            <div className="p-3 bg-slate-950/40 border border-slate-850 rounded-lg">
              <span className="text-[10px] font-bold text-slate-550 uppercase tracking-wider block">Erros Operacionais / WhatsApp</span>
              <span className="text-xs font-semibold text-red-400 block mt-1">
                WhatsApp: {operationalMetrics.whatsappErrors7d} | Sistema: {operationalMetrics.operationalErrors7d}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Risks and Recommendations */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Risk Signals */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
          <h3 className="text-sm font-bold text-white flex items-center gap-2 border-b border-slate-800 pb-2">
            <AlertTriangle className="w-4 h-4 text-amber-500" />
            <span>Sinais de Risco Operacional ({riskSignals.length})</span>
          </h3>

          {riskSignals.length === 0 ? (
            <div className="py-8 text-center text-slate-550 flex flex-col items-center justify-center gap-2">
              <CheckCircle className="w-8 h-8 text-emerald-500" />
              <p className="text-xs font-semibold">Nenhum sinal de risco detectado no piloto.</p>
            </div>
          ) : (
            <div className="space-y-3 max-h-[350px] overflow-y-auto pr-1">
              {riskSignals.map((risk: any, index: number) => (
                <div key={index} className="p-3.5 bg-slate-950/60 border border-slate-850 rounded-lg flex flex-col md:flex-row md:items-center justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-0.5 rounded text-[8px] font-extrabold uppercase ${getRiskSeverityStyles(risk.severity)}`}>
                        {risk.severity}
                      </span>
                      <h4 className="font-bold text-xs text-white">{risk.title}</h4>
                    </div>
                    <p className="text-slate-400 text-[11px] leading-relaxed">{risk.description}</p>
                  </div>
                  <Link
                    href={risk.actionUrl}
                    className="self-start md:self-auto shrink-0 inline-flex items-center gap-1 text-[10px] font-bold text-indigo-400 hover:text-indigo-350"
                  >
                    <span>Resolver</span>
                    <ArrowRight className="w-3 h-3" />
                  </Link>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recommendations */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
          <h3 className="text-sm font-bold text-white flex items-center gap-2 border-b border-slate-800 pb-2">
            <Zap className="w-4 h-4 text-indigo-400" />
            <span>Ações Recomendadas ({recommendations.length})</span>
          </h3>

          {recommendations.length === 0 ? (
            <div className="py-8 text-center text-slate-550 flex flex-col items-center justify-center gap-2">
              <CheckCircle className="w-8 h-8 text-emerald-500" />
              <p className="text-xs font-semibold">Tudo configurado! Cliente operacional.</p>
            </div>
          ) : (
            <div className="space-y-3 max-h-[350px] overflow-y-auto pr-1">
              {recommendations.map((rec: any, index: number) => (
                <div key={index} className="p-3.5 bg-slate-950/60 border border-slate-850 rounded-lg flex flex-col md:flex-row md:items-center justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-0.5 rounded text-[8px] font-extrabold uppercase ${getRecPriorityStyles(rec.priority)}`}>
                        Prioridade: {rec.priority}
                      </span>
                      <h4 className="font-bold text-xs text-white">{rec.title}</h4>
                    </div>
                    <p className="text-slate-400 text-[11px] leading-relaxed">{rec.description}</p>
                  </div>
                  <Link
                    href={rec.actionUrl}
                    className="self-start md:self-auto shrink-0 inline-flex items-center gap-1 text-[10px] font-bold text-indigo-400 hover:text-indigo-350"
                  >
                    <span>Configurar</span>
                    <ArrowRight className="w-3 h-3" />
                  </Link>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
