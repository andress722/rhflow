'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { trackEvent } from '@/lib/telemetry';
import { api } from '@/lib/api';
import {
  CheckCircle2,
  Circle,
  ArrowRight,
  Settings,
  CreditCard,
  UserCheck,
  Calendar,
  Users,
  MessageSquare,
  Send,
  BarChart3,
  RefreshCw,
  PartyPopper,
  Building,
  AlertTriangle,
  XCircle,
  Award,
  FileText,
  Check,
  Play,
  HelpCircle,
  TrendingUp,
  ClipboardList
} from 'lucide-react';

export default function OnboardingChecklistPage() {
  const [checklist, setChecklist] = useState<any[]>([]);
  const [loadingChecklist, setLoadingChecklist] = useState(true);
  const [checklistError, setChecklistError] = useState<string | null>(null);
  const [checklistRequestId, setChecklistRequestId] = useState<string | null>(null);

  const [readiness, setReadiness] = useState<any>(null);
  const [loadingReadiness, setLoadingReadiness] = useState(true);
  const [readinessError, setReadinessError] = useState<string | null>(null);

  // Manual step toggle state
  const [updatingStep, setUpdatingStep] = useState<string | null>(null);

  // Quick validation test states
  const [runningTest, setRunningTest] = useState(false);
  const [testResult, setTestResult] = useState<any>(null);
  const [testError, setTestError] = useState<string | null>(null);
  const [isTestModalOpen, setIsTestModalOpen] = useState(false);

  const fetchChecklist = async () => {
    setLoadingChecklist(true);
    setChecklistError(null);
    setChecklistRequestId(null);
    try {
      const response = await api.get('/onboarding/checklist') as any;
      if (response && response.success && Array.isArray(response.data)) {
        setChecklist(response.data);
      } else {
        setChecklistError(response?.error?.message || 'Erro ao carregar checklist.');
        setChecklistRequestId(response?.error?.requestId || null);
      }
    } catch (err) {
      setChecklistError('Erro de rede ao carregar o checklist de onboarding.');
    } finally {
      setLoadingChecklist(false);
    }
  };

  const fetchReadiness = async () => {
    setLoadingReadiness(true);
    setReadinessError(null);
    try {
      const response = await api.get('/onboarding/pilot-readiness') as any;
      if (response && response.success) {
        setReadiness(response);
      } else {
        setReadinessError(response?.error?.message || 'Erro ao carregar prontidão.');
      }
    } catch (err) {
      setReadinessError('Erro de rede ao carregar o score de prontidão.');
    } finally {
      setLoadingReadiness(false);
    }
  };

  const handleToggleManualStep = async (key: string, currentStatus: boolean) => {
    if (updatingStep) return;
    setUpdatingStep(key);
    try {
      const response = await api.post('/onboarding/manual-step', {
        key,
        completed: !currentStatus,
        note: `Atualizado via interface de onboarding em ${new Date().toLocaleString()}`
      }) as any;

      if (response && response.success) {
        // Refresh all data
        await Promise.all([fetchChecklist(), fetchReadiness()]);
      } else {
        alert(response?.error?.message || 'Erro ao atualizar etapa manual.');
      }
    } catch (err) {
      alert('Erro de rede ao atualizar etapa manual.');
    } finally {
      setUpdatingStep(null);
    }
  };

  const handleRunPilotTest = async () => {
    if (runningTest) return;
    setRunningTest(true);
    setTestError(null);
    setTestResult(null);
    setIsTestModalOpen(true);
    try {
      const response = await api.post('/onboarding/run-pilot-test', {}) as any;
      setTestResult(response);
    } catch (err: any) {
      setTestError('Erro de rede ao executar o teste de prontidão.');
    } finally {
      setRunningTest(false);
    }
  };

  const refreshAll = () => {
    fetchChecklist();
    fetchReadiness();
  };

  useEffect(() => {
    refreshAll();
    trackEvent('PAGE_VIEW', 'ONBOARDING', { path: '/app/onboarding' });
  }, []);

  const getStepIcon = (key: string) => {
    switch (key) {
      case 'companyProfileCompleted':
        return Building;
      case 'companySettingsConfigured':
      case 'remoteCheckinEnabled':
      case 'medicalCertificatesEnabled':
        return Settings;
      case 'adminUserReady':
      case 'managersAssigned':
        return UserCheck;
      case 'employeesImported':
        return Users;
      case 'schedulesConfigured':
        return Calendar;
      case 'whatsappChannelConfigured':
        return MessageSquare;
      case 'firstRemoteCheckinSent':
        return Send;
      case 'firstOccurrenceCreated':
        return AlertTriangle;
      case 'firstReportViewed':
        return BarChart3;
      case 'kickoff_done':
      case 'customer_trained':
      case 'pilot_approved':
      case 'contract_signed':
      case 'first_week_review_done':
        return ClipboardList;
      case 'pilotReady':
        return Award;
      default:
        return HelpCircle;
    }
  };

  const getStepSection = (key: string): string => {
    switch (key) {
      case 'companyProfileCompleted':
      case 'companySettingsConfigured':
        return 'Empresa';
      case 'adminUserReady':
      case 'managersAssigned':
        return 'Usuários';
      case 'employeesImported':
        return 'Funcionários';
      case 'schedulesConfigured':
        return 'Jornadas';
      case 'whatsappChannelConfigured':
        return 'WhatsApp';
      case 'remoteCheckinEnabled':
      case 'medicalCertificatesEnabled':
        return 'Regras operacionais';
      case 'firstRemoteCheckinSent':
      case 'firstOccurrenceCreated':
      case 'firstReportViewed':
      case 'kickoff_done':
      case 'customer_trained':
      case 'pilot_approved':
      case 'contract_signed':
      case 'first_week_review_done':
        return 'Teste piloto';
      case 'pilotReady':
        return 'Pronto para operar';
      default:
        return 'Geral';
    }
  };

  if (loadingChecklist || loadingReadiness) {
    return (
      <div className="py-16 flex flex-col items-center justify-center gap-3">
        <RefreshCw className="w-8 h-8 text-indigo-500 animate-spin" />
        <span className="text-slate-400 text-sm font-semibold">Carregando dados do onboarding piloto...</span>
      </div>
    );
  }

  if (checklistError) {
    return (
      <div className="py-12 text-center text-red-400 max-w-md mx-auto space-y-4">
        <p className="text-sm font-semibold">{checklistError}</p>
        {checklistRequestId && <p className="text-[10px] text-slate-500 font-mono">ID do erro: {checklistRequestId}</p>}
        <button
          onClick={refreshAll}
          className="px-4 py-2 text-xs font-semibold rounded bg-slate-800 text-slate-300 hover:text-white transition-all cursor-pointer border border-slate-700"
        >
          Tentar Novamente
        </button>
      </div>
    );
  }

  const manualKeys = ['kickoff_done', 'customer_trained', 'pilot_approved', 'contract_signed', 'first_week_review_done'];
  const sections = [
    'Empresa',
    'Usuários',
    'Funcionários',
    'Jornadas',
    'WhatsApp',
    'Regras operacionais',
    'Teste piloto',
    'Pronto para operar'
  ];

  return (
    <div className="space-y-8 max-w-5xl mx-auto pb-12">
      {/* Welcome & Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            Onboarding de Clientes Piloto
          </h1>
          <p className="text-xs text-slate-450 leading-relaxed max-w-2xl">
            Acompanhe o checklist de prontidão, configure as conexões obrigatórias da empresa e valide as regras antes de iniciar o piloto.
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/app/help"
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-indigo-950/30 hover:bg-indigo-900/30 text-indigo-400 border border-indigo-900/40 rounded-lg transition-colors cursor-pointer"
          >
            <HelpCircle className="w-3.5 h-3.5" />
            <span>Ver Manuais</span>
          </Link>
          <button
            onClick={refreshAll}
            className="flex items-center gap-2 px-3 py-1.5 text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg transition-colors cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Atualizar</span>
          </button>
        </div>
      </div>

      {/* Readiness Card & Status */}
      {readiness && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
          {/* Circular Score */}
          <div className="flex flex-col items-center justify-center text-center p-4 border-b lg:border-b-0 lg:border-r border-slate-800">
            <div className="relative w-28 h-28 flex items-center justify-center">
              {/* Outer Circular Track */}
              <svg className="absolute w-full h-full transform -rotate-90">
                <circle
                  cx="56"
                  cy="56"
                  r="48"
                  className="stroke-slate-800"
                  strokeWidth="8"
                  fill="transparent"
                />
                <circle
                  cx="56"
                  cy="56"
                  r="48"
                  className="stroke-indigo-500 transition-all duration-500"
                  strokeWidth="8"
                  fill="transparent"
                  strokeDasharray={2 * Math.PI * 48}
                  strokeDashoffset={2 * Math.PI * 48 * (1 - readiness.score / 100)}
                />
              </svg>
              <div className="flex flex-col items-center justify-center">
                <span className="text-3xl font-extrabold text-white">{readiness.score}%</span>
                <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Readiness</span>
              </div>
            </div>
            <div className="mt-4 space-y-1">
              <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold ${
                readiness.pilotReady
                  ? 'bg-emerald-500/10 text-emerald-450 border border-emerald-500/20'
                  : 'bg-amber-500/10 text-amber-450 border border-amber-500/20'
              }`}>
                {readiness.pilotReady ? (
                  <>
                    <PartyPopper className="w-3.5 h-3.5" />
                    Pronto para Piloto
                  </>
                ) : (
                  <>
                    <AlertTriangle className="w-3.5 h-3.5" />
                    Ainda Pendente
                  </>
                )}
              </span>
            </div>
          </div>

          {/* Blockers & Warnings */}
          <div className="lg:col-span-2 flex flex-col justify-between space-y-4">
            <div className="space-y-3">
              <div>
                <h3 className="text-xs font-bold text-slate-450 uppercase tracking-wider">Recomendação de Ação</h3>
                <p className="text-xs font-semibold text-indigo-400 mt-1">{readiness.nextRecommendedAction}</p>
              </div>

              {/* Blockers List */}
              {readiness.blockers.length > 0 && (
                <div className="space-y-1.5">
                  <h4 className="text-[10px] font-bold text-red-400 uppercase tracking-wider">Bloqueios Críticos ({readiness.blockers.length})</h4>
                  <ul className="space-y-1">
                    {readiness.blockers.map((blocker: string, index: number) => (
                      <li key={index} className="text-xs text-red-450 flex items-start gap-1.5 leading-relaxed">
                        <XCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                        <span>{blocker}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Warnings List */}
              {readiness.warnings.length > 0 && (
                <div className="space-y-1.5">
                  <h4 className="text-[10px] font-bold text-amber-400 uppercase tracking-wider">Alertas Recomendados ({readiness.warnings.length})</h4>
                  <ul className="space-y-1">
                    {readiness.warnings.map((warning: string, index: number) => (
                      <li key={index} className="text-xs text-amber-450 flex items-start gap-1.5 leading-relaxed">
                        <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                        <span>{warning}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            {/* Test Action Trigger */}
            <div className="pt-3 border-t border-slate-800 flex items-center justify-between">
              <span className="text-[11px] text-slate-500">
                Execute validações técnicas de API e storage antes do piloto real.
              </span>
              <button
                type="button"
                onClick={handleRunPilotTest}
                disabled={runningTest}
                className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold bg-indigo-650 hover:bg-indigo-600 disabled:bg-indigo-850 text-white rounded-lg transition-colors cursor-pointer disabled:cursor-not-allowed shadow-md"
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>Testar Prontidão</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Sections & Interactive Checklist */}
      <div className="space-y-6">
        {sections.map((sectionName) => {
          const sectionSteps = checklist.filter((item) => getStepSection(item.key) === sectionName);
          if (sectionSteps.length === 0) return null;

          return (
            <div key={sectionName} className="space-y-3">
              <h3 className="text-xs font-bold text-slate-450 uppercase tracking-wider">{sectionName}</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {sectionSteps.map((step) => {
                  const Icon = getStepIcon(step.key);
                  const isManual = manualKeys.includes(step.key);
                  const isCompleted = step.completed;

                  return (
                    <div
                      key={step.key}
                      className={`p-4 rounded-xl border transition-all flex flex-col justify-between gap-4 ${
                        isCompleted
                          ? 'bg-slate-900/40 border-slate-800/80 text-slate-350'
                          : 'bg-slate-900 border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex gap-4">
                        <div className={`p-2 rounded-lg shrink-0 h-10 w-10 flex items-center justify-center ${
                          isCompleted ? 'bg-indigo-950/20 text-indigo-400' : 'bg-slate-950 text-slate-400'
                        }`}>
                          <Icon className="w-5 h-5" />
                        </div>
                        <div className="space-y-1">
                          <div className="flex items-center gap-1.5">
                            <h4 className={`font-bold text-sm ${isCompleted ? 'text-slate-400 line-through' : 'text-slate-200'}`}>
                              {step.label}
                            </h4>
                            {step.required ? (
                              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-indigo-950/30 text-indigo-400 border border-indigo-900/30 uppercase">
                                Obrigatório
                              </span>
                            ) : (
                              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-slate-850 text-slate-500 border border-slate-800 uppercase">
                                Opcional
                              </span>
                            )}
                          </div>
                          <p className="text-slate-550 text-xs leading-relaxed">{step.description}</p>
                        </div>
                      </div>

                      {/* Footer: status and buttons */}
                      <div className="flex items-center justify-between border-t border-slate-850 pt-3">
                        <div className="flex items-center gap-1.5">
                          {isCompleted ? (
                            <>
                              <CheckCircle2 className="w-4 h-4 text-emerald-450" />
                              <span className="text-emerald-450 text-xs font-semibold">Concluído</span>
                            </>
                          ) : (
                            <>
                              <Circle className="w-4 h-4 text-slate-750" />
                              <span className="text-slate-500 text-xs font-semibold">Pendente</span>
                            </>
                          )}
                        </div>

                        {/* Trigger action or manual checkbox */}
                        {isManual ? (
                          <button
                            type="button"
                            disabled={updatingStep === step.key}
                            onClick={() => handleToggleManualStep(step.key, step.completed)}
                            className={`flex items-center gap-1 px-3 py-1.5 rounded text-xs font-semibold transition-all cursor-pointer ${
                              isCompleted
                                ? 'bg-slate-800 hover:bg-slate-750 text-slate-350 border border-slate-700'
                                : 'bg-indigo-650 hover:bg-indigo-600 text-white shadow shadow-indigo-650/10'
                            }`}
                          >
                            {updatingStep === step.key ? (
                              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                            ) : isCompleted ? (
                              <span>Reabrir</span>
                            ) : (
                              <span>Concluir</span>
                            )}
                          </button>
                        ) : (
                          !isCompleted && (
                            <Link
                              href={step.actionUrl}
                              className="inline-flex items-center gap-1 px-3 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold transition-all cursor-pointer"
                            >
                              <span>Configurar</span>
                              <ArrowRight className="w-3.5 h-3.5" />
                            </Link>
                          )
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Validation Test Modal */}
      {isTestModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col">
            {/* Modal Header */}
            <div className="p-4 border-b border-slate-800 flex items-center justify-between">
              <h3 className="font-bold text-white flex items-center gap-2">
                <Play className="w-4 h-4 fill-current text-indigo-400" />
                <span>Resultado do Teste de Prontidão</span>
              </h3>
              <button
                type="button"
                onClick={() => setIsTestModalOpen(false)}
                className="text-slate-400 hover:text-white transition-colors cursor-pointer text-xs font-bold bg-slate-800 px-2.5 py-1 rounded-md border border-slate-700"
              >
                Fechar
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 overflow-y-auto max-h-[60vh] space-y-4">
              {runningTest ? (
                <div className="py-12 flex flex-col items-center justify-center gap-3">
                  <RefreshCw className="w-8 h-8 text-indigo-500 animate-spin" />
                  <span className="text-slate-400 text-sm">Executando verificações técnicas de storage e APIs...</span>
                </div>
              ) : testError ? (
                <div className="p-4 bg-red-950/20 border border-red-800/40 rounded-xl text-red-400 text-xs">
                  {testError}
                </div>
              ) : testResult ? (
                <div className="space-y-4">
                  {/* Status Banner */}
                  <div className={`p-4 rounded-xl border flex items-center gap-3 ${
                    testResult.success
                      ? 'bg-emerald-950/20 border-emerald-800/40 text-emerald-450'
                      : 'bg-red-950/20 border-red-800/40 text-red-450'
                  }`}>
                    {testResult.success ? (
                      <CheckCircle2 className="w-6 h-6 shrink-0" />
                    ) : (
                      <XCircle className="w-6 h-6 shrink-0" />
                    )}
                    <div>
                      <h4 className="font-bold text-sm">
                        {testResult.success ? 'Validação Concluída com Sucesso!' : 'Pendências Críticas Identificadas'}
                      </h4>
                      <p className="text-xs text-slate-350 mt-0.5">
                        {testResult.success
                          ? 'Todos os módulos operacionais obrigatórios estão prontos.'
                          : 'Corrija os impedimentos listados abaixo antes do lançamento.'}
                      </p>
                    </div>
                  </div>

                  {/* Checklist Result details */}
                  <div className="space-y-2">
                    <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Verificações de Diagnóstico</h4>
                    <div className="space-y-2">
                      {testResult.checks?.map((check: any, index: number) => {
                        const isOk = check.status === 'ok';
                        const isWarning = check.status === 'warning';
                        return (
                          <div key={index} className="p-3 bg-slate-950/40 border border-slate-850 rounded-lg flex items-center justify-between gap-3">
                            <div className="space-y-0.5">
                              <span className="text-xs font-bold text-slate-200 block">{check.message}</span>
                              <span className="text-[10px] text-slate-500 font-mono">Verificação: {check.name}</span>
                            </div>
                            <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-[10px] font-bold uppercase border ${
                              isOk
                                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                                : isWarning
                                ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                                : 'bg-red-500/10 text-red-400 border-red-500/20'
                            }`}>
                              {check.status}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              ) : null}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-800 bg-slate-950/30 flex justify-end">
              <button
                type="button"
                onClick={() => setIsTestModalOpen(false)}
                className="px-4 py-2 text-xs font-bold bg-slate-800 hover:bg-slate-750 text-white rounded-lg border border-slate-700 transition-all cursor-pointer"
              >
                Concluir Diagnóstico
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
