'use client';

import React, { useState, useEffect } from 'react';
import { trackEvent } from '@/lib/telemetry';
import Link from 'next/link';
import {
  Activity,
  Play,
  Search,
  Filter,
  Calendar,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Info,
  Clock,
  Loader2,
  ExternalLink,
  HelpCircle,
  MessageSquare,
  Users,
  Settings,
  AlertTriangle,
  Sparkles,
} from 'lucide-react';
import { api } from '@/lib/api';
import { getUser } from '@/lib/auth';
import PlanErrorAlert from '@/components/PlanErrorAlert';

const STATUS_LABELS = {
  PENDING: 'Pendente',
  CONFIRMED: 'Confirmado',
  LATE: 'Atrasado',
  ABSENCE_REPORTED: 'Falta Reportada',
  ISSUE_REPORTED: 'Instabilidade',
  NOT_RESPONDED: 'Sem Resposta',
};

const STATUS_THEMES: Record<string, { badge: string; text: string; bg: string; border: string }> = {
  PENDING: {
    badge: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20',
    text: 'text-indigo-400',
    bg: 'bg-indigo-500/5',
    border: 'border-indigo-500/15',
  },
  CONFIRMED: {
    badge: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    text: 'text-emerald-400',
    bg: 'bg-emerald-500/5',
    border: 'border-emerald-500/15',
  },
  LATE: {
    badge: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    text: 'text-amber-400',
    bg: 'bg-amber-500/5',
    border: 'border-amber-500/15',
  },
  ABSENCE_REPORTED: {
    badge: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
    text: 'text-rose-400',
    bg: 'bg-rose-500/5',
    border: 'border-rose-500/15',
  },
  ISSUE_REPORTED: {
    badge: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
    text: 'text-orange-400',
    bg: 'bg-orange-500/5',
    border: 'border-orange-500/15',
  },
  NOT_RESPONDED: {
    badge: 'bg-slate-800 text-slate-400 border-slate-700',
    text: 'text-slate-400',
    bg: 'bg-slate-800/10',
    border: 'bg-slate-800/20',
  },
};

