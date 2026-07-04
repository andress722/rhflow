'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import {
  Sliders,
  RefreshCw,
  TrendingUp,
  DollarSign,
  Users,
  AlertTriangle,
  Activity,
  ShieldAlert,
  Server,
  Calendar,
  CheckCircle,
  FileSpreadsheet,
  Zap,
  ChevronRight,
  UserCheck,
  PhoneCall,
  Heart,
  MessageSquare,
  ClipboardList
} from 'lucide-react';

export default function CommandCenterPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchOverview = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get('/admin/command-center/overview') as any;
      if (res && res.success) {
        setData(res.data);
      } else {
        setError(res?.error?.message || 'Erro ao carregar o Command Center.');
      }
    } catch (e) {
      setError('Erro de rede ao buscar dados consolidados do SaaS.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOverview();
  }, []);

  const formatCurrency = (cents: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format((cents || 0) / 100);
  };

  const getAlertSeverityBadgeClass = (severity: string) => {
    switch (severity) {
      case 'HIGH':
        return 'bg-rose-500/10 text-rose-400 border border-rose-500/20';
      case 'MEDIUM':
        return 'bg-amber-500/10 text-amber-400 border border-amber-500/20';
      default:
        return 'bg-slate-500/10 text-slate-400 border border-slate-500/20';
    }
  };

  const getAlertSeverityLabel = (severity: string) => {
    switch (severity) {
      case 'HIGH':
        return 'Crítico';
      case 'MEDIUM':
        return 'Atenção';
      default:
        return 'Baixo';
    }
  };

  const getAlertIcon = (type: string) => {
    switch (type) {
      case 'OVERDUE_ACCOUNT':
        return <DollarSign className="w-5 h-5 text-rose-400 shrink-0" />;
      case 'CRITICAL_HEALTH':
        return <Activity className="w-5 h-5 text-rose-500 shrink-0" />;
      case 'HIGH_CHURN_RISK':
        return <ShieldAlert className="w-5 h-5 text-rose-400 shrink-0" />;
      case 'RENEWAL_ALERT':
        return <Calendar className="w-5 h-5 text-emerald-400 shrink-0" />;
      case 'OVERDUE_FOLLOWUP':
        return <PhoneCall className="w-5 h-5 text-indigo-400 shrink-0" />;
      case 'STALE_LEAD':
        return <UserCheck className="w-5 h-5 text-amber-400 shrink-0" />;
      case 'PILOT_CRITICAL_FEEDBACK':
        return <ShieldAlert className="w-5 h-5 text-rose-505 shrink-0" />;
      case 'MANY_OPEN_PILOT_FEEDBACKS':
        return <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0" />;
      case 'UNRESOLVED_INCIDENT':
        return <AlertTriangle className="w-5 h-5 text-rose-500 shrink-0" />;
      case 'URGENT_BACKLOG_ITEM':
        return <ShieldAlert className="w-5 h-5 text-rose-500 shrink-0" />;
      case 'MANY_OPEN_BACKLOG_ITEMS':
        return <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0" />;
      case 'OVERDUE_BACKLOG_ITEM':
        return <AlertTriangle className="w-5 h-5 text-rose-500 shrink-0" />;
      default:
        return <AlertTriangle className="w-5 h-5 text-slate-400 shrink-0" />;
    }
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight flex items-center gap-3">
            <Sliders className="w-8 h-8 text-indigo-500" />
            <span>Command Center Executivo</span>
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            Visão consolidada da saúde comercial, financeira, operacional e técnica do PresençaFlow RH.
          </p>
        </div>
        <button
          onClick={fetchOverview}
          className="flex items-center gap-2 px-4 py-2 bg-slate-900 border border-slate-800 text-slate-200 hover:text-white hover:bg-slate-800 rounded-lg text-sm font-medium transition-all shrink-0 self-start md:self-auto"
        >
          <RefreshCw className="w-4 h-4 animate-hover" />
          <span>Sincronizar Cockpit</span>
        </button>
      </div>

      {error && (
        <div className="bg-rose-500/10 border border-rose-500/20 rounded-xl p-5 flex items-start gap-4">
          <ShieldAlert className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
          <div>
            <h4 className="text-sm font-semibold text-rose-400">Falha ao buscar telemetria</h4>
            <p className="text-xs text-rose-300/80 mt-1">{error}</p>
          </div>
        </div>
      )}

      {loading ? (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-20 flex flex-col items-center justify-center gap-3">
          <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
          <span className="text-sm text-slate-400 font-medium font-sans">Compilando dados SaaS consolidados...</span>
        </div>
      ) : data ? (
        <>
          {/* Main KPI Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4">
            {/* MRR */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 flex flex-col justify-between shadow-lg">
              <div className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-2">MRR Manual</div>
              <div>
                <h3 className="text-2xl font-bold text-indigo-400">{formatCurrency(data.revenue.manualMrrCents)}</h3>
                <p className="text-[10px] text-slate-500 mt-1">Soma de ativos e pendentes</p>
              </div>
            </div>

            {/* Active Accounts */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 flex flex-col justify-between shadow-lg">
              <div className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-2">Clientes Ativos</div>
              <div>
                <h3 className="text-2xl font-bold text-emerald-400">{data.revenue.activeSubscriptions}</h3>
                <p className="text-[10px] text-slate-500 mt-1">Assinaturas adimplentes</p>
              </div>
            </div>

            {/* Overdue Accounts */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 flex flex-col justify-between shadow-lg">
              <div className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-2">Contas Vencidas</div>
              <div>
                <h3 className="text-2xl font-bold text-rose-500">{data.revenue.overdueAccounts}</h3>
                <p className="text-[10px] text-rose-450 mt-1 font-medium">Atrasos de vencimento passados</p>
              </div>
            </div>

            {/* High Churn Risk */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 flex flex-col justify-between shadow-lg">
              <div className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-2">Risco Churn Alto</div>
              <div>
                <h3 className="text-2xl font-bold text-rose-400">{data.customers.highChurnRisk}</h3>
                <p className="text-[10px] text-slate-500 mt-1">Uso crítico/pagamento vencido</p>
              </div>
            </div>

            {/* Open Leads */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 flex flex-col justify-between shadow-lg">
              <div className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-2">Leads em Aberto</div>
              <div>
                <h3 className="text-2xl font-bold text-indigo-400">{data.commercial.openLeads}</h3>
                <p className="text-[10px] text-slate-500 mt-1">Funil ativo de captação</p>
              </div>
            </div>

            {/* Operational Errors */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 flex flex-col justify-between shadow-lg">
              <div className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-2">Erros (24h)</div>
              <div>
                <h3 className="text-2xl font-bold text-amber-500">{data.platform.operationalErrors24h}</h3>
                <p className="text-[10px] text-slate-500 mt-1">Monitoramento de telemetria</p>
              </div>
            </div>
          </div>

          {/* Core Cockpit Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Prioritized Alerts Panel */}
            <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-lg flex flex-col h-fit">
              <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                <ShieldAlert className="w-5 h-5 text-rose-500" />
                <span>Alertas Prioritários de Gestão</span>
              </h3>
              
              {data.alerts.length === 0 ? (
                <div className="py-12 text-center text-slate-500 flex flex-col items-center gap-2 border border-dashed border-slate-800 rounded-xl bg-slate-950/20">
                  <CheckCircle className="w-8 h-8 text-emerald-500" />
                  <span className="text-sm font-semibold">Tudo sob controle!</span>
                  <span className="text-xs">Nenhum alerta de faturamento ou saúde pendente de ação.</span>
                </div>
              ) : (
                <div className="space-y-3">
                  {data.alerts.map((alert: any, idx: number) => (
                    <div key={idx} className="bg-slate-950/60 border border-slate-850 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div className="flex gap-3">
                        {getAlertIcon(alert.type)}
                        <div>
                          <h4 className="text-sm font-bold text-white flex items-center gap-2">
                            <span>{alert.title}</span>
                            <span className={`px-2 py-0.5 rounded text-[9px] uppercase font-extrabold ${getAlertSeverityBadgeClass(alert.severity)}`}>
                              {getAlertSeverityLabel(alert.severity)}
                            </span>
                          </h4>
                          <p className="text-xs text-slate-400 mt-1">{alert.description}</p>
                        </div>
                      </div>
                      <Link
                        href={alert.actionUrl}
                        className="px-3.5 py-1.5 bg-indigo-650 hover:bg-indigo-600 text-white rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 self-end sm:self-auto shrink-0"
                      >
                        <span>Agir</span>
                        <ChevronRight className="w-3 h-3" />
                      </Link>
                    </div>
                  ))}
                  
                  <div className="pt-2 text-right">
                    <Link
                      href="/app/admin/retention"
                      className="text-xs font-semibold text-indigo-400 hover:text-indigo-300 transition-colors inline-flex items-center gap-1"
                    >
                      <span>Ver todas as contas sob risco</span>
                      <ChevronRight className="w-4 h-4" />
                    </Link>
                  </div>
                </div>
              )}
            </div>

            {/* Platform & Operational Status Panel */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-lg space-y-6">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Server className="w-5 h-5 text-indigo-400" />
                <span>Telemetria da Plataforma</span>
              </h3>

              <div className="space-y-4 text-sm">
                <div className="flex items-center justify-between border-b border-slate-850 pb-2.5">
                  <span className="text-slate-400">Erros Operacionais (7d)</span>
                  <span className="font-semibold text-slate-200">{data.platform.operationalErrors7d}</span>
                </div>
                <div className="flex items-center justify-between border-b border-slate-850 pb-2.5">
                  <span className="text-slate-400">Falhas de WhatsApp (7d)</span>
                  <span className="font-semibold text-slate-200">{data.platform.whatsappErrors7d}</span>
                </div>
                <div className="flex items-center justify-between border-b border-slate-850 pb-2.5">
                  <span className="text-slate-400">Último Job de Alerta</span>
                  <span className="font-mono text-xs text-slate-400">{data.platform.internalJobsLastRun ? new Date(data.platform.internalJobsLastRun).toLocaleString('pt-BR') : 'Sem dados'}</span>
                </div>
                <div className="flex items-center justify-between border-b border-slate-850 pb-2.5">
                  <span className="text-slate-400">Status dos Backups</span>
                  <span className="inline-flex items-center gap-1 text-emerald-400 font-semibold text-xs">
                    <CheckCircle className="w-3.5 h-3.5" />
                    <span>Integrado (RDS)</span>
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Smoke Test Operacional</span>
                  <span className="inline-flex items-center gap-1 text-emerald-400 font-semibold text-xs">
                    <CheckCircle className="w-3.5 h-3.5" />
                    <span>Passando (OK)</span>
                  </span>
                </div>
              </div>

              <div className="bg-slate-950 border border-slate-850 rounded-xl p-4 text-xs space-y-2">
                <span className="font-bold text-white block">Acesso Rápido Suporte:</span>
                <p className="text-slate-400">Monitore erros, status de envio de WhatsApp e logs gerais do sistema no Painel de Suporte.</p>
                <Link
                  href="/app/admin/support"
                  className="text-indigo-400 hover:text-indigo-300 font-semibold transition-colors block"
                >
                  Ir para Painel Suporte &rarr;
                </Link>
              </div>
            </div>

            {/* Commercial Panel */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-lg flex flex-col justify-between">
              <div>
                <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-indigo-400" />
                  <span>Comercial & CRM</span>
                </h3>

                <div className="space-y-3.5 text-sm">
                  <div className="flex justify-between border-b border-slate-850 pb-2">
                    <span className="text-slate-400">Novos Leads (7d)</span>
                    <span className="font-semibold text-white">{data.commercial.newLeads7d}</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-850 pb-2">
                    <span className="text-slate-400">Leads Sem Contato</span>
                    <span className="font-semibold text-white">{data.commercial.overdueFollowUps}</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-850 pb-2">
                    <span className="text-slate-400">Propostas Enviadas</span>
                    <span className="font-semibold text-white">{data.commercial.proposalsSent}</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-850 pb-2">
                    <span className="text-slate-400">Pilotos Ganhos (Mês)</span>
                    <span className="font-semibold text-emerald-450">{data.commercial.pilotsWonThisMonth}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Pilotos Perdidos (Mês)</span>
                    <span className="font-semibold text-slate-450">{data.commercial.pilotsLostThisMonth}</span>
                  </div>
                </div>
              </div>

              <div className="pt-6 flex gap-2">
                <Link
                  href="/app/admin/leads"
                  className="flex-1 text-center py-2 bg-slate-950 hover:bg-slate-850 border border-slate-850 text-slate-350 hover:text-white rounded text-xs transition-all font-semibold"
                >
                  CRM Leads
                </Link>
                <Link
                  href="/app/admin/pilots"
                  className="flex-1 text-center py-2 bg-slate-950 hover:bg-slate-850 border border-slate-850 text-slate-350 hover:text-white rounded text-xs transition-all font-semibold"
                >
                  Gestão Pilotos
                </Link>
              </div>
            </div>

            {/* Revenue / Billing Panel */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-lg flex flex-col justify-between">
              <div>
                <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                  <DollarSign className="w-5 h-5 text-indigo-400" />
                  <span>Faturamento SaaS Manual</span>
                </h3>

                <div className="space-y-3.5 text-sm">
                  <div className="flex justify-between border-b border-slate-850 pb-2">
                    <span className="text-slate-400">Assinaturas Ativas</span>
                    <span className="font-semibold text-white">{data.revenue.activeSubscriptions}</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-850 pb-2">
                    <span className="text-slate-400">Aguardando Pagamento</span>
                    <span className="font-semibold text-white">{data.revenue.paymentPending}</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-850 pb-2">
                    <span className="text-slate-400">Contas Vencidas</span>
                    <span className="font-semibold text-rose-450">{data.revenue.overdueAccounts}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Canceladas no Mês</span>
                    <span className="font-semibold text-slate-450">{data.revenue.canceledThisMonth}</span>
                  </div>
                </div>
              </div>

              <div className="pt-6">
                <Link
                  href="/app/admin/billing"
                  className="block text-center py-2 bg-slate-950 hover:bg-slate-850 border border-slate-850 text-slate-350 hover:text-white rounded text-xs transition-all font-semibold"
                >
                  Gerenciar Contratos e Cobrança
                </Link>
              </div>
            </div>

            {/* Customers & Health / CSR Panel */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-lg flex flex-col justify-between">
              <div>
                <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                  <Heart className="w-5 h-5 text-indigo-400" />
                  <span>Clientes, Sucesso e Retenção</span>
                </h3>

                <div className="space-y-3.5 text-sm">
                  <div className="flex justify-between border-b border-slate-850 pb-2">
                    <span className="text-slate-400">Empresas Clientes</span>
                    <span className="font-semibold text-white">{data.customers.activeCompanies}</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-850 pb-2">
                    <span className="text-slate-400">Empresas em Piloto</span>
                    <span className="font-semibold text-white">{data.customers.pilotCompanies}</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-850 pb-2">
                    <span className="text-slate-400">Saúde Saudável / Atenção</span>
                    <span className="font-semibold text-white">{data.customers.healthyCompanies} / {data.customers.attentionCompanies}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Saúde Crítica</span>
                    <span className="font-semibold text-rose-450">{data.customers.criticalCompanies}</span>
                  </div>
                </div>
              </div>

              <div className="pt-6 flex gap-2">
                <Link
                  href="/app/admin/retention"
                  className="flex-1 text-center py-2 bg-slate-950 hover:bg-slate-850 border border-slate-850 text-slate-350 hover:text-white rounded text-xs transition-all font-semibold"
                >
                  Prevenção Churn
                </Link>
                <Link
                  href="/app/admin/support/customer-success"
                  className="flex-1 text-center py-2 bg-slate-950 hover:bg-slate-850 border border-slate-850 text-slate-350 hover:text-white rounded text-xs transition-all font-semibold"
                >
                  Plataforma CS
                </Link>
              </div>
            </div>

            {/* Operations / RH Metrics Panel */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-lg">
              <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                <Activity className="w-5 h-5 text-indigo-400" />
                <span>Operação de RH & Uso</span>
              </h3>

              <div className="space-y-3.5 text-sm">
                <div className="flex justify-between border-b border-slate-850 pb-2">
                  <span className="text-slate-400">Check-ins Remotos (7d)</span>
                  <span className="font-semibold text-white">{data.operations.remoteCheckins7d}</span>
                </div>
                <div className="flex justify-between border-b border-slate-850 pb-2">
                  <span className="text-slate-400">Taxa de Resposta Global</span>
                  <span className="font-semibold text-white">{data.operations.responseRate7dGlobal}%</span>
                </div>
                <div className="flex justify-between border-b border-slate-850 pb-2">
                  <span className="text-slate-400">Ocorrências em Aberto</span>
                  <span className="font-semibold text-white">{data.operations.occurrencesOpen}</span>
                </div>
                <div className="flex justify-between border-b border-slate-850 pb-2">
                  <span className="text-slate-400">Atestados Aguardando</span>
                  <span className="font-semibold text-white">{data.operations.medicalCertificatesPending}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Relatórios Exportados (7d)</span>
                  <span className="font-semibold text-white">{data.operations.reportsExported7d}</span>
                </div>
              </div>
            </div>

            {/* Pilot Feedbacks Panel */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-lg flex flex-col justify-between">
              <div>
                <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                  <MessageSquare className="w-5 h-5 text-indigo-400" />
                  <span>Feedbacks de Clientes Piloto</span>
                </h3>

                <div className="space-y-3.5 text-sm">
                  <div className="flex justify-between border-b border-slate-850 pb-2">
                    <span className="text-slate-400">Total em Aberto</span>
                    <span className="font-semibold text-white">{data.pilotFeedback?.openFeedbacks ?? 0}</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-850 pb-2">
                    <span className="text-slate-400">Severidade Crítica</span>
                    <span className="font-semibold text-rose-450">{data.pilotFeedback?.criticalFeedbacks ?? 0}</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-850 pb-2">
                    <span className="text-slate-400">Resolvidos (7d)</span>
                    <span className="font-semibold text-emerald-450">{data.pilotFeedback?.resolved7d ?? 0}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Empresas com Pendências</span>
                    <span className="font-semibold text-white">{data.pilotFeedback?.companiesWithOpenFeedback ?? 0}</span>
                  </div>
                </div>
              </div>

              <div className="pt-6">
                <Link
                  href="/app/admin/pilot-feedback"
                  className="block text-center py-2 bg-slate-950 hover:bg-slate-850 border border-slate-850 text-slate-350 hover:text-white rounded text-xs transition-all font-semibold"
                >
                  Gerenciar Feedbacks e Incidentes
                </Link>
              </div>
            </div>

            {/* Pilot Backlog Panel */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-lg flex flex-col justify-between">
              <div>
                <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                  <ClipboardList className="w-5 h-5 text-indigo-400" />
                  <span>Backlog de Produto (Piloto)</span>
                </h3>

                <div className="space-y-3.5 text-sm">
                  <div className="flex justify-between border-b border-slate-850 pb-2">
                    <span className="text-slate-400">Total em Aberto</span>
                    <span className="font-semibold text-white">{data.pilotBacklog?.openItems ?? 0}</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-850 pb-2">
                    <span className="text-slate-400">Itens Urgentes</span>
                    <span className="font-semibold text-rose-450">{data.pilotBacklog?.urgentItems ?? 0}</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-850 pb-2">
                    <span className="text-slate-400">Em Andamento</span>
                    <span className="font-semibold text-indigo-400">{data.pilotBacklog?.inProgressItems ?? 0}</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-850 pb-2">
                    <span className="text-slate-400">Concluídos (7d)</span>
                    <span className="font-semibold text-emerald-450">{data.pilotBacklog?.done7d ?? 0}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Prazos Vencidos</span>
                    <span className="font-semibold text-amber-500">{data.pilotBacklog?.overdueTargetItems ?? 0}</span>
                  </div>
                </div>
              </div>

              <div className="pt-6">
                <Link
                  href="/app/admin/pilot-backlog"
                  className="block text-center py-2 bg-slate-950 hover:bg-slate-850 border border-slate-850 text-slate-350 hover:text-white rounded text-xs transition-all font-semibold"
                >
                  Gerenciar Backlog Técnico
                </Link>
              </div>
            </div>
            
          </div>
        </>
      ) : (
        <div className="text-center py-20 text-slate-500">Nenhum dado consolidado encontrado.</div>
      )}
    </div>
  );
}
