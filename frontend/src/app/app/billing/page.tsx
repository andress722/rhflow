'use client';

import React, { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import {
  CreditCard,
  Check,
  X,
  AlertTriangle,
  Info,
  Users,
  Activity,
  FileText,
  Download,
} from 'lucide-react';

export default function BillingPage() {
  const [data, setData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchBillingData();
  }, []);

  const fetchBillingData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await api.get('/billing/usage');
      if (res.success && res.data) {
        setData(res.data);
      } else {
        setError(res.error?.message || 'Erro ao carregar dados de cobrança e uso.');
      }
    } catch (err: any) {
      setError(err.message || 'Erro de conexão com o servidor.');
    } finally {
      setIsLoading(false);
    }
  };

  const formatDate = (dateStr?: string | null) => {
    if (!dateStr) return 'Sem expiração';
    return new Date(dateStr).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  };

  if (isLoading) {
    return (
      <div className="py-32 flex flex-col items-center gap-3">
        <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
        <span className="text-sm text-slate-400 font-medium">Carregando plano e uso...</span>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-6 bg-red-950/20 border border-red-900/30 rounded-xl text-center">
        <AlertTriangle className="w-10 h-10 text-red-500 mx-auto mb-3" />
        <h3 className="text-lg font-bold text-white mb-1">Erro de Carregamento</h3>
        <p className="text-slate-400 text-sm mb-4">{error || 'Não foi possível buscar as informações de uso.'}</p>
        <button
          onClick={fetchBillingData}
          className="px-4 py-2 text-xs font-semibold rounded-lg bg-red-900/50 hover:bg-red-800 text-red-200 transition-all"
        >
          Tentar Novamente
        </button>
      </div>
    );
  }

  const {
    planName,
    planCode,
    status,
    startedAt,
    endsAt,
    isFallback,
    limits,
    usage,
    percentages,
    modules,
    period,
  } = data;

  const usageCards = [
    {
      title: 'Funcionários Ativos',
      key: 'employees',
      icon: Users,
      current: usage.employees,
      limit: limits.employees,
      percentage: percentages.employees,
      enabled: true,
      color: 'indigo',
    },
    {
      title: 'Check-ins do Mês',
      key: 'checkins',
      icon: Activity,
      current: usage.checkins,
      limit: limits.checkins,
      percentage: percentages.checkins,
      enabled: true,
      color: 'emerald',
    },
    {
      title: 'Uploads de Atestados',
      key: 'uploads',
      icon: FileText,
      current: usage.uploads,
      limit: limits.uploads,
      percentage: percentages.uploads,
      enabled: modules.medicalModule && limits.uploads > 0,
      color: 'violet',
    },
    {
      title: 'Exportações de Relatórios',
      key: 'exports',
      icon: Download,
      current: usage.exports,
      limit: limits.exports,
      percentage: percentages.exports,
      enabled: modules.exports && limits.exports > 0,
      color: 'amber',
    },
  ];

  return (
    <div className="space-y-8">
      {/* Title */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white">Plano e Uso</h1>
          <p className="text-slate-400 text-sm mt-1">
            Acompanhe o consumo dos recursos e o status da assinatura da sua empresa.
          </p>
        </div>
        <button
          onClick={fetchBillingData}
          className="px-3.5 py-1.5 rounded-lg border border-slate-800 hover:border-slate-700 bg-slate-900 text-slate-350 hover:text-white transition-all text-xs font-semibold"
        >
          Atualizar Uso
        </button>
      </div>

      {/* Fallback Warning */}
      {isFallback && (
        <div className="flex items-start gap-4 p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-300">
          <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
          <div>
            <h4 className="font-semibold text-sm">Assinatura Não Encontrada</h4>
            <p className="text-xs text-amber-400/90 mt-1">
              Sua empresa está rodando sob a assinatura provisória virtual do plano <strong>STARTER</strong> (fallback). As operações básicas estão ativas, mas limites adicionais e módulos avançados estão restritos.
            </p>
          </div>
        </div>
      )}

      {/* Main Info Columns */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left Column: Plan and Subscription details */}
        <div className="lg:col-span-1 space-y-6">
          <div className="p-6 rounded-xl border border-slate-800 bg-slate-900 flex flex-col justify-between shadow-xl min-h-[300px]">
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-indigo-400 text-xs font-bold uppercase tracking-wider">
                <CreditCard className="w-4 h-4" />
                <span>Assinatura Ativa</span>
              </div>
              <div>
                <h2 className="text-4xl font-black text-white tracking-tight">
                  {planName}
                </h2>
                <p className="text-xs text-slate-500 mt-1">Código do plano: {planCode}</p>
              </div>

              <div className="pt-4 space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-400">Status</span>
                  <span className={`px-2 py-0.5 rounded text-xs font-semibold ${
                    status === 'ACTIVE'
                      ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20'
                      : 'bg-amber-500/15 text-amber-400 border border-amber-500/20'
                  }`}>
                    {status}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-400">Início</span>
                  <span className="text-slate-200 font-medium">{formatDate(startedAt)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-400">Vigência</span>
                  <span className="text-slate-200 font-medium">{formatDate(endsAt)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-400">Período de Consumo</span>
                  <span className="text-slate-250 font-mono text-xs font-semibold">{period}</span>
                </div>
              </div>
            </div>

            <div className="pt-6 border-t border-slate-800/80">
              <div className="text-[10px] text-slate-500 text-center leading-relaxed">
                Para alterar seu plano ou adicionar novas cotas, entre em contato com nosso suporte comercial.
              </div>
            </div>
          </div>

          {/* Module Availability Card */}
          <div className="p-6 rounded-xl border border-slate-800 bg-slate-900 shadow-xl space-y-4">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider text-slate-400">Módulos do Plano</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between text-sm py-1">
                <span className="text-slate-350">Módulo de Relatórios</span>
                {modules.reports ? (
                  <span className="text-emerald-400 flex items-center gap-1 text-xs font-semibold"><Check className="w-4 h-4" /> Ativo</span>
                ) : (
                  <span className="text-red-400 flex items-center gap-1 text-xs font-semibold"><X className="w-4 h-4" /> Bloqueado</span>
                )}
              </div>
              <div className="flex items-center justify-between text-sm py-1">
                <span className="text-slate-350">Disparo de Check-in em Lote</span>
                {modules.batchCheckin ? (
                  <span className="text-emerald-400 flex items-center gap-1 text-xs font-semibold"><Check className="w-4 h-4" /> Ativo</span>
                ) : (
                  <span className="text-red-400 flex items-center gap-1 text-xs font-semibold"><X className="w-4 h-4" /> Bloqueado</span>
                )}
              </div>
              <div className="flex items-center justify-between text-sm py-1">
                <span className="text-slate-350">Módulo de Atestados Médicos</span>
                {modules.medicalModule ? (
                  <span className="text-emerald-400 flex items-center gap-1 text-xs font-semibold"><Check className="w-4 h-4" /> Ativo</span>
                ) : (
                  <span className="text-red-400 flex items-center gap-1 text-xs font-semibold"><X className="w-4 h-4" /> Bloqueado</span>
                )}
              </div>
              <div className="flex items-center justify-between text-sm py-1">
                <span className="text-slate-350">Exportação de Relatórios CSV</span>
                {modules.exports ? (
                  <span className="text-emerald-400 flex items-center gap-1 text-xs font-semibold"><Check className="w-4 h-4" /> Ativo</span>
                ) : (
                  <span className="text-red-400 flex items-center gap-1 text-xs font-semibold"><X className="w-4 h-4" /> Bloqueado</span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Usage metrics and progresses */}
        <div className="lg:col-span-2 space-y-6">
          <div className="p-6 rounded-xl border border-slate-800 bg-slate-900 shadow-xl space-y-6">
            <div>
              <h3 className="text-lg font-bold text-white">Consumo Mensal de Recursos</h3>
              <p className="text-xs text-slate-500 mt-0.5">Indicadores do consumo contratado para o mês atual.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {usageCards.map((card) => {
                const Icon = card.icon;
                const isOver80 = card.percentage >= 80;
                
                // Color mapping
                const colorMap = {
                  indigo: { bg: 'bg-indigo-500/10', text: 'text-indigo-400', progress: 'bg-indigo-600' },
                  emerald: { bg: 'bg-emerald-500/10', text: 'text-emerald-400', progress: 'bg-emerald-600' },
                  violet: { bg: 'bg-violet-500/10', text: 'text-violet-400', progress: 'bg-violet-600' },
                  amber: { bg: 'bg-amber-500/10', text: 'text-amber-400', progress: 'bg-amber-600' },
                };
                
                const style = colorMap[card.color as keyof typeof colorMap];
                
                return (
                  <div
                    key={card.key}
                    className="p-5 rounded-xl border border-slate-850 bg-slate-950 flex flex-col justify-between space-y-4"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold text-slate-350">{card.title}</span>
                      <div className={`p-2 rounded-lg ${style.bg}`}>
                        <Icon className={`w-4 h-4 ${style.text}`} />
                      </div>
                    </div>

                    {!card.enabled ? (
                      <div className="space-y-1">
                        <span className="text-xs font-semibold text-rose-450 bg-rose-500/10 border border-rose-500/15 px-2 py-0.5 rounded inline-block">
                          Indisponível no plano
                        </span>
                        <p className="text-[10px] text-slate-500 mt-2">Módulo desativado ou sem cota neste plano.</p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <div className="flex justify-between items-baseline">
                          <span className="text-2xl font-black text-white">
                            {card.current}
                            <span className="text-slate-500 text-xs font-semibold ml-1">/ {card.limit}</span>
                          </span>
                          <span className={`text-xs font-bold ${isOver80 ? 'text-rose-400' : 'text-slate-450'}`}>
                            {card.percentage}%
                          </span>
                        </div>

                        {/* Progress Bar Container */}
                        <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
                          <div
                            className={`h-full transition-all duration-500 ${
                              isOver80 ? 'bg-rose-600 shadow-md shadow-rose-600/30' : style.progress
                            }`}
                            style={{ width: `${card.percentage}%` }}
                          />
                        </div>

                        {/* Warnings/Alerts */}
                        {isOver80 ? (
                          <div className="flex items-center gap-1.5 text-[10px] text-rose-400 font-medium pt-1 animate-pulse">
                            <AlertTriangle className="w-3.5 h-3.5" />
                            <span>Cota crítica. Resta menos de 20% do limite mensal.</span>
                          </div>
                        ) : (
                          <div className="text-[10px] text-slate-500 pt-1">
                            Uso normal do recurso neste mês.
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Test Environment Banner */}
          <div className="flex items-start gap-4 p-5 bg-indigo-500/5 border border-indigo-500/15 rounded-xl text-indigo-400">
            <Info className="w-5 h-5 shrink-0 mt-0.5" />
            <div>
              <h4 className="font-bold text-sm">Ambiente de Testes & Homologação</h4>
              <p className="text-xs text-slate-400 leading-relaxed mt-1">
                O PresençaFlow está em modo de demonstração nesta sprint. A integração com meios de pagamentos reais (como gateways Stripe, Asaas ou PIX) e a cobrança automática em faturas não estão habilitadas. O painel serve para validação dos limites de assinaturas do SaaS.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