export default function PresencePage() {
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [checkins, setCheckins] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [managers, setManagers] = useState<any[]>([]);
  const [schedules, setSchedules] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [planError, setPlanError] = useState<string | null>(null);

  // Extended Summary state
  const [summary, setSummary] = useState({
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

  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'success'>('idle');
  const [isOnline, setIsOnline] = useState(true);
  const [companySettings, setCompanySettings] = useState<any>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [selectedDate, setSelectedDate] = useState('');
  
  // Extended filters
  const [filterManagerId, setFilterManagerId] = useState('');
  const [filterSector, setFilterSector] = useState('');
  const [filterWorkModel, setFilterWorkModel] = useState('');

  // Automation Modal - Individual
  const [isTriggerOpen, setIsTriggerOpen] = useState(false);
  const [triggerEmployeeId, setTriggerEmployeeId] = useState('');
  const [isTriggering, setIsTriggering] = useState(false);
  const [triggerError, setTriggerError] = useState('');
  const [triggerErrorRequestId, setTriggerErrorRequestId] = useState<string | null>(null);

  // Automation Modal - Batch
  const [isBatchOpen, setIsBatchOpen] = useState(false);
  const [batchWorkModel, setBatchWorkModel] = useState('');
  const [batchScheduleId, setBatchScheduleId] = useState('');
  const [batchSector, setBatchSector] = useState('');
  const [batchManagerId, setBatchManagerId] = useState('');
  const [batchResult, setBatchResult] = useState<any>(null);
  const [isResultOpen, setIsResultOpen] = useState(false);
  const [batchErrorRequestId, setBatchErrorRequestId] = useState<string | null>(null);

  // Automation Modal - Mark Not Responded
  const [isMarkOpen, setIsMarkOpen] = useState(false);
  const [graceMinutes, setGraceMinutes] = useState(30);
  const [isMarking, setIsMarking] = useState(false);
  const [markError, setMarkError] = useState('');
  const [markErrorRequestId, setMarkErrorRequestId] = useState<string | null>(null);

  // Simulation Modal - Response
  const [isSimulateOpen, setIsSimulateOpen] = useState(false);
  const [simulateCheckinId, setSimulateCheckinId] = useState('');
  const [simulateMessage, setSimulateMessage] = useState('1');
  const [simulateGPS, setSimulateGPS] = useState(false);
  const [simulateSelfie, setSimulateSelfie] = useState(false);
  const [isSimulating, setIsSimulating] = useState(false);
  const [simulateError, setSimulateError] = useState('');

  useEffect(() => {
    const user = getUser();
    setCurrentUser(user);

    const today = new Date();
    const offset = today.getTimezoneOffset();
    const localToday = new Date(today.getTime() - offset * 60 * 1000);
    const dateStr = localToday.toISOString().split('T')[0];
    setSelectedDate(dateStr);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    setIsOnline(navigator.onLine);

    const handleOnline = async () => {
      setIsOnline(true);
      const queue = JSON.parse(localStorage.getItem('presence_offline_queue') || '[]');
      if (queue.length > 0) {
        setSyncStatus('syncing');
        try {
          for (const item of queue) {
            await api.post(`/presence/${item.checkinId}/simulate-response`, item.payload);
          }
          localStorage.removeItem('presence_offline_queue');
          setSyncStatus('success');
          setTimeout(() => setSyncStatus('idle'), 4000);
          fetchData();
        } catch (err) {
          console.error('Error syncing offline queue:', err);
          setSyncStatus('idle');
        }
      }
    };

    const handleOffline = () => {
      setIsOnline(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  useEffect(() => {
    if (selectedDate !== '') {
      fetchData();
      trackEvent('PAGE_VIEW', 'PRESENCE', { path: '/app/presence' });
    }
  }, [selectedDate, statusFilter, filterManagerId, filterSector, filterWorkModel]);

  const fetchData = async () => {
    setIsLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      if (selectedDate) params.append('date', selectedDate);
      if (statusFilter) params.append('status', statusFilter);
      if (filterManagerId) params.append('managerUserId', filterManagerId);
      if (filterSector) params.append('sector', filterSector);
      if (filterWorkModel) params.append('workModel', filterWorkModel);

      // 1. Fetch checkins
      const checkinRes = await api.get(`/presence?${params.toString()}`);
      if (checkinRes.success) {
        setCheckins(checkinRes.data || []);
      } else {
        setError(checkinRes.error?.message || 'Erro ao carregar registros de presença.');
      }

      const settingsRes: any = await api.get('/company-settings');
      if (settingsRes.success) {
        setCompanySettings(settingsRes.data);
      }

      // 2. Fetch summary (pass date for calendar metrics)
      const sumParams = new URLSearchParams();
      if (selectedDate) sumParams.append('date', selectedDate);
      const sumRes = await api.get(`/presence/summary?${sumParams.toString()}`);
      if (sumRes.success) {
        setSummary(sumRes.data);
      }

      // 3. Fetch auxiliary entities (only if Admin/HR for filter options and trigger dialogs)
      const empRes = await api.get('/employees');
      if (empRes.success) {
        setEmployees((empRes.data || []).filter((e: any) => e.status === 'ACTIVE'));
      }

      const usersRes = await api.get('/users');
      if (usersRes.success) {
        setManagers((usersRes.data || []).filter((u: any) => u.role === 'MANAGER'));
      }

      const schRes = await api.get('/work-schedules');
      if (schRes.success) {
        setSchedules(schRes.data || []);
      }
    } catch (err) {
      setError('Erro de conexão ao carregar dados de presença.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleTriggerCheckin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!triggerEmployeeId) return;
    if (isTriggering) return;

    setIsTriggering(true);
    setTriggerError('');
    setTriggerErrorRequestId(null);

    try {
      const res = await api.post('/automations/remote-checkin/run', {
        employeeId: triggerEmployeeId,
      });

      if (res.success) {
        if ((res as any).isDuplicate) {
          alert('Este funcionário já possui uma solicitação de check-in activa hoje.');
        } else {
          alert('Solicitação de check-in remoto disparada com sucesso!');
        }
        setIsTriggerOpen(false);
        setTriggerEmployeeId('');
        fetchData();
      } else {
        const errCode = res.error?.code || res.error || (res as any).error;
        if (['PLAN_LIMIT_EXCEEDED', 'PLAN_FEATURE_DISABLED', 'FEATURE_DISABLED', 'FORBIDDEN'].includes(errCode)) {
          setPlanError(errCode);
          setIsTriggerOpen(false);
        } else {
          setTriggerError(res.error?.message || 'Erro ao disparar check-in.');
          if (res.error?.requestId) {
            setTriggerErrorRequestId(res.error.requestId);
          }
        }
      }
    } catch (err) {
      setTriggerError('Erro de conexão com o servidor.');
    } finally {
      setIsTriggering(false);
    }
  };

  const handleOpenSimulateModal = (checkinId: string) => {
    setSimulateCheckinId(checkinId);
    setSimulateMessage('1');
    setSimulateGPS(false);
    setSimulateSelfie(false);
    setSimulateError('');
    setIsSimulateOpen(true);
  };

  const handleSimulateResponse = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSimulating(true);
    setSimulateError('');

    let payload: any = {
      message: simulateMessage === '1' ? '1. Sim, iniciei agora' :
               simulateMessage === '2' ? '2. Vou iniciar mais tarde' :
               simulateMessage === '3' ? '3. Estou com problema técnico' :
               simulateMessage === '4' ? '4. Vou faltar' : '5. Estou de atestado',
    };

    if (simulateGPS) {
      payload.latitude = -23.55052;
      payload.longitude = -46.633308;
    }
    if (simulateSelfie) {
      payload.selfieUrl = 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=120&auto=format&fit=crop&q=60';
    }

    if (!isOnline) {
      const offlineQueue = JSON.parse(localStorage.getItem('presence_offline_queue') || '[]');
      offlineQueue.push({ checkinId: simulateCheckinId, payload });
      localStorage.setItem('presence_offline_queue', JSON.stringify(offlineQueue));

      setIsSimulateOpen(false);
      alert('Você está desconectado do sinal de rede. O registro foi armazenado localmente e será sincronizado quando a conexão retornar.');
      setIsSimulating(false);
      return;
    }

    try {
      const res = await api.post(`/presence/${simulateCheckinId}/simulate-response`, payload);
      if (res.success) {
        setIsSimulateOpen(false);
        fetchData();
      } else {
        setSimulateError(res.error?.message || 'Erro ao simular resposta.');
      }
    } catch (err) {
      setSimulateError('Erro de conexão ao simular resposta.');
    } finally {
      setIsSimulating(false);
    }
  };

  const handleTriggerBatch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isTriggering) return;
    setIsTriggering(true);
    setTriggerError('');
    setBatchErrorRequestId(null);

    try {
      const res = await api.post('/automations/remote-checkin/run-batch', {
        workModel: batchWorkModel || undefined,
        workScheduleId: batchScheduleId || undefined,
        sector: batchSector || undefined,
        managerUserId: batchManagerId || undefined,
      });

      if (res.success) {
        setBatchResult(res);
        setIsResultOpen(true);
        setIsBatchOpen(false);
        // Reset inputs
        setBatchWorkModel('');
        setBatchScheduleId('');
        setBatchSector('');
        setBatchManagerId('');
        fetchData();
      } else {
        const errCode = res.error?.code || res.error || (res as any).error;
        if (['PLAN_LIMIT_EXCEEDED', 'PLAN_FEATURE_DISABLED', 'FEATURE_DISABLED', 'FORBIDDEN'].includes(errCode)) {
          setPlanError(errCode);
          setIsBatchOpen(false);
        } else {
          setTriggerError(res.error?.message || 'Erro ao disparar lote.');
          if (res.error?.requestId) {
            setBatchErrorRequestId(res.error.requestId);
          }
        }
      }
    } catch (err) {
      setTriggerError('Erro de conexão com o servidor.');
    } finally {
      setIsTriggering(false);
    }
  };

  const handleMarkNotResponded = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isMarking) return;
    setIsMarking(true);
    setMarkError('');
    setMarkErrorRequestId(null);

    try {
      const res = await api.post('/automations/remote-checkin/mark-not-responded', {
        date: selectedDate || undefined,
        graceMinutes: Number(graceMinutes),
      });

      if (res.success) {
        alert(`Marcação concluída! Foram atualizados ${(res as any).updated || 0} check-ins para "Sem Resposta" e geradas as ocorrências correspondentes.`);
        setIsMarkOpen(false);
        fetchData();
      } else {
        const errCode = res.error?.code || res.error || (res as any).error;
        if (['PLAN_LIMIT_EXCEEDED', 'PLAN_FEATURE_DISABLED', 'FEATURE_DISABLED', 'FORBIDDEN'].includes(errCode)) {
          setPlanError(errCode);
          setIsMarkOpen(false);
        } else {
          setMarkError(res.error?.message || 'Erro ao marcar sem resposta.');
          if (res.error?.requestId) {
            setMarkErrorRequestId(res.error.requestId);
          }
        }
      }
    } catch (err) {
      setMarkError('Erro de conexão com o servidor.');
    } finally {
      setIsMarking(false);
    }
  };

  const getElapsedTime = (sentAtStr: string) => {
    const sentAt = new Date(sentAtStr);
    const diffMs = Date.now() - sentAt.getTime();
    const diffMin = Math.floor(diffMs / (1000 * 60));
    if (diffMin < 1) return 'enviado agora';
    if (diffMin < 60) return `enviado há ${diffMin} min`;
    const diffHr = Math.floor(diffMin / 60);
    return `enviado há ${diffHr}h ${diffMin % 60}m`;
  };

  const isRoleAuthorized = currentUser && ['ADMIN', 'HR'].includes(currentUser.role);

  const filteredCheckins = checkins.filter((c) => {
    return c.employee?.fullName.toLowerCase().includes(searchQuery.toLowerCase());
  });

  // Unique sectors from employees list for the filters
  const sectors = Array.from(new Set(employees.map((e) => e.sector).filter(Boolean)));

  return (
    <>
      {/* Offline Flashing Banner Alert */}
      {!isOnline && (
        <div className="mb-6 p-4 rounded-xl bg-red-950/20 border border-red-900/30 text-red-405 text-xs flex gap-2 items-center animate-pulse shadow-lg">
          <AlertTriangle className="w-5 h-5 text-red-500 shrink-0" />
          <div className="space-y-0.5">
            <h4 className="font-bold text-white uppercase text-[10px]">Sem Conexão com a Internet</h4>
            <p className="text-slate-400 text-[11px] leading-relaxed">
              Modo de Emergência offline ativo. Registros efetuados serão armazenados localmente e sincronizados de forma transparente assim que restabelecer a rede.
            </p>
          </div>
        </div>
      )}

      {syncStatus === 'syncing' && (
        <div className="mb-6 p-4 rounded-xl bg-indigo-950/20 border border-indigo-500/30 text-indigo-400 text-xs flex gap-2.5 items-center animate-fadeIn shadow-lg">
          <Loader2 className="w-5 h-5 text-indigo-400 animate-spin shrink-0" />
          <div className="space-y-0.5">
            <h4 className="font-bold text-white uppercase text-[10px]">Restabelecendo Conexão</h4>
            <p className="text-slate-400 text-[11px] leading-relaxed">
              Sincronizando registros offline acumulados de forma segura...
            </p>
          </div>
        </div>
      )}

      {syncStatus === 'success' && (
        <div className="mb-6 p-4 rounded-xl bg-emerald-950/20 border border-emerald-500/30 text-emerald-400 text-xs flex gap-2.5 items-center animate-fadeIn shadow-lg">
          <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
          <div className="space-y-0.5">
            <h4 className="font-bold text-white uppercase text-[10px]">Sincronização Concluída</h4>
            <p className="text-slate-450 text-[11px] leading-relaxed">
              Seus registros offline acumulados foram transmitidos com sucesso ao servidor!
            </p>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white flex items-center gap-3">
            <Activity className="w-8 h-8 text-indigo-500" />
            Check-in Remoto & Presença
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            Gestão operacional em lote, automação de escalonamento e acompanhamento de respostas.
          </p>
        </div>

        <div className="flex gap-2">
          <Link
            href="/app/help"
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-indigo-950/30 hover:bg-indigo-900/30 text-indigo-400 border border-indigo-900/40 text-xs font-semibold transition-all cursor-pointer"
          >
            <HelpCircle className="w-3.5 h-3.5" />
            <span>Ver Manuais</span>
          </Link>
          {isRoleAuthorized && (
            <>
              <button
                onClick={() => setIsMarkOpen(true)}
                className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-slate-800 hover:bg-slate-750 text-slate-350 hover:text-white font-semibold border border-slate-700 transition-all text-sm cursor-pointer"
              >
                <Clock className="w-4 h-4" />
                Marcar Sem Resposta
              </button>
              <button
                onClick={() => setIsTriggerOpen(true)}
                className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-slate-800 hover:bg-slate-750 text-slate-300 font-semibold border border-slate-700 transition-all text-sm cursor-pointer"
              >
                <Users className="w-4 h-4" />
                Disparar Individual
              </button>
              <button
                onClick={() => setIsBatchOpen(true)}
                className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold shadow shadow-indigo-600/10 transition-all text-sm cursor-pointer"
              >
                <Play className="w-4 h-4 fill-current" />
                Disparar em Lote
              </button>
            </>
          )}
        </div>
      </div>

      {/* Main Stats Rows */}
      <div className="space-y-4">
        {/* Row 1: Global batch summaries */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="p-6 rounded-xl bg-slate-900 border border-slate-800 shadow-lg flex items-center justify-between">
            <div>
              <span className="text-xs font-bold text-slate-500 uppercase">Check-ins Enviados Hoje</span>
              <p className="text-4xl font-extrabold text-white mt-2 tracking-tight">{summary.sentToday}</p>
            </div>
            <div className="p-3 bg-indigo-500/10 rounded-lg text-indigo-400">
              <Activity className="w-6 h-6 animate-pulse" />
            </div>
          </div>
          <div className="p-6 rounded-xl bg-slate-900 border border-slate-800 shadow-lg flex items-center justify-between">
            <div>
              <span className="text-xs font-bold text-slate-500 uppercase">Taxa de Resposta</span>
              <p className="text-4xl font-extrabold text-white mt-2 tracking-tight">{summary.responseRate}%</p>
            </div>
            <div className="p-3 bg-emerald-500/10 rounded-lg text-emerald-400">
              <CheckCircle2 className="w-6 h-6" />
            </div>
          </div>
          <div className="p-6 rounded-xl bg-slate-900 border border-slate-800 shadow-lg flex items-center justify-between">
            <div>
              <span className="text-xs font-bold text-slate-500 uppercase">Pendentes Vencidos (Tolerância)</span>
              <p className="text-4xl font-extrabold text-white mt-2 tracking-tight">{summary.notRespondedOverdue}</p>
            </div>
            <div className="p-3 bg-rose-500/10 rounded-lg text-rose-400">
              <AlertCircle className="w-6 h-6 animate-bounce" />
            </div>
          </div>
        </div>

        {/* Row 2: Status Breakdowns */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <div className="p-4 rounded-xl bg-slate-900 border border-indigo-500/15 shadow flex flex-col justify-between">
            <span className="text-[10px] font-bold text-slate-500 uppercase">Pendentes</span>
            <span className="text-2xl font-extrabold text-indigo-400 mt-2">{summary.pending}</span>
          </div>
          <div className="p-4 rounded-xl bg-slate-900 border border-emerald-500/15 shadow flex flex-col justify-between">
            <span className="text-[10px] font-bold text-slate-500 uppercase">Confirmados</span>
            <span className="text-2xl font-extrabold text-emerald-400 mt-2">{summary.confirmed}</span>
          </div>
          <div className="p-4 rounded-xl bg-slate-900 border border-amber-500/15 shadow flex flex-col justify-between">
            <span className="text-[10px] font-bold text-slate-500 uppercase">Atrasados</span>
            <span className="text-2xl font-extrabold text-amber-400 mt-2">{summary.late}</span>
          </div>
          <div className="p-4 rounded-xl bg-slate-900 border border-rose-500/15 shadow flex flex-col justify-between">
            <span className="text-[10px] font-bold text-slate-500 uppercase">Faltas</span>
            <span className="text-2xl font-extrabold text-rose-400 mt-2">{summary.absences}</span>
          </div>
          <div className="p-4 rounded-xl bg-slate-900 border border-orange-500/15 shadow flex flex-col justify-between">
            <span className="text-[10px] font-bold text-slate-500 uppercase">Instabilidades</span>
            <span className="text-2xl font-extrabold text-orange-400 mt-2">{summary.issues}</span>
          </div>
          <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 shadow flex flex-col justify-between">
            <span className="text-[10px] font-bold text-slate-500 uppercase">Sem Resposta</span>
            <span className="text-2xl font-extrabold text-slate-400 mt-2">{summary.notResponded}</span>
          </div>
        </div>
      </div>

      {/* Expanded filters */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 p-5 rounded-xl border border-slate-800 bg-slate-900 shadow-lg">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            type="text"
            placeholder="Buscar por funcionário..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="block w-full pl-10 pr-4 py-2 rounded-lg bg-slate-950 border border-slate-800 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all text-sm"
          />
        </div>

        <div>
          <select
            value={filterManagerId}
            onChange={(e) => setFilterManagerId(e.target.value)}
            className="block w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm appearance-none cursor-pointer"
          >
            <option value="">Filtrar por Gestor</option>
            {managers.map((mgr) => (
              <option key={mgr.id} value={mgr.id}>{mgr.name}</option>
            ))}
          </select>
        </div>

        <div>
          <select
            value={filterSector}
            onChange={(e) => setFilterSector(e.target.value)}
            className="block w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm appearance-none cursor-pointer"
          >
            <option value="">Filtrar por Setor</option>
            {sectors.map((sec) => (
              <option key={sec} value={sec}>{sec}</option>
            ))}
          </select>
        </div>

        <div className="flex gap-2">
          <select
            value={filterWorkModel}
            onChange={(e) => setFilterWorkModel(e.target.value)}
            className="block flex-1 px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm appearance-none cursor-pointer"
          >
            <option value="">Modelo de Trabalho</option>
            <option value="REMOTE">Remoto</option>
            <option value="HYBRID">Híbrido</option>
            <option value="PRESENTIAL">Presencial</option>
          </select>
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="block px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm cursor-pointer"
          />
        </div>
      </div>

      {/* Main List */}
      <div className="rounded-xl border border-slate-800 bg-slate-900 overflow-hidden shadow-xl">
        {isLoading ? (
          <div className="py-20 flex flex-col items-center gap-3">
            <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
            <span className="text-sm text-slate-400">Carregando presença...</span>
          </div>
        ) : error ? (
          <div className="py-16 text-center text-slate-400 flex flex-col items-center gap-3">
            <AlertCircle className="w-12 h-12 text-red-500" />
            <p className="text-sm">{error}</p>
          </div>
        ) : filteredCheckins.length === 0 ? (
          <div className="py-20 text-center text-slate-500">
            Nenhum registro de check-in remoto localizado.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-400 border-collapse">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-900/50 text-slate-500 font-semibold text-xs uppercase tracking-wider">
                  <th className="px-6 py-3.5">Funcionário</th>
                  <th className="px-6 py-3.5">Status</th>
                  <th className="px-6 py-3.5">Modelo</th>
                  <th className="px-6 py-3.5">Envio / Resposta</th>
                  <th className="px-6 py-3.5">Resposta / Campo</th>
                  <th className="px-6 py-3.5 text-right">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filteredCheckins.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-800/20 transition-colors">
                    <td className="px-6 py-4">
                      <p className="font-semibold text-slate-200">{item.employee?.fullName}</p>
                      <p className="text-xs text-slate-500">{item.employee?.sector || '-'}</p>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${STATUS_THEMES[item.status]?.badge || ''}`}>
                        {STATUS_LABELS[item.status as keyof typeof STATUS_LABELS] || item.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-xs text-slate-300 font-medium">
                      {item.employee?.workModel === 'PRESENTIAL' ? 'Presencial' : item.employee?.workModel === 'REMOTE' ? 'Remoto' : 'Híbrido'}
                    </td>
                    <td className="px-6 py-4 space-y-0.5">
                      <p className="font-mono text-xs text-slate-300">
                        {new Date(item.sentAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                      </p>
                      {item.status === 'PENDING' ? (
                        <p className="text-[10px] text-indigo-400 font-sans flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {getElapsedTime(item.sentAt)}
                        </p>
                      ) : item.respondedAt ? (
                        <p className="font-mono text-[10px] text-slate-500">
                          Resp: {new Date(item.respondedAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      ) : null}
                    </td>
                    <td className="px-6 py-4 space-y-2">
                      {item.responseText ? (
                        <div className="flex items-center gap-2 max-w-xs text-xs text-slate-350 bg-slate-950/45 border border-slate-850/50 py-1.5 px-2.5 rounded-lg italic">
                          <MessageSquare className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                          <span className="truncate" title={item.responseText}>
                            "{item.responseText}"
                          </span>
                        </div>
                      ) : (
                        <span className="text-slate-650 italic block text-xs">-</span>
                      )}

                      {/* GPS & Selfie data */}
                      {(item.latitude || item.selfieUrl) && (
                        <div className="flex items-center gap-2.5 pt-1">
                          {item.selfieUrl && (
                            <div className="flex flex-col gap-1 items-start shrink-0">
                              <a href={item.selfieUrl} target="_blank" rel="noreferrer" className="shrink-0 group animate-fadeIn" title="Ver foto em tamanho real">
                                <img
                                  src={item.selfieUrl}
                                  alt="Selfie de Presença"
                                  className="w-8 h-8 rounded border border-slate-700 object-cover hover:border-indigo-500 transition-all shadow"
                                />
                              </a>
                              {item.faceVerificationStatus && item.faceVerificationStatus !== 'NOT_VERIFIED' && (
                                <span className={`text-[8px] font-bold px-1 py-0.5 rounded uppercase leading-none ${
                                  item.faceVerificationStatus === 'CONFIRMED'
                                    ? 'bg-emerald-500/10 text-emerald-450 border border-emerald-500/20'
                                    : 'bg-red-500/10 text-red-400 border border-red-500/25 animate-pulse'
                                }`}>
                                  {item.faceVerificationStatus === 'CONFIRMED' ? `Face: ${item.faceMatchScore}%` : 'Face Divergente'}
                                </span>
                              )}
                            </div>
                          )}
                          {item.latitude && item.longitude && (
                            <a
                              href={`https://www.google.com/maps?q=${item.latitude},${item.longitude}`}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 text-[10px] font-bold text-indigo-450 hover:text-indigo-400 border border-slate-800 bg-slate-950/40 px-1.5 py-0.5 rounded transition-all"
                              title={`Coordenadas: ${item.latitude}, ${item.longitude}`}
                            >
                              Ver Mapa
                              <ExternalLink className="w-2.5 h-2.5" />
                            </a>
                          )}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right space-y-1.5">
                      {item.status === 'PENDING' && (
                        <button
                          type="button"
                          onClick={() => handleOpenSimulateModal(item.id)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow transition-colors cursor-pointer"
                        >
                          Simular Resposta
                        </button>
                      )}
                      {item.occurrence ? (
                        <a
                          href={`/app/occurrences?search=${encodeURIComponent(item.employee?.fullName)}`}
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-750 text-indigo-405 hover:text-indigo-350 text-xs font-bold border border-slate-700 transition-colors block text-center"
                        >
                          Ver Ocorrência
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      ) : item.status !== 'PENDING' ? (
                        <span className="text-slate-650 block">-</span>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Disparar Individual Modal Dialog */}
      {isTriggerOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-2xl flex flex-col text-slate-200">
            <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Users className="w-4 h-4 text-indigo-500" />
                Disparar Check-in Individual
              </h2>
              <button
                type="button"
                onClick={() => setIsTriggerOpen(false)}
                className="text-slate-400 hover:text-slate-200 text-sm font-medium transition-colors cursor-pointer"
              >
                Fechar
              </button>
            </div>

            <form onSubmit={handleTriggerCheckin} className="p-6 space-y-4">
              {triggerError && (
                <div className="flex flex-col gap-1 p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>{triggerError}</span>
                  </div>
                  {triggerErrorRequestId && (
                    <span className="text-[10px] text-slate-500 font-mono mt-1 pl-6 block">
                      ID da Requisição: {triggerErrorRequestId}
                    </span>
                  )}
                </div>
              )}

              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-slate-400 uppercase">Selecionar Funcionário</label>
                <select
                  required
                  id="triggerEmployeeId"
                  value={triggerEmployeeId}
                  onChange={(e) => setTriggerEmployeeId(e.target.value)}
                  className="block w-full px-3 py-2.5 rounded-lg bg-slate-950 border border-slate-800 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm appearance-none cursor-pointer"
                >
                  <option value="">Selecione um funcionário...</option>
                  {employees.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.fullName} ({emp.workModel === 'REMOTE' ? 'Remoto' : emp.workModel === 'HYBRID' ? 'Híbrido' : 'Presencial'})
                    </option>
                  ))}
                </select>
              </div>

              <div className="pt-4 border-t border-slate-800 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsTriggerOpen(false)}
                  className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-750 text-slate-350 text-xs font-semibold cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isTriggering}
                  className="px-5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold flex items-center gap-2 shadow cursor-pointer disabled:opacity-50"
                >
                  {isTriggering ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      Disparando...
                    </>
                  ) : (
                    'Confirmar Disparo'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Disparar em Lote Modal Dialog */}
      {isBatchOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-2xl flex flex-col text-slate-200">
            <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Play className="w-4 h-4 text-indigo-500 fill-current" />
                Disparar Check-in em Lote
              </h2>
              <button
                type="button"
                onClick={() => setIsBatchOpen(false)}
                className="text-slate-400 hover:text-slate-200 text-sm font-medium transition-colors cursor-pointer"
              >
                Fechar
              </button>
            </div>

            <form onSubmit={handleTriggerBatch} className="p-6 space-y-4">
              {triggerError && (
                <div className="flex flex-col gap-1 p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>{triggerError}</span>
                  </div>
                  {batchErrorRequestId && (
                    <span className="text-[10px] text-slate-500 font-mono mt-1 pl-6 block">
                      ID da Requisição: {batchErrorRequestId}
                    </span>
                  )}
                </div>
              )}

              <div className="p-3 rounded-lg bg-indigo-500/5 border border-indigo-500/10 text-slate-400 text-xs leading-relaxed flex gap-2">
                <Info className="w-4.5 h-4.5 text-indigo-500 shrink-0 mt-0.5" />
                <span>
                  O lote enviará cobranças para todos os funcionários ativos elegíveis. Se nenhum modelo for selecionado, <strong>apenas colaboradores remotos ou híbridos</strong> serão cobrados, ignorando os presenciais. Colaboradores afastados (licença ativa) são pulados automaticamente.
                </span>
              </div>

              {/* Filters grid */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="block text-[10px] font-bold text-slate-400 uppercase">Modelo de Trabalho</label>
                  <select
                    value={batchWorkModel}
                    onChange={(e) => setBatchWorkModel(e.target.value)}
                    className="block w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-white focus:outline-none focus:ring-1 focus:ring-indigo-500 text-xs cursor-pointer"
                  >
                    <option value="">Priorizar Remoto/Híbrido</option>
                    <option value="REMOTE">Remoto</option>
                    <option value="HYBRID">Híbrido</option>
                    <option value="PRESENTIAL">Presencial (Opcional)</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="block text-[10px] font-bold text-slate-400 uppercase">Jornada</label>
                  <select
                    value={batchScheduleId}
                    onChange={(e) => setBatchScheduleId(e.target.value)}
                    className="block w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-white focus:outline-none focus:ring-1 focus:ring-indigo-500 text-xs cursor-pointer"
                  >
                    <option value="">Todas Jornadas</option>
                    {schedules.map((sch) => (
                      <option key={sch.id} value={sch.id}>{sch.name}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="block text-[10px] font-bold text-slate-400 uppercase">Setor</label>
                  <select
                    value={batchSector}
                    onChange={(e) => setBatchSector(e.target.value)}
                    className="block w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-white focus:outline-none focus:ring-1 focus:ring-indigo-500 text-xs cursor-pointer"
                  >
                    <option value="">Todos Setores</option>
                    {sectors.map((sec) => (
                      <option key={sec} value={sec}>{sec}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="block text-[10px] font-bold text-slate-400 uppercase">Gestor</label>
                  <select
                    value={batchManagerId}
                    onChange={(e) => setBatchManagerId(e.target.value)}
                    className="block w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-white focus:outline-none focus:ring-1 focus:ring-indigo-500 text-xs cursor-pointer"
                  >
                    <option value="">Todos Gestores</option>
                    {managers.map((mgr) => (
                      <option key={mgr.id} value={mgr.id}>{mgr.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-800 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsBatchOpen(false)}
                  className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-750 text-slate-350 text-xs font-semibold cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isTriggering}
                  className="px-5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold flex items-center gap-2 shadow cursor-pointer disabled:opacity-50"
                >
                  {isTriggering ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      Processando Lote...
                    </>
                  ) : (
                    'Disparar Lote'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Detailed Batch Result Summary Dialog */}
      {isResultOpen && batchResult && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
          <div className="w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-2xl flex flex-col text-slate-200">
            <div className="px-6 py-4 border-b border-slate-800 bg-slate-900/60 flex items-center justify-between">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                Relatório de Disparo em Lote
              </h2>
              <button
                type="button"
                onClick={() => setIsResultOpen(false)}
                className="text-slate-400 hover:text-slate-200 text-sm font-medium transition-colors cursor-pointer"
              >
                Fechar
              </button>
            </div>

            <div className="p-6 space-y-4 flex-1 overflow-y-auto max-h-[500px]">
              {/* Counters row */}
              <div className="grid grid-cols-3 gap-4 text-center">
                <div className="p-3 bg-emerald-500/5 border border-emerald-500/10 rounded-lg">
                  <span className="text-[10px] text-slate-500 font-bold uppercase">Disparados</span>
                  <p className="text-2xl font-extrabold text-emerald-400 mt-1">{batchResult.created}</p>
                </div>
                <div className="p-3 bg-amber-500/5 border border-amber-500/10 rounded-lg">
                  <span className="text-[10px] text-slate-500 font-bold uppercase">Duplicados</span>
                  <p className="text-2xl font-extrabold text-amber-400 mt-1">{batchResult.duplicates}</p>
                </div>
                <div className="p-3 bg-slate-800/20 border border-slate-800 rounded-lg">
                  <span className="text-[10px] text-slate-500 font-bold uppercase">Ignorados</span>
                  <p className="text-2xl font-extrabold text-slate-450 mt-1">{batchResult.skipped}</p>
                </div>
              </div>

              {/* Items detail list */}
              <div className="space-y-2">
                <span className="text-xs font-bold text-slate-400 uppercase">Detalhamento por Funcionário</span>
                <div className="rounded-lg border border-slate-800 overflow-hidden divide-y divide-slate-800/60 max-h-[260px] overflow-y-auto">
                  {batchResult.items?.map((item: any) => {
                    const isCreated = item.status === 'CREATED';
                    const isDuplicate = item.status === 'DUPLICATE';
                    const isWarning = item.status === 'WARNING_NO_WORK_SCHEDULE';
                    
                    return (
                      <div key={item.employeeId} className="flex items-center justify-between p-3 text-xs bg-slate-950/20 hover:bg-slate-950/45 transition-colors">
                        <div>
                          <p className="font-semibold text-slate-200">{item.employeeName}</p>
                          <p className="text-[10px] text-slate-500 mt-0.5">{item.reason}</p>
                        </div>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold border shrink-0 ${
                          isCreated ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                          isDuplicate ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' :
                          isWarning ? 'bg-orange-500/10 text-orange-400 border-orange-500/20' :
                          'bg-slate-800 text-slate-400 border-slate-700'
                        }`}>
                          {isWarning ? 'ATENÇÃO' : isCreated ? 'ENVIADO' : isDuplicate ? 'DUPLICADO' : 'IGNORADO'}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="px-6 py-4 border-t border-slate-800 bg-slate-900/40 flex justify-end">
              <button
                type="button"
                onClick={() => setIsResultOpen(false)}
                className="px-5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow cursor-pointer"
              >
                Concluir
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Marcar Sem Resposta Modal Dialog */}
      {/* Simulation Modal - Response */}
      {isSimulateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-2xl flex flex-col text-slate-200">
            <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Clock className="w-4 h-4 text-indigo-500" />
                Simulador de Resposta do Colaborador
              </h2>
              <button
                type="button"
                onClick={() => setIsSimulateOpen(false)}
                className="text-slate-400 hover:text-slate-200 text-sm font-medium transition-colors cursor-pointer"
              >
                Fechar
              </button>
            </div>

            <form onSubmit={handleSimulateResponse} className="p-6 space-y-4">
              {simulateError && (
                <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-450 text-xs">
                  {simulateError}
                </div>
              )}

              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-slate-400 uppercase">Mensagem/Resposta</label>
                <select
                  value={simulateMessage}
                  onChange={(e) => setSimulateMessage(e.target.value)}
                  className="block w-full px-3 py-2.5 rounded-lg bg-slate-950 border border-slate-800 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm cursor-pointer"
                >
                  <option value="1">1. Sim, iniciei agora (Confirma Presença)</option>
                  <option value="2">2. Vou iniciar mais tarde (Atraso)</option>
                  <option value="3">3. Estou com problema técnico (Instabilidade)</option>
                  <option value="4">4. Vou faltar (Falta)</option>
                  <option value="5">5. Estou de atestado (Atestado)</option>
                </select>
              </div>

              {/* GPS & Camera checklist */}
              <div className="space-y-3 pt-2">
                <label className="block text-xs font-semibold text-slate-400 uppercase">Dados Adicionais de Campo</label>
                
                <label className="flex items-center gap-2.5 p-3 rounded-lg border border-slate-850 bg-slate-950/40 cursor-pointer hover:border-slate-800 transition-colors">
                  <input
                    type="checkbox"
                    checked={simulateGPS}
                    onChange={(e) => setSimulateGPS(e.target.checked)}
                    className="rounded bg-slate-900 border-slate-800 text-indigo-600 focus:ring-indigo-500"
                  />
                  <div>
                    <p className="text-xs font-bold text-slate-200">Enviar Geolocalização (GPS)</p>
                    <p className="text-[10px] text-slate-500 mt-0.5">Captura as coordenadas do celular (-23.55, -46.63).</p>
                  </div>
                </label>

                <label className="flex items-center gap-2.5 p-3 rounded-lg border border-slate-850 bg-slate-950/40 cursor-pointer hover:border-slate-800 transition-colors">
                  <input
                    type="checkbox"
                    checked={simulateSelfie}
                    onChange={(e) => setSimulateSelfie(e.target.checked)}
                    className="rounded bg-slate-900 border-slate-800 text-indigo-600 focus:ring-indigo-500"
                  />
                  <div>
                    <p className="text-xs font-bold text-slate-200">Anexar Selfie de Presença</p>
                    <p className="text-[10px] text-slate-500 mt-0.5">Captura uma foto pela câmera frontal do dispositivo.</p>
                  </div>
                </label>

                {simulateSelfie && (
                  <div className="relative mt-2 border border-slate-800 rounded-lg overflow-hidden bg-slate-950 flex flex-col items-center justify-center p-6 space-y-2 select-none">
                    <div className="relative w-36 h-36 rounded-full border-2 border-indigo-500/50 flex items-center justify-center animate-pulse">
                      <div className="absolute inset-2 rounded-full border border-dashed border-indigo-500/30"></div>
                      <Sparkles className="w-8 h-8 text-indigo-400/40" />
                    </div>
                    
                    {companySettings?.enableFacialRecognition ? (
                      <div className="text-center space-y-1">
                        <p className="text-[10px] text-indigo-400 font-bold uppercase tracking-wider">[IA: BIOMETRIA FACIAL ATIVA]</p>
                        <p className="text-[9px] text-slate-500 leading-normal">Posicione seu rosto dentro da demarcação circular acima.</p>
                      </div>
                    ) : (
                      <div className="text-center space-y-1">
                        <p className="text-[10px] text-emerald-400 font-bold uppercase tracking-wider">[CAMERA PRONTA]</p>
                        <p className="text-[9px] text-slate-500 leading-normal">Sorria para capturar a selfie de auditoria.</p>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="pt-4 border-t border-slate-800 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsSimulateOpen(false)}
                  className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-750 text-slate-350 text-xs font-semibold cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSimulating}
                  className="px-5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold flex items-center gap-2 shadow cursor-pointer disabled:opacity-50"
                >
                  {isSimulating ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      Simulando...
                    </>
                  ) : (
                    'Enviar Resposta'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isMarkOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-2xl flex flex-col text-slate-200">
            <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Clock className="w-4 h-4 text-indigo-500" />
                Marcar Check-ins Sem Resposta
              </h2>
              <button
                type="button"
                onClick={() => setIsMarkOpen(false)}
                className="text-slate-400 hover:text-slate-200 text-sm font-medium transition-colors cursor-pointer"
              >
                Fechar
              </button>
            </div>

            <form onSubmit={handleMarkNotResponded} className="p-6 space-y-4">
              {markError && (
                <div className="flex flex-col gap-1 p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>{markError}</span>
                  </div>
                  {markErrorRequestId && (
                    <span className="text-[10px] text-slate-500 font-mono mt-1 pl-6 block">
                      ID da Requisição: {markErrorRequestId}
                    </span>
                  )}
                </div>
              )}

              <div className="p-3 rounded-lg bg-rose-500/5 border border-rose-500/10 text-slate-400 text-xs leading-relaxed flex gap-2">
                <AlertTriangle className="w-5 h-5 text-rose-500 shrink-0 mt-0.5 animate-pulse" />
                <span>
                  Esta ação identificará check-ins remotos na data selecionada ({selectedDate ? new Date(`${selectedDate}T00:00:00`).toLocaleDateString('pt-BR') : 'hoje'}) que ainda estejam no status <strong>PENDENTE</strong> e cujo prazo de envio excedeu os minutos de carência configurados abaixo.
                </span>
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-slate-400 uppercase">Minutos de Carência</label>
                <input
                  type="number"
                  required
                  min="0"
                  value={graceMinutes}
                  onChange={(e) => setGraceMinutes(Number(e.target.value))}
                  className="block w-full px-3 py-2.5 rounded-lg bg-slate-950 border border-slate-800 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm"
                />
                <p className="text-[10px] text-slate-500">
                  Por exemplo, 30 minutos de tolerância a partir do momento em que a cobrança foi enviada.
                </p>
              </div>

              <div className="pt-4 border-t border-slate-800 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsMarkOpen(false)}
                  className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-750 text-slate-350 text-xs font-semibold cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isMarking}
                  className="px-5 py-2 rounded-lg bg-rose-650 hover:bg-rose-500 text-white text-xs font-semibold flex items-center gap-2 shadow cursor-pointer disabled:opacity-50"
                >
                  {isMarking ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      Varrendo...
                    </>
                  ) : (
                    'Confirmar Enquadramento'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      <PlanErrorAlert error={planError} onClose={() => setPlanError(null)} />
    </>
  );
}
