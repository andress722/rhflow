'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  FileText,
  Clock,
  UserX,
  AlertCircle,
  TrendingUp,
  Activity,
  Download,
  AlertTriangle,
  Search,
  Filter,
  CheckCircle2,
  XCircle,
  Briefcase,
  ChevronRight,
  Info,
  Calendar
} from 'lucide-react';
import { api } from '@/lib/api';
import { getUser } from '@/lib/auth';
import PlanErrorAlert from '@/components/PlanErrorAlert';

const OCCURRENCE_TYPES: Record<string, string> = {
  MISSED_CLOCK_IN: 'Ponto não registrado (Entrada)',
  MISSED_CLOCK_OUT: 'Ponto não registrado (Saída)',
  LATE_ARRIVAL: 'Atraso',
  EARLY_LEAVE: 'Saída antecipada',
  ABSENCE: 'Falta',
  TEMPORARY_ABSENCE: 'Afastamento temporário',
  MEDICAL_CERTIFICATE: 'Atestado médico',
  REMOTE_CHECKIN_MISSED: 'Check-in remoto perdido',
  REMOTE_CHECKOUT_MISSED: 'Check-out remoto perdido',
  REMOTE_TECHNICAL_ISSUE: 'Problema técnico remoto',
  REMOTE_CHECKIN_NOT_RESPONDED: 'Check-in sem resposta',
  REMOTE_CHECKIN: 'Check-in Remoto',
};

const OCCURRENCE_STATUSES: Record<string, string> = {
  OPEN: 'Aberta',
  WAITING_EMPLOYEE: 'Aguardando funcionário',
  WAITING_MANAGER: 'Aguardando gestor',
  WAITING_HR: 'Aguardando RH',
  RESOLVED: 'Resolvida',
  REJECTED: 'Rejeitada',
  CANCELLED: 'Cancelada',
  PENDING: 'Pendente (Check-in)',
  CONFIRMED: 'Confirmado (Check-in)',
  LATE: 'Atrasado (Check-in)',
  ABSENCE_REPORTED: 'Falta reportada (Check-in)',
  ISSUE_REPORTED: 'Instabilidade (Check-in)',
  NOT_RESPONDED: 'Sem Resposta (Check-in)',
};

