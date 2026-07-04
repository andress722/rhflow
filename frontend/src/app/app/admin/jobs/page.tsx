'use client';

import React, { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import {
  Zap,
  RefreshCw,
  Cpu,
  CheckCircle,
  AlertTriangle,
  Play,
  Clock,
  ChevronRight,
  ShieldAlert,
  Info,
  Calendar,
  X
} from 'lucide-react';

export default function JobsPage() {
  const [jobs, setJobs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [triggeringKey, setTriggeringKey] = useState<string | null>(null);
  
  // Drawer states
  const [selectedJob, setSelectedJob] = useState<any | null>(null);
  const [drawerLoading, setDrawerLoading] = useState(false);
  const [drawerDetails, setDrawerDetails] = useState<any | null>(null);

  const fetchJobs = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get('/admin/jobs') as any;
      if (res && res.success) {
        setJobs(res.data);
      } else {
        setError(res?.error?.message || 'Erro ao buscar rotinas.');
      }
    } catch (e) {
      setError('Erro de rede ao buscar status das rotinas.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchJobs();
  }, []);

  const handleRunJob = async (jobKey: string) => {
    setTriggeringKey(jobKey);
    try {
      const res = await api.post(`/admin/jobs/${jobKey}/run`, {}) as any;
      alert(`Job ${jobKey} disparado manualmente. Sucesso: ${res.success}`);
      fetchJobs();
      if (selectedJob && selectedJob.key === jobKey) {
        openJobDetails(selectedJob);
      }
    } catch (e: any) {
      alert(`Erro ao executar job: ${e.response?.data?.error?.message || e.message}`);
    } finally {
      setTriggeringKey(null);
    }
  };

  const openJobDetails = async (job: any) => {
    setSelectedJob(job);
    setDrawerLoading(true);
    setDrawerDetails(null);
    try {
      const res = await api.get(`/admin/jobs/${job.jobKey}`) as any;
      if (res && res.success) {
        setDrawerDetails(res.data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setDrawerLoading(false);
    }
  };

  const closeDrawer = () => {
    setSelectedJob(null);
    setDrawerDetails(null);
  };

  // Math stats
  const healthyCount = jobs.filter(j => !j.isOverdue && j.lastStatus !== 'FAILED').length;
  const criticalOverdueCount = jobs.filter(j => j.isCritical && j.isOverdue).length;

  const isManualRunAllowed = (key: string) => {
    return ['COMMERCIAL_ALERTS', 'RETENTION_ALERTS', 'INTERNAL_PING', 'CLEANUP_OLD_LOGS'].includes(key);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'SUCCESS':
        return <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/25 px-2 py-0.5 rounded text-[10px] font-bold">SUCCESS</span>;
      case 'FAILED':
        return <span className="bg-rose-500/10 text-rose-400 border border-rose-500/25 px-2 py-0.5 rounded text-[10px] font-bold">FAILED</span>;
      case 'SKIPPED':
        return <span className="bg-slate-500/10 text-slate-400 border border-slate-500/25 px-2 py-0.5 rounded text-[10px] font-bold">SKIPPED</span>;
      case 'RUNNING':
        return <span className="bg-amber-500/10 text-amber-400 border border-amber-500/25 px-2 py-0.5 rounded text-[10px] font-bold animate-pulse">RUNNING</span>;
      default:
        return <span className="bg-slate-800 text-slate-400 px-2 py-0.5 rounded text-[10px] font-bold">NEVER RUN</span>;
    }
  };

  return (
    <div className="space-y-8 relative">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight flex items-center gap-3">
            <Cpu className="w-8 h-8 text-indigo-500" />
            <span>Rotinas e Jobs Programados</span>
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            Governança de execuções automatizadas em lote do PresençaFlow RH.
          </p>
        </div>
        <button
          onClick={fetchJobs}
          className="flex items-center gap-2 px-4 py-2 bg-slate-900 border border-slate-800 text-slate-200 hover:text-white hover:bg-slate-800 rounded-lg text-sm font-medium transition-all self-start md:self-auto"
        >
          <RefreshCw className="w-4 h-4 animate-hover" />
          <span>Sincronizar Rotinas</span>
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

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 flex items-center justify-between shadow-lg">
          <div>
            <span className="text-slate-400 text-xs font-semibold uppercase tracking-wider">Jobs Saudáveis</span>
            <h3 className="text-3xl font-bold text-emerald-400 mt-2">{healthyCount} <span className="text-xs text-slate-500">/ {jobs.length}</span></h3>
          </div>
          <CheckCircle className="w-8 h-8 text-emerald-500/20" />
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 flex items-center justify-between shadow-lg">
          <div>
            <span className="text-slate-400 text-xs font-semibold uppercase tracking-wider">Críticos Atrasados</span>
            <h3 className="text-3xl font-bold text-rose-500 mt-2">{criticalOverdueCount}</h3>
          </div>
          <AlertTriangle className="w-8 h-8 text-rose-500/20" />
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 flex items-center justify-between shadow-lg">
          <div>
            <span className="text-slate-400 text-xs font-semibold uppercase tracking-wider">Frequência Ativa</span>
            <h3 className="text-3xl font-bold text-indigo-400 mt-2">100%</h3>
          </div>
          <Clock className="w-8 h-8 text-indigo-500/20" />
        </div>
      </div>

      {loading ? (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-20 flex flex-col items-center justify-center gap-3">
          <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
          <span className="text-sm text-slate-400 font-medium font-sans">Compilando status das rotinas automáticas...</span>
        </div>
      ) : (
        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-lg">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-950/40 text-slate-450 text-xs font-bold font-sans uppercase">
                  <th className="p-4">Rotina / Descrição</th>
                  <th className="p-4">Criticidade</th>
                  <th className="p-4">Frequência</th>
                  <th className="p-4">Última Execução</th>
                  <th className="p-4">Status de Atraso</th>
                  <th className="p-4 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-850 text-sm">
                {jobs.map((job) => (
                  <tr key={job.jobKey} className="hover:bg-slate-950/20 transition-colors">
                    <td className="p-4 max-w-sm">
                      <div className="font-bold text-white text-base">{job.label}</div>
                      <div className="text-xs text-slate-400 mt-1">{job.description}</div>
                    </td>
                    <td className="p-4">
                      {job.isCritical ? (
                        <span className="bg-rose-500/10 text-rose-400 border border-rose-500/25 px-2 py-0.5 rounded text-[10px] font-extrabold uppercase">CRÍTICO</span>
                      ) : (
                        <span className="bg-slate-800 text-slate-400 px-2 py-0.5 rounded text-[10px] font-bold uppercase">PADRÃO</span>
                      )}
                    </td>
                    <td className="p-4">
                      <div className="text-xs text-slate-200">{job.expectedFrequency}</div>
                      <div className="font-mono text-[10px] text-slate-500 mt-0.5">{job.recommendedSchedule}</div>
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-2">
                        {getStatusBadge(job.lastStatus)}
                        {job.lastRunAt && (
                          <div className="text-xs text-slate-400">
                            {new Date(job.lastRunAt).toLocaleTimeString('pt-BR')} ({Math.round(job.lastDurationMs || 0)}ms)
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="p-4">
                      {job.isOverdue ? (
                        <span className="text-rose-400 font-semibold text-xs flex items-center gap-1.5">
                          <AlertTriangle className="w-3.5 h-3.5 text-rose-450" />
                          <span>ATRASADO</span>
                        </span>
                      ) : (
                        <span className="text-emerald-400 font-semibold text-xs flex items-center gap-1.5">
                          <CheckCircle className="w-3.5 h-3.5 text-emerald-450" />
                          <span>PONTUAL</span>
                        </span>
                      )}
                    </td>
                    <td className="p-4 text-right">
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => openJobDetails(job)}
                          className="px-3 py-1.5 bg-slate-950 hover:bg-slate-850 border border-slate-850 text-slate-300 hover:text-white rounded text-xs transition-colors font-semibold"
                        >
                          Histórico
                        </button>
                        {isManualRunAllowed(job.jobKey) ? (
                          <button
                            onClick={() => handleRunJob(job.jobKey)}
                            disabled={triggeringKey === job.jobKey}
                            className="px-3 py-1.5 bg-indigo-650 hover:bg-indigo-600 disabled:bg-slate-800 text-white rounded text-xs transition-colors font-semibold flex items-center gap-1"
                          >
                            {triggeringKey === job.jobKey ? (
                              <RefreshCw className="w-3 h-3 animate-spin" />
                            ) : (
                              <Play className="w-3 h-3 fill-current" />
                            )}
                            <span>Executar</span>
                          </button>
                        ) : (
                          <button
                            disabled
                            title="Apenas agendador automático permitido para este job operacional"
                            className="px-3 py-1.5 bg-slate-800 text-slate-500 rounded text-xs font-semibold flex items-center gap-1 cursor-not-allowed"
                          >
                            Auto Only
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Details Drawer */}
      {selectedJob && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex justify-end transition-opacity">
          <div className="w-full max-w-2xl bg-slate-900 border-l border-slate-800 h-full p-8 overflow-y-auto space-y-6 flex flex-col justify-between shadow-2xl">
            <div>
              <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                <div>
                  <h3 className="text-xl font-bold text-white">{selectedJob.label}</h3>
                  <span className="text-xs text-slate-400 font-mono">{selectedJob.jobKey}</span>
                </div>
                <button onClick={closeDrawer} className="text-slate-400 hover:text-white transition-colors">
                  <X className="w-6 h-6" />
                </button>
              </div>

              {drawerLoading ? (
                <div className="py-20 flex flex-col items-center justify-center gap-3">
                  <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
                  <span className="text-sm text-slate-400 font-sans">Buscando análises 7d...</span>
                </div>
              ) : drawerDetails ? (
                <div className="space-y-6 mt-6">
                  {/* Analytic Stats Row */}
                  <div className="grid grid-cols-3 gap-4">
                    <div className="bg-slate-950 border border-slate-850 rounded-xl p-4">
                      <span className="text-xs text-slate-500 font-medium">Taxa de Sucesso (7d)</span>
                      <h4 className="text-2xl font-bold text-emerald-450 mt-1">{drawerDetails.successRate7d}%</h4>
                    </div>
                    <div className="bg-slate-950 border border-slate-850 rounded-xl p-4">
                      <span className="text-xs text-slate-500 font-medium">Duração Média (7d)</span>
                      <h4 className="text-2xl font-bold text-indigo-400 mt-1">{drawerDetails.avgDurationMs7d}ms</h4>
                    </div>
                    <div className="bg-slate-950 border border-slate-850 rounded-xl p-4">
                      <span className="text-xs text-slate-500 font-medium">Falhas (7d)</span>
                      <h4 className="text-2xl font-bold text-rose-500 mt-1">{drawerDetails.failures7d}</h4>
                    </div>
                  </div>

                  {/* Last Runs List */}
                  <div className="space-y-3">
                    <span className="text-sm font-bold text-slate-350 block">Últimas Execuções</span>
                    
                    {drawerDetails.lastRuns.length === 0 ? (
                      <div className="py-6 text-center text-slate-500 text-xs border border-dashed border-slate-800 rounded-xl">
                        Nenhuma execução encontrada.
                      </div>
                    ) : (
                      <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                        {drawerDetails.lastRuns.map((run: any) => (
                          <div key={run.id} className="bg-slate-950/60 border border-slate-850 rounded-lg p-3 text-xs space-y-1.5">
                            <div className="flex justify-between items-center">
                              <span className="font-mono text-slate-450">{new Date(run.startedAt).toLocaleString('pt-BR')}</span>
                              <div className="flex items-center gap-1.5">
                                <span className="text-[10px] bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded uppercase font-semibold">
                                  {run.triggeredBy}
                                </span>
                                {getStatusBadge(run.status)}
                              </div>
                            </div>
                            <div className="flex justify-between text-slate-500">
                              <span>Duração: {run.durationMs || 0}ms</span>
                              <span className="font-mono text-[10px]">ReqId: {run.requestId ? run.requestId.slice(0, 8) : 'N/A'}</span>
                            </div>
                            {run.errorMessage && (
                              <div className="bg-rose-950/10 border border-rose-950/20 text-rose-400 p-2 rounded text-[11px] font-mono whitespace-pre-wrap break-all mt-1">
                                {run.errorMessage}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="py-20 text-center text-slate-500">Erro ao carregar dados do job.</div>
              )}
            </div>

            {/* Bottom Safe Instructions */}
            <div className="bg-slate-950 border border-slate-850 rounded-xl p-4 flex gap-3 text-xs">
              <Info className="w-5 h-5 text-indigo-400 shrink-0 mt-0.5" />
              <div className="text-slate-400">
                <span className="font-bold text-white block">Governança de Logs de Agendamento</span>
                Os históricos e logs são sanitizados em tempo real. Nenhuma chave secreta ou parâmetro sensível de colaborador é salvo nos summaries.
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
