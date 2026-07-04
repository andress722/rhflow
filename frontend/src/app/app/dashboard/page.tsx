'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  FileText,
  UserX,
  TrendingUp,
  Activity,
  ArrowRight,
  XCircle,
} from 'lucide-react';
import { api } from '@/lib/api';
import { OfflineAlert } from '@/components/OfflineAlert';

export default function DashboardPage() {
  const router = useRouter();
  const [summary, setSummary] = useState({
    openOccurrences: 0,
    absencesToday: 0,
    lateArrivalsToday: 0,
    missedClockInsToday: 0,
    medicalCertificatesUnderReview: 0,
  });
  const [certSummary, setCertSummary] = useState({
    underReview: 0,
    activeAbsences: 0,
    approvedToday: 0,
    rejectedToday: 0,
  });
  const [presenceSummary, setPresenceSummary] = useState({
    pending: 0,
    confirmed: 0,
    late: 0,
    absences: 0,
    issues: 0,
    notResponded: 0,
    sentToday: 0,
    responseRate: 0,
    notRespondedOverdue: 0,
  });
  const [recentOccurrences, setRecentOccurrences] = useState<any[]>([]);
  const [pendenciesCount, setPendenciesCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [hasNetworkError, setHasNetworkError] = useState(false);

  const [liveEvents, setLiveEvents] = useState<any[]>([]);

  useEffect(() => {
    fetchData();

    // SSE EventSource for real-time presence feed
    const token = localStorage.getItem('token');
    if (!token) return;

    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';
    const eventSource = new EventSource(`${apiUrl}/presence/live-feed?token=${token}`);

    eventSource.onmessage = (event) => {
      try {
        const checkin = JSON.parse(event.data);
        setLiveEvents((prev) => [checkin, ...prev.slice(0, 19)]);
        
        // Update presence stats dynamically
        setPresenceSummary((prev) => ({
          ...prev,
          confirmed: checkin.status === 'CONFIRMED' ? prev.confirmed + 1 : prev.confirmed,
          pending: checkin.status === 'PENDING' ? prev.pending + 1 : (prev.pending > 0 ? prev.pending - 1 : 0),
        }));
      } catch (err) {
        // Heartbeat or malformed msg
      }
    };

    return () => {
      eventSource.close();
    };
  }, []);

  const fetchData = async () => {
    setIsLoading(true);
    setHasNetworkError(false);
    try {
      // Fetch stats summary
      const sumRes = await api.get('/occurrences/summary');
      if (sumRes.error?.code === 'NETWORK_ERROR') {
        setHasNetworkError(true);
        setIsLoading(false);
        return;
      }
      if (sumRes.success && sumRes.data) {
        setSummary(sumRes.data);
      }

      // Fetch medical certificates summary
      const certRes = await api.get('/medical-certificates/summary');
      if (certRes.success && certRes.data) {
        setCertSummary(certRes.data);
      }

      // Fetch presence summary
      const presenceRes = await api.get('/presence/summary');
      if (presenceRes.success && presenceRes.data) {
        setPresenceSummary(presenceRes.data);
      }

      // Fetch occurrences to show the latest ones
      const occRes = await api.get('/occurrences');
      if (occRes.success && occRes.data) {
        // Take latest 5 occurrences
        setRecentOccurrences(occRes.data.slice(0, 5));
      }

      // Fetch closing pendencies count
      const pendRes = await api.get('/reports/closing-pendencies');
      if (pendRes.success && pendRes.data && pendRes.data.summary) {
        setPendenciesCount(pendRes.data.summary.total);
      }
    } catch (err) {
      console.error('Error fetching dashboard data:', err);
      setHasNetworkError(true);
    } finally {
      setIsLoading(false);
    }
  };

  const cards = [
    {
      label: 'Ocorrências Abertas',
      value: summary.openOccurrences.toString(),
      change: 'Pendentes de resolução',
      icon: AlertCircle,
      color: 'text-rose-500',
      bgColor: 'bg-rose-500/10',
      borderColor: 'border-rose-500/20',
    },
    {
      label: 'Faltas Hoje',
      value: summary.absencesToday.toString(),
      change: 'Ausências reportadas hoje',
      icon: UserX,
      color: 'text-amber-500',
      bgColor: 'bg-amber-500/10',
      borderColor: 'border-amber-500/20',
    },
    {
      label: 'Atrasos Hoje',
      value: summary.lateArrivalsToday.toString(),
      change: 'Entradas tardias registradas',
      icon: Clock,
      color: 'text-indigo-500',
      bgColor: 'bg-indigo-500/10',
      borderColor: 'border-indigo-500/20',
    },
    {
      label: 'Sem Ponto Hoje',
      value: summary.missedClockInsToday.toString(),
      change: 'Entradas sem batida registrada',
      icon: AlertCircle,
      color: 'text-violet-500',
      bgColor: 'bg-violet-500/10',
      borderColor: 'border-violet-500/20',
    },
  ];

  const medicalCards = [
    {
      label: 'Atestados em Análise',
      value: certSummary.underReview.toString(),
      change: 'Aguardando revisão do RH',
      icon: FileText,
      color: 'text-indigo-400',
      bgColor: 'bg-indigo-500/10',
      borderColor: 'border-indigo-500/20',
    },
    {
      label: 'Afastamentos Ativos',
      value: certSummary.activeAbsences.toString(),
      change: 'Afastamentos em andamento',
      icon: TrendingUp,
      color: 'text-emerald-400',
      bgColor: 'bg-emerald-500/10',
      borderColor: 'border-emerald-500/20',
    },
    {
      label: 'Aprovados Hoje',
      value: certSummary.approvedToday.toString(),
      change: 'Atestados homologados hoje',
      icon: CheckCircle2,
      color: 'text-teal-400',
      bgColor: 'bg-teal-500/10',
      borderColor: 'border-teal-500/20',
    },
    {
      label: 'Rejeitados Hoje',
      value: certSummary.rejectedToday.toString(),
      change: 'Atestados recusados hoje',
      icon: XCircle,
      color: 'text-rose-400',
      bgColor: 'bg-rose-500/10',
      borderColor: 'border-rose-500/20',
    },
  ];

  const presenceCards = [
    {
      label: 'Check-ins enviados hoje',
      value: presenceSummary.sentToday !== undefined ? presenceSummary.sentToday.toString() : '0',
      change: 'Total de disparos efetuados',
      icon: Activity,
      color: 'text-indigo-400',
      bgColor: 'bg-indigo-500/10',
      borderColor: 'border-indigo-500/20',
    },
    {
      label: 'Taxa de resposta',
      value: presenceSummary.responseRate !== undefined ? `${presenceSummary.responseRate}%` : '0%',
      change: 'Percentual de check-ins respondidos',
      icon: TrendingUp,
      color: 'text-emerald-400',
      bgColor: 'bg-emerald-500/10',
      borderColor: 'border-emerald-500/20',
    },
    {
      label: 'Pendentes vencidos',
      value: presenceSummary.notRespondedOverdue !== undefined ? presenceSummary.notRespondedOverdue.toString() : '0',
      change: 'Aguardando tempo limite / Sem Resposta',
      icon: AlertCircle,
      color: 'text-rose-400',
      bgColor: 'bg-rose-500/10',
      borderColor: 'border-rose-500/20',
    },
  ];

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'OPEN':
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-slate-800 text-slate-350 border border-slate-700">Aberta</span>;
      case 'WAITING_EMPLOYEE':
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">Aguardando Func.</span>;
      case 'WAITING_HR':
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500/10 text-rose-400 border border-rose-500/20">Aguardando RH</span>;
      case 'RESOLVED':
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">Resolvida</span>;
      default:
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-slate-800 text-slate-400 border border-slate-700">{status}</span>;
    }
  };

  const getTypeLabel = (type: string) => {
    const types: Record<string, string> = {
      ABSENCE: 'Falta',
      LATE_ARRIVAL: 'Atraso',
      REMOTE_TECHNICAL_ISSUE: 'Prob. Técnico',
      MISSED_CLOCK_IN: 'Sem Ponto',
      MEDICAL_CERTIFICATE: 'Atestado',
    };
    return types[type] || type;
  };

  return (
    <>
      {/* Title */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white">Dashboard Operacional</h1>
          <p className="text-slate-400 text-sm mt-1">
            Métricas de presença de hoje em tempo real integradas com WhatsApp.
          </p>
        </div>
        <button
          onClick={fetchData}
          className="px-3.5 py-1.5 rounded-lg border border-slate-800 hover:border-slate-700 bg-slate-900 text-slate-300 hover:text-white transition-all text-xs font-semibold"
        >
          Atualizar Dados
        </button>
      </div>

      {hasNetworkError ? (
        <div className="py-12">
          <OfflineAlert onRetry={fetchData} />
        </div>
      ) : isLoading ? (
        <div className="py-32 flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
          <span className="text-sm text-slate-400 font-medium">Carregando métricas...</span>
        </div>
      ) : (
        <>
          {/* Stats Cards */}
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {cards.map((stat) => {
                const Icon = stat.icon;
                return (
                  <div
                    key={stat.label}
                    className={`p-6 rounded-xl bg-slate-900 border ${stat.borderColor} shadow-lg flex items-start justify-between`}
                  >
                    <div className="space-y-2">
                      <p className="text-sm font-medium text-slate-400">{stat.label}</p>
                      <p className="text-4xl font-extrabold text-white tracking-tight">{stat.value}</p>
                      <p className="text-xs text-slate-500 flex items-center gap-1 font-sans">
                        {stat.change}
                      </p>
                    </div>
                    <div className={`p-3 rounded-lg ${stat.bgColor}`}>
                      <Icon className={`w-5 h-5 ${stat.color}`} />
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {medicalCards.map((stat) => {
                const Icon = stat.icon;
                return (
                  <div
                    key={stat.label}
                    className={`p-6 rounded-xl bg-slate-900 border ${stat.borderColor} shadow-lg flex items-start justify-between`}
                  >
                    <div className="space-y-2">
                      <p className="text-sm font-medium text-slate-400">{stat.label}</p>
                      <p className="text-4xl font-extrabold text-white tracking-tight">{stat.value}</p>
                      <p className="text-xs text-slate-500 flex items-center gap-1 font-sans">
                        {stat.change}
                      </p>
                    </div>
                    <div className={`p-3 rounded-lg ${stat.bgColor}`}>
                      <Icon className={`w-5 h-5 ${stat.color}`} />
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {presenceCards.map((stat) => {
                const Icon = stat.icon;
                return (
                  <div
                    key={stat.label}
                    className={`p-6 rounded-xl bg-slate-900 border ${stat.borderColor} shadow-lg flex items-start justify-between`}
                  >
                    <div className="space-y-2">
                      <p className="text-sm font-medium text-slate-400">{stat.label}</p>
                      <p className="text-4xl font-extrabold text-white tracking-tight">{stat.value}</p>
                      <p className="text-xs text-slate-500 flex items-center gap-1 font-sans">
                        {stat.change}
                      </p>
                    </div>
                    <div className={`p-3 rounded-lg ${stat.bgColor}`}>
                      <Icon className={`w-5 h-5 ${stat.color}`} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Dashboards - Native SVG Charts */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Donut Chart - Check-in Response Rate */}
            <div className="p-6 rounded-xl border border-slate-800 bg-slate-900 shadow-lg flex flex-col items-center text-center space-y-4">
              <h3 className="text-sm font-bold text-slate-350 w-full text-left uppercase tracking-wider text-[10px]">Taxa de Resposta (Check-in)</h3>
              <div className="relative w-36 h-36 flex items-center justify-center">
                <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                  {/* Track circle */}
                  <circle
                    cx="50"
                    cy="50"
                    r="40"
                    className="text-slate-800"
                    strokeWidth="8"
                    stroke="currentColor"
                    fill="transparent"
                  />
                  {/* Progress circle */}
                  <circle
                    cx="50"
                    cy="50"
                    r="40"
                    className="text-emerald-500 transition-all duration-500 ease-in-out"
                    strokeWidth="8"
                    strokeDasharray={`${2 * Math.PI * 40}`}
                    strokeDashoffset={`${2 * Math.PI * 40 * (1 - presenceSummary.responseRate / 100)}`}
                    strokeLinecap="round"
                    stroke="currentColor"
                    fill="transparent"
                  />
                </svg>
                <div className="absolute flex flex-col items-center justify-center">
                  <span className="text-3xl font-extrabold text-white tracking-tight">{presenceSummary.responseRate}%</span>
                  <span className="text-[10px] text-slate-500 font-medium">Respondido</span>
                </div>
              </div>
              <p className="text-xs text-slate-400">
                Dos {presenceSummary.sentToday} check-ins disparados hoje, {presenceSummary.confirmed} foram respondidos com sucesso.
              </p>
            </div>

            {/* Bar Chart - Ocorrências Recentes por Tipo */}
            <div className="p-6 rounded-xl border border-slate-800 bg-slate-900 shadow-lg flex flex-col space-y-4 md:col-span-2">
              <h3 className="text-sm font-bold text-slate-350 uppercase tracking-wider text-[10px]">Ocorrências Ativas por Tipo</h3>
              
              <div className="flex-1 flex flex-col justify-around min-h-[140px] space-y-3">
                {/* Bar 1 - Faltas */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-400 font-medium">Faltas Registradas</span>
                    <span className="text-white font-bold">{summary.absencesToday}</span>
                  </div>
                  <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-rose-500 transition-all duration-500"
                      style={{ width: `${Math.min(100, (summary.absencesToday / (summary.absencesToday || 1)) * 100)}%` }}
                    />
                  </div>
                </div>

                {/* Bar 2 - Atrasos */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-400 font-medium">Atrasos de Horário</span>
                    <span className="text-white font-bold">{summary.lateArrivalsToday}</span>
                  </div>
                  <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-amber-500 transition-all duration-500"
                      style={{ width: `${Math.min(100, (summary.lateArrivalsToday / (summary.lateArrivalsToday || 1)) * 100)}%` }}
                    />
                  </div>
                </div>

                {/* Bar 3 - Atestados */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-400 font-medium">Atestados Sob Revisão</span>
                    <span className="text-white font-bold">{certSummary.underReview}</span>
                  </div>
                  <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-indigo-500 transition-all duration-500"
                      style={{ width: `${Math.min(100, (certSummary.underReview / (certSummary.underReview || 1)) * 100)}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Main Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Left Col - Occurrences */}
            <div className="lg:col-span-2 rounded-xl border border-slate-800 bg-slate-900 overflow-hidden shadow-xl">
              <div className="px-6 py-5 border-b border-slate-800 flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-bold text-white">Últimas Ocorrências</h2>
                  <p className="text-xs text-slate-500">Acompanhamento operacional em tempo real</p>
                </div>
                <button
                  onClick={() => router.push('/app/occurrences')}
                  className="text-xs font-semibold text-indigo-400 hover:text-indigo-300 transition-colors flex items-center gap-1.5"
                >
                  <span>Ver todas</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
              {recentOccurrences.length === 0 ? (
                <div className="py-20 text-center text-slate-500 text-sm">
                  Nenhuma ocorrência registrada no momento.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm text-slate-400 border-collapse">
                    <thead>
                      <tr className="border-b border-slate-800 bg-slate-900/50 text-slate-500 font-semibold text-xs uppercase tracking-wider">
                        <th className="px-6 py-3.5">Funcionário</th>
                        <th className="px-6 py-3.5">Tipo</th>
                        <th className="px-6 py-3.5">Horário/Data</th>
                        <th className="px-6 py-3.5">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {recentOccurrences.map((occ) => (
                        <tr key={occ.id} className="hover:bg-slate-800/20 transition-colors">
                          <td className="px-6 py-4">
                            <p className="font-semibold text-slate-200 text-sm">{occ.employee?.fullName}</p>
                            <p className="text-xs text-slate-500">{occ.employee?.sector || '-'}</p>
                          </td>
                          <td className="px-6 py-4">
                            <p className="text-slate-350">{getTypeLabel(occ.type)}</p>
                          </td>
                          <td className="px-6 py-4 font-mono text-xs text-slate-400">
                            {new Date(occ.occurrenceDate).toLocaleString('pt-BR')}
                          </td>
                          <td className="px-6 py-4">{getStatusBadge(occ.status)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Right Col - Additional Metrics */}
            <div className="rounded-xl border border-slate-800 bg-slate-900 p-6 flex flex-col justify-between shadow-xl space-y-6">
              <div className="space-y-4">
                <h3 className="text-lg font-bold text-white">Integração WhatsApp</h3>
                <p className="text-sm text-slate-400 leading-relaxed">
                  Classificação automática de justificativas de presença e envio de cobranças automáticas via WhatsApp.
                </p>

                {/* Atestados card */}
                <div className="p-4 rounded-lg bg-emerald-500/5 border border-emerald-500/15 text-emerald-400 text-xs flex items-center gap-3">
                  <FileText className="w-5 h-5 animate-pulse shrink-0" />
                  <div>
                    <p className="font-bold">Atestados Médicos</p>
                    <p className="text-slate-400 mt-0.5">{certSummary.underReview} atestado(s) pendentes de análise do RH.</p>
                  </div>
                </div>

                {/* Presence card */}
                <div className="p-4 rounded-lg bg-indigo-500/5 border border-indigo-500/15 text-indigo-400 text-xs flex items-center gap-3">
                  <Activity className="w-5 h-5 animate-pulse shrink-0" />
                  <div>
                    <p className="font-bold">Check-in Remoto Hoje</p>
                    <p className="text-slate-400 mt-0.5">
                      Enviados: {presenceSummary.sentToday} | Confirmados: {presenceSummary.confirmed} | Pendentes: {presenceSummary.pending}
                    </p>
                    <p className="text-slate-500 mt-0.5 font-medium">
                      Taxa de resposta: {presenceSummary.responseRate}% | Vencidos: {presenceSummary.notRespondedOverdue}
                    </p>
                  </div>
                </div>

                {/* Pendências de Fechamento card */}
                {pendenciesCount > 0 && (
                  <div
                    onClick={() => router.push('/app/reports')}
                    className="p-4 rounded-lg bg-rose-500/5 border border-rose-500/15 text-rose-400 hover:bg-rose-500/10 hover:border-rose-500/25 text-xs flex items-center gap-3 cursor-pointer transition-all"
                  >
                    <AlertCircle className="w-5 h-5 animate-pulse shrink-0 text-rose-500" />
                    <div>
                      <p className="font-bold">Pendências de Fechamento</p>
                      <p className="text-slate-400 mt-0.5 font-sans">
                        Existem {pendenciesCount} pendência(s) que impedem o fechamento operacional.
                      </p>
                    </div>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <button
                  onClick={() => router.push('/app/medical-certificates')}
                  className="w-full py-2.5 rounded-lg border border-indigo-500/20 hover:border-indigo-500/35 bg-indigo-500/5 text-indigo-400 hover:text-indigo-350 text-xs font-bold transition-all cursor-pointer"
                >
                  Ir para Gestão de Atestados
                </button>
                <button
                  onClick={() => router.push('/app/presence')}
                  className="w-full py-2.5 rounded-lg border border-emerald-500/20 hover:border-emerald-500/35 bg-emerald-500/5 text-emerald-400 hover:text-emerald-350 text-xs font-bold transition-all cursor-pointer"
                >
                  Ir para Presença Remota
                </button>
                <button
                  onClick={() => router.push('/app/reports')}
                  className="w-full py-2.5 rounded-lg border border-rose-500/20 hover:border-rose-500/35 bg-rose-500/5 text-rose-450 hover:text-rose-400 text-xs font-bold transition-all cursor-pointer"
                >
                  Ir para Relatórios / Fechamento
                </button>
              </div>
            </div>
          </div>

          {/* Real-time Presence Radar Section */}
          <div className="mt-8 rounded-xl border border-slate-800 bg-slate-900 overflow-hidden shadow-xl">
            <div className="px-6 py-5 border-b border-slate-800 flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping" />
                  <h2 className="text-lg font-bold text-white">Radar de Presença ao Vivo</h2>
                </div>
                <p className="text-xs text-slate-500">Monitoramento em tempo real de marcações e sincronizações</p>
              </div>
              {liveEvents.length > 0 && (
                <button
                  onClick={() => setLiveEvents([])}
                  className="text-xs font-semibold text-slate-400 hover:text-slate-350 transition-colors"
                >
                  Limpar feed
                </button>
              )}
            </div>

            {liveEvents.length === 0 ? (
              <div className="py-12 text-center text-slate-500 text-sm flex flex-col items-center justify-center gap-2">
                <Activity className="w-8 h-8 text-slate-600 animate-pulse" />
                <span>Aguardando novas marcações de ponto...</span>
              </div>
            ) : (
              <div className="p-6 divide-y divide-slate-800/60 max-h-96 overflow-y-auto">
                {liveEvents.map((evt: any, idx) => (
                  <div key={evt.id || idx} className="py-3 flex items-center justify-between text-xs transition-all hover:bg-slate-800/10 px-2 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-slate-850 flex items-center justify-center font-bold text-slate-300">
                        {evt.employee?.fullName?.[0] || 'E'}
                      </div>
                      <div>
                        <p className="font-bold text-slate-200 text-sm">{evt.employee?.fullName}</p>
                        <p className="text-slate-500 text-[10px]">{evt.employee?.sector || 'Geral'} • {evt.employee?.jobTitle || '-'}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <p className="font-mono text-slate-300 font-semibold">{new Date(evt.respondedAt || evt.sentAt).toLocaleTimeString('pt-BR')}</p>
                        <p className="text-[10px] text-slate-500">{evt.syncStatus === 'OFFLINE_PENDING' || evt.offlineEventId ? 'Sync Offline' : 'Online'}</p>
                      </div>
                      <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${
                        evt.status === 'CONFIRMED' ? 'bg-emerald-500/10 text-emerald-400' :
                        evt.status === 'LATE' ? 'bg-amber-500/10 text-amber-400' : 'bg-slate-800 text-slate-400'
                      }`}>
                        {evt.status === 'CONFIRMED' ? 'Confirmado' : evt.status === 'LATE' ? 'Atrasado' : evt.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </>
  );
}