export default function ReportsPage() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [planError, setPlanError] = useState<string | null>(null);

  // Filter States
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('');
  const [selectedManagerId, setSelectedManagerId] = useState('');
  const [selectedSector, setSelectedSector] = useState('');
  const [selectedType, setSelectedType] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');
  const [selectedWorkModel, setSelectedWorkModel] = useState('');

  // Dropdown list options
  const [employees, setEmployees] = useState<any[]>([]);
  const [managers, setManagers] = useState<any[]>([]);
  const [sectors, setSectors] = useState<string[]>([]);

  // Report Data
  const [reportSummary, setReportSummary] = useState({
    employees: 0,
    absences: 0,
    lateArrivals: 0,
    notResponded: 0,
    medicalCertificates: 0,
    activeAbsences: 0,
    technicalIssues: 0,
  });
  const [reportItems, setReportItems] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [isExporting, setIsExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [exportErrorRequestId, setExportErrorRequestId] = useState<string | null>(null);

  // Closing Pendencies States
  const [pendenciesSummary, setPendenciesSummary] = useState({
    total: 0,
    critical: 0,
    warning: 0,
    info: 0,
  });
  const [pendenciesItems, setPendenciesItems] = useState<any[]>([]);
  const [isPendenciesOpen, setIsPendenciesOpen] = useState(false);
  const [isLoadingPendencies, setIsLoadingPendencies] = useState(false);

  // Initialize dates: past 30 days
  useEffect(() => {
    const todayObj = new Date();
    const pastObj = new Date();
    pastObj.setDate(todayObj.getDate() - 30);

    const formatDateString = (d: Date) => {
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };

    setFromDate(formatDateString(pastObj));
    setToDate(formatDateString(todayObj));

    const u = getUser();
    setCurrentUser(u);
  }, []);

  // Fetch filter choices and initial report once dates and user are populated
  useEffect(() => {
    if (fromDate && toDate && currentUser) {
      fetchFilterOptions();
      fetchReportData();
      fetchClosingPendencies();
    }
  }, [fromDate, toDate, currentUser]);

  const fetchFilterOptions = async () => {
    try {
      const empRes = await api.get('/employees');
      if (empRes.success && empRes.data) {
        setEmployees(empRes.data);
        const uniqueSectors = Array.from(new Set(empRes.data.map((e: any) => e.sector).filter(Boolean))) as string[];
        setSectors(uniqueSectors);
      }

      const usersRes = await api.get('/users');
      if (usersRes.success && usersRes.data) {
        const mgrs = usersRes.data.filter((u: any) => u.role === 'MANAGER' || u.role === 'ADMIN');
        setManagers(mgrs);
      }
    } catch (err) {
      console.error('Erro ao buscar opções de filtros:', err);
    }
  };

  const fetchReportData = async () => {
    setIsLoading(true);
    setError('');

    try {
      const queryParams = new URLSearchParams();
      queryParams.append('from', fromDate);
      queryParams.append('to', toDate);
      if (selectedEmployeeId) queryParams.append('employeeId', selectedEmployeeId);
      if (selectedManagerId) queryParams.append('managerUserId', selectedManagerId);
      if (selectedSector) queryParams.append('sector', selectedSector);
      if (selectedType) queryParams.append('occurrenceType', selectedType);
      if (selectedStatus) queryParams.append('status', selectedStatus);
      if (selectedWorkModel) queryParams.append('workModel', selectedWorkModel);

      const res = await api.get(`/reports/operational?${queryParams.toString()}`);
      if (res.success && res.data) {
        setReportSummary(res.data.summary);
        setReportItems(res.data.items);
      } else {
        const errCode = res.error?.code || res.error || (res as any).error;
        if (['PLAN_LIMIT_EXCEEDED', 'PLAN_FEATURE_DISABLED', 'FEATURE_DISABLED', 'FORBIDDEN'].includes(errCode)) {
          setPlanError(errCode);
        } else {
          setError(res.error?.message || 'Erro ao carregar relatório operacional.');
        }
      }
    } catch (err) {
      setError('Erro de conexão ao buscar relatório.');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchClosingPendencies = async () => {
    setIsLoadingPendencies(true);
    try {
      const res = await api.get('/reports/closing-pendencies');
      if (res.success && res.data) {
        setPendenciesSummary(res.data.summary);
        setPendenciesItems(res.data.items);
      } else {
        const errCode = res.error?.code || res.error || (res as any).error;
        if (['PLAN_LIMIT_EXCEEDED', 'PLAN_FEATURE_DISABLED', 'FEATURE_DISABLED', 'FORBIDDEN'].includes(errCode)) {
          setPlanError(errCode);
        }
      }
    } catch (err) {
      console.error('Erro ao buscar pendências de fechamento:', err);
    } finally {
      setIsLoadingPendencies(false);
    }
  };

  const handleExportCSV = () => {
    if (!fromDate || !toDate) return;
    if (isExporting) return;

    setIsExporting(true);
    setExportError(null);
    setExportErrorRequestId(null);

    const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';
    const token = localStorage.getItem('token');

    const params = new URLSearchParams();
    params.append('from', fromDate);
    params.append('to', toDate);
    if (selectedEmployeeId) params.append('employeeId', selectedEmployeeId);
    if (selectedManagerId) params.append('managerUserId', selectedManagerId);
    if (selectedSector) params.append('sector', selectedSector);
    if (selectedType) params.append('occurrenceType', selectedType);
    if (selectedStatus) params.append('status', selectedStatus);
    if (selectedWorkModel) params.append('workModel', selectedWorkModel);

    const exportUrl = `${API_URL}/reports/operational/export?${params.toString()}`;

    // Create an anchor tag and download file
    const headers = new Headers();
    if (token) {
      headers.append('Authorization', `Bearer ${token}`);
    }

    fetch(exportUrl, { headers })
      .then(async (res) => {
        if (!res.ok) {
          try {
            const text = await res.text();
            const json = JSON.parse(text);
            const err = new Error(json.error?.message || json.error || json.message || 'Erro ao exportar arquivo.') as any;
            if (json.error?.requestId) {
              err.requestId = json.error.requestId;
            }
            throw err;
          } catch (err: any) {
            throw new Error(err.message || 'Não autorizado ou limite de período excedido');
          }
        }
        return res.blob();
      })
      .then((blob) => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `relatorio_operacional_${fromDate}_a_${toDate}.csv`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(url);
      })
      .catch((err: any) => {
        const errMsg = err.message || '';
        if (['PLAN_LIMIT_EXCEEDED', 'PLAN_FEATURE_DISABLED', 'FEATURE_DISABLED', 'FORBIDDEN'].includes(errMsg)) {
          setPlanError(errMsg);
        } else {
          setExportError(errMsg);
          if (err.requestId) {
            setExportErrorRequestId(err.requestId);
          }
        }
      })
      .finally(() => {
        setIsExporting(false);
      });
  };

  const getStatusBadge = (status: string) => {
    const isResolved = status === 'RESOLVED' || status === 'CONFIRMED';
    const isCancelled = status === 'CANCELLED' || status === 'REJECTED';
    const isWarning = ['NOT_RESPONDED', 'LATE', 'ABSENCE_REPORTED', 'ISSUE_REPORTED', 'WAITING_EMPLOYEE', 'WAITING_MANAGER', 'WAITING_HR'].includes(status);

    return (
      <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold border shrink-0 ${
        isResolved ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
        isCancelled ? 'bg-rose-500/10 text-rose-400 border-rose-500/20' :
        isWarning ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' :
        'bg-slate-800 text-slate-400 border-slate-700'
      }`}>
        {OCCURRENCE_STATUSES[status] || status}
      </span>
    );
  };

  const getSeverityBadge = (sev: string) => {
    return (
      <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold border ${
        sev === 'CRITICAL' ? 'bg-rose-500/10 text-rose-400 border-rose-500/20' :
        sev === 'WARNING' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' :
        'bg-blue-500/10 text-blue-400 border-blue-500/20'
      }`}>
        {sev}
      </span>
    );
  };

  const isViewer = currentUser && currentUser.role === 'VIEWER';

  return (
    <>
      {/* Header Title Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white">Fechamento Operacional</h1>
          <p className="text-slate-400 text-sm mt-1">
            Consolidação de ocorrências, atestados, afastamentos, faltas e check-ins para exportação de RH/DP.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsPendenciesOpen(true)}
            className="px-4 py-2 rounded-lg bg-rose-600/15 hover:bg-rose-600/25 border border-rose-500/30 hover:border-rose-500/40 text-rose-400 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-lg"
          >
            <AlertTriangle className="w-4 h-4 text-rose-500 animate-pulse" />
            <span>Pendências ({pendenciesSummary.total})</span>
          </button>

          {!isViewer && (
            <button
              onClick={handleExportCSV}
              disabled={isExporting}
              className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-850 disabled:cursor-not-allowed text-white text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-md"
            >
              {isExporting ? (
                <span>Exportando...</span>
              ) : (
                <>
                  <Download className="w-4 h-4" />
                  <span>Exportar CSV</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {exportError && (
        <div className="flex flex-col gap-1 p-4 rounded-lg bg-red-950/20 border border-red-900/30 text-red-400 text-xs">
          <div className="flex gap-2 items-start">
            <AlertCircle className="w-4.5 h-4.5 text-red-500 shrink-0" />
            <span>{exportError}</span>
          </div>
          {exportErrorRequestId && (
            <span className="text-[10px] text-slate-500 font-mono mt-1 pl-6 block">
              ID da Requisição: {exportErrorRequestId}
            </span>
          )}
        </div>
      )}

      {/* Filter panel */}
      <div className="p-6 rounded-xl bg-slate-900 border border-slate-800 shadow-xl space-y-4">
        <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
          <Filter className="w-4 h-4 text-indigo-400" />
          <h2 className="text-sm font-bold text-white uppercase tracking-wider">Filtros de Pesquisa</h2>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            fetchReportData();
          }}
          className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4"
        >
          {/* Período */}
          <div className="space-y-1.5">
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Período De</label>
            <div className="relative">
              <Calendar className="absolute left-3 top-2.5 w-4 h-4 text-slate-500" />
              <input
                type="date"
                required
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="block w-full pl-9 pr-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-white focus:outline-none focus:ring-1 focus:ring-indigo-500 text-xs cursor-pointer"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Período Até</label>
            <div className="relative">
              <Calendar className="absolute left-3 top-2.5 w-4 h-4 text-slate-500" />
              <input
                type="date"
                required
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="block w-full pl-9 pr-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-white focus:outline-none focus:ring-1 focus:ring-indigo-500 text-xs cursor-pointer"
              />
            </div>
          </div>

          {/* Funcionário */}
          <div className="space-y-1.5">
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Funcionário</label>
            <select
              value={selectedEmployeeId}
              onChange={(e) => setSelectedEmployeeId(e.target.value)}
              className="block w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-white focus:outline-none focus:ring-1 focus:ring-indigo-500 text-xs cursor-pointer"
            >
              <option value="">Todos Funcionários</option>
              {employees.map((emp) => (
                <option key={emp.id} value={emp.id}>{emp.fullName}</option>
              ))}
            </select>
          </div>

          {/* Gestor */}
          <div className="space-y-1.5">
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Gestor</label>
            <select
              value={selectedManagerId}
              onChange={(e) => setSelectedManagerId(e.target.value)}
              className="block w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-white focus:outline-none focus:ring-1 focus:ring-indigo-500 text-xs cursor-pointer"
            >
              <option value="">Todos Gestores</option>
              {managers.map((mgr) => (
                <option key={mgr.id} value={mgr.id}>{mgr.name}</option>
              ))}
            </select>
          </div>

          {/* Setor */}
          <div className="space-y-1.5">
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Setor</label>
            <select
              value={selectedSector}
              onChange={(e) => setSelectedSector(e.target.value)}
              className="block w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-white focus:outline-none focus:ring-1 focus:ring-indigo-500 text-xs cursor-pointer"
            >
              <option value="">Todos Setores</option>
              {sectors.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>

          {/* Tipo */}
          <div className="space-y-1.5">
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Tipo</label>
            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              className="block w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-white focus:outline-none focus:ring-1 focus:ring-indigo-500 text-xs cursor-pointer"
            >
              <option value="">Todos Tipos</option>
              {Object.entries(OCCURRENCE_TYPES).map(([val, label]) => (
                <option key={val} value={val}>{label}</option>
              ))}
            </select>
          </div>

          {/* Status */}
          <div className="space-y-1.5">
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Status</label>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="block w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-white focus:outline-none focus:ring-1 focus:ring-indigo-500 text-xs cursor-pointer"
            >
              <option value="">Todos Status</option>
              {Object.entries(OCCURRENCE_STATUSES).map(([val, label]) => (
                <option key={val} value={val}>{label}</option>
              ))}
            </select>
          </div>

          {/* Modelo */}
          <div className="space-y-1.5">
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Modelo de Trabalho</label>
            <select
              value={selectedWorkModel}
              onChange={(e) => setSelectedWorkModel(e.target.value)}
              className="block w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-white focus:outline-none focus:ring-1 focus:ring-indigo-500 text-xs cursor-pointer"
            >
              <option value="">Todos Modelos</option>
              <option value="PRESENTIAL">Presencial</option>
              <option value="REMOTE">Remoto</option>
              <option value="HYBRID">Híbrido</option>
            </select>
          </div>

          {/* Actions */}
          <div className="sm:col-span-2 md:col-span-4 flex justify-end pt-2">
            <button
              type="submit"
              disabled={isLoading}
              className="px-5 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold flex items-center gap-1.5 transition-all shadow cursor-pointer disabled:opacity-50"
            >
              <Search className="w-4 h-4" />
              <span>{isLoading ? 'Carregando...' : 'Aplicar Filtros'}</span>
            </button>
          </div>
        </form>
      </div>

      {/* Summary Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-7 gap-4">
        {/* Pendências Card */}
        <button
          onClick={() => setIsPendenciesOpen(true)}
          className="p-4 rounded-xl bg-slate-900 border border-rose-950/40 hover:border-rose-800/60 shadow-lg text-left flex flex-col justify-between cursor-pointer group transition-all"
        >
          <div className="flex items-center justify-between w-full">
            <span className="text-[9px] font-bold text-slate-400 uppercase">Pendências</span>
            <AlertTriangle className="w-4 h-4 text-rose-500 animate-pulse group-hover:scale-110 transition-transform" />
          </div>
          <div className="mt-2">
            <p className="text-2xl font-extrabold text-rose-450 tracking-tight">{pendenciesSummary.total}</p>
            <p className="text-[9px] text-slate-500 font-sans mt-0.5">{pendenciesSummary.critical} críticas</p>
          </div>
        </button>

        {/* Faltas */}
        <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 shadow-lg flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[9px] font-bold text-slate-400 uppercase">Faltas</span>
            <UserX className="w-4 h-4 text-amber-500" />
          </div>
          <div className="mt-2">
            <p className="text-2xl font-extrabold text-white tracking-tight">{reportSummary.absences}</p>
            <p className="text-[9px] text-slate-500 font-sans mt-0.5">no período</p>
          </div>
        </div>

        {/* Atrasos */}
        <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 shadow-lg flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[9px] font-bold text-slate-400 uppercase">Atrasos</span>
            <Clock className="w-4 h-4 text-indigo-500" />
          </div>
          <div className="mt-2">
            <p className="text-2xl font-extrabold text-white tracking-tight">{reportSummary.lateArrivals}</p>
            <p className="text-[9px] text-slate-500 font-sans mt-0.5">no período</p>
          </div>
        </div>

        {/* Atestados */}
        <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 shadow-lg flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[9px] font-bold text-slate-400 uppercase">Atestados</span>
            <FileText className="w-4 h-4 text-teal-400" />
          </div>
          <div className="mt-2">
            <p className="text-2xl font-extrabold text-white tracking-tight">{reportSummary.medicalCertificates}</p>
            <p className="text-[9px] text-slate-500 font-sans mt-0.5">em análise / aprovados</p>
          </div>
        </div>

        {/* Afastamentos */}
        <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 shadow-lg flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[9px] font-bold text-slate-400 uppercase">Afastamentos</span>
            <TrendingUp className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="mt-2">
            <p className="text-2xl font-extrabold text-white tracking-tight">{reportSummary.activeAbsences}</p>
            <p className="text-[9px] text-slate-500 font-sans mt-0.5">ativos hoje</p>
          </div>
        </div>

        {/* Sem resposta */}
        <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 shadow-lg flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[9px] font-bold text-slate-400 uppercase">Sem Resposta</span>
            <AlertCircle className="w-4 h-4 text-rose-500" />
          </div>
          <div className="mt-2">
            <p className="text-2xl font-extrabold text-white tracking-tight">{reportSummary.notResponded}</p>
            <p className="text-[9px] text-slate-500 font-sans mt-0.5">check-ins expirados</p>
          </div>
        </div>

        {/* Problemas técnicos */}
        <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 shadow-lg flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[9px] font-bold text-slate-400 uppercase">Prob. Técnicos</span>
            <Activity className="w-4 h-4 text-violet-400" />
          </div>
          <div className="mt-2">
            <p className="text-2xl font-extrabold text-white tracking-tight">{reportSummary.technicalIssues}</p>
            <p className="text-[9px] text-slate-500 font-sans mt-0.5">no período</p>
          </div>
        </div>
      </div>

      {/* Detail Table */}
      <div className="rounded-xl border border-slate-800 bg-slate-900 overflow-hidden shadow-xl">
        <div className="px-6 py-5 border-b border-slate-800 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-white">Detalhamento Operacional</h2>
            <p className="text-xs text-slate-500">Listagem analítica contendo todas as ocorrências e check-ins filtrados</p>
          </div>
          <span className="text-xs font-semibold text-slate-400 bg-slate-950 px-3 py-1.5 rounded-lg border border-slate-800">
            Total de Itens: <strong>{reportItems.length}</strong>
          </span>
        </div>

        {error && (
          <div className="p-6 text-center text-rose-450 bg-rose-500/5 text-sm flex flex-col items-center gap-2">
            <AlertCircle className="w-6 h-6 text-rose-500 animate-bounce" />
            <span>{error}</span>
          </div>
        )}

        {isLoading ? (
          <div className="py-24 flex flex-col items-center gap-3">
            <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
            <span className="text-sm text-slate-400 font-medium">Consolidando dados operacionais...</span>
          </div>
        ) : reportItems.length === 0 ? (
          <div className="py-24 text-center text-slate-500 text-sm">
            Nenhum registro encontrado no período de pesquisa.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-400 border-collapse">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-900/50 text-slate-500 font-semibold text-xs uppercase tracking-wider">
                  <th className="px-6 py-3.5">Data</th>
                  <th className="px-6 py-3.5">Funcionário / CPF</th>
                  <th className="px-6 py-3.5">Setor / Gestor</th>
                  <th className="px-6 py-3.5">Modelo</th>
                  <th className="px-6 py-3.5">Tipo de Evento</th>
                  <th className="px-6 py-3.5">Status</th>
                  <th className="px-6 py-3.5">Atestado / Dias</th>
                  <th className="px-6 py-3.5">Observações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {reportItems.map((item, idx) => {
                  const isCheckin = item.type === 'REMOTE_CHECKIN';
                  return (
                    <tr key={`${item.employeeId}-${item.date}-${idx}`} className="hover:bg-slate-800/20 transition-colors">
                      <td className="px-6 py-4 font-mono text-xs text-slate-300">
                        {new Date(`${item.date}T12:00:00`).toLocaleDateString('pt-BR')}
                      </td>
                      <td className="px-6 py-4">
                        <p className="font-semibold text-slate-200 text-sm">{item.employeeName}</p>
                        <p className="text-xs text-slate-500 mt-0.5">{item.employeeCpfMasked}</p>
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-slate-350">{item.sector}</p>
                        <p className="text-xs text-slate-500 mt-0.5">Gestor: {item.managerName}</p>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-xs text-slate-300">
                          {item.workModel === 'PRESENTIAL' ? 'Presencial' : (item.workModel === 'REMOTE' ? 'Remoto' : 'Híbrido')}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="font-semibold text-slate-300">
                          {OCCURRENCE_TYPES[item.type] || item.type}
                        </span>
                        <p className="text-[10px] text-slate-500 mt-0.5">Origem: {item.source}</p>
                      </td>
                      <td className="px-6 py-4">{getStatusBadge(item.status)}</td>
                      <td className="px-6 py-4">
                        {item.hasMedicalCertificate ? (
                          <div>
                            <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-bold border shrink-0 bg-teal-500/10 text-teal-400 border-teal-500/20`}>
                              Atestado ({item.medicalCertificateStatus})
                            </span>
                            {item.absenceDays && (
                              <p className="text-xs text-slate-500 mt-1">{item.absenceDays} dia(s) afastado</p>
                            )}
                          </div>
                        ) : item.absenceDays ? (
                          <span className="text-xs text-slate-500">{item.absenceDays} dia(s) afastado</span>
                        ) : (
                          <span className="text-xs text-slate-600">-</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-xs max-w-[200px] truncate" title={item.notes}>
                        {item.notes}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Closing Pendencies Drawer/Modal */}
      {isPendenciesOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-4xl bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh] text-slate-200">
            <div className="px-6 py-4 border-b border-slate-800 bg-slate-900/60 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <AlertTriangle className="w-5 h-5 text-rose-500 animate-pulse" />
                <h2 className="text-lg font-bold text-white">Pendências de Fechamento</h2>
              </div>
              <button
                type="button"
                onClick={() => setIsPendenciesOpen(false)}
                className="text-slate-400 hover:text-slate-200 text-sm font-medium transition-colors cursor-pointer"
              >
                Fechar
              </button>
            </div>

            {/* Pendencies Summary Row */}
            <div className="px-6 py-4 bg-slate-950/40 border-b border-slate-800 grid grid-cols-4 gap-4 text-center">
              <div className="p-3 bg-slate-800/10 border border-slate-800 rounded-lg">
                <span className="text-[10px] text-slate-500 font-bold uppercase">Total de Pendências</span>
                <p className="text-xl font-extrabold text-white mt-1">{pendenciesSummary.total}</p>
              </div>
              <div className="p-3 bg-rose-500/5 border border-rose-500/10 rounded-lg">
                <span className="text-[10px] text-rose-400 font-bold uppercase">Críticas (Impeditivas)</span>
                <p className="text-xl font-extrabold text-rose-500 mt-1">{pendenciesSummary.critical}</p>
              </div>
              <div className="p-3 bg-amber-500/5 border border-amber-500/10 rounded-lg">
                <span className="text-[10px] text-amber-400 font-bold uppercase">Avisos Importantes</span>
                <p className="text-xl font-extrabold text-amber-500 mt-1">{pendenciesSummary.warning}</p>
              </div>
              <div className="p-3 bg-blue-500/5 border border-blue-500/10 rounded-lg">
                <span className="text-[10px] text-blue-400 font-bold uppercase">Informativas</span>
                <p className="text-xl font-extrabold text-blue-450 mt-1">{pendenciesSummary.info}</p>
              </div>
            </div>

            {/* Pendencies Items */}
            <div className="p-6 flex-1 overflow-y-auto space-y-4">
              {isLoadingPendencies ? (
                <div className="py-16 flex flex-col items-center gap-3">
                  <div className="w-8 h-8 border-3 border-rose-600 border-t-transparent rounded-full animate-spin"></div>
                  <span className="text-xs text-slate-400 font-medium">Buscando pendências críticas...</span>
                </div>
              ) : pendenciesItems.length === 0 ? (
                <div className="py-16 text-center text-slate-500 text-sm flex flex-col items-center gap-2">
                  <CheckCircle2 className="w-8 h-8 text-emerald-500" />
                  <span>Nenhuma pendência encontrada! O fechamento operacional está totalmente limpo.</span>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {pendenciesItems.map((item, idx) => (
                    <div
                      key={`${item.employeeId}-${idx}`}
                      onClick={() => {
                        setIsPendenciesOpen(false);
                        router.push(item.targetUrl);
                      }}
                      className="p-3.5 rounded-lg border border-slate-800 hover:border-slate-700 bg-slate-950/20 hover:bg-slate-950/60 transition-all flex items-center justify-between gap-4 cursor-pointer group"
                    >
                      <div className="flex items-start gap-3">
                        <span className="mt-0.5 shrink-0">
                          {item.severity === 'CRITICAL' ? (
                            <XCircle className="w-5 h-5 text-rose-500" />
                          ) : item.severity === 'WARNING' ? (
                            <AlertTriangle className="w-5 h-5 text-amber-500" />
                          ) : (
                            <Info className="w-5 h-5 text-blue-450" />
                          )}
                        </span>
                        <div>
                          <p className="font-semibold text-slate-200 text-sm group-hover:text-white transition-colors">
                            {item.employeeName}
                          </p>
                          <p className="text-xs text-slate-400 mt-0.5">{item.description}</p>
                          <span className="text-[10px] text-slate-500 block mt-1 font-mono">
                            Registrado em: {new Date(item.createdAt).toLocaleString('pt-BR')}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {getSeverityBadge(item.severity)}
                        <ChevronRight className="w-4 h-4 text-slate-650 group-hover:text-slate-350 transition-colors" />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="px-6 py-4 border-t border-slate-800 bg-slate-900/40 flex justify-end">
              <button
                type="button"
                onClick={() => setIsPendenciesOpen(false)}
                className="px-5 py-2.5 rounded-lg bg-slate-800 hover:bg-slate-750 text-slate-300 text-xs font-semibold cursor-pointer"
              >
                Voltar ao Painel
              </button>
            </div>
          </div>
        </div>
      )}
      <PlanErrorAlert error={planError} onClose={() => setPlanError(null)} />
    </>
  );
}
