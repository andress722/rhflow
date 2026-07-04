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
  Calendar,
  HelpCircle,
  MessageSquare,
  Send,
  Award
} from 'lucide-react';
import Link from 'next/link';
import { trackEvent } from '@/lib/telemetry';
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

  const [activeTab, setActiveTab] = useState<'reports' | 'signatures'>('reports');
  const [signatures, setSignatures] = useState<any[]>([]);
  const [isSigning, setIsSigning] = useState(false);

  // Event Drawer/Modal States
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [selectedOcc, setSelectedOcc] = useState<any>(null);
  const [selectedCheckin, setSelectedCheckin] = useState<any>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isCheckinModalOpen, setIsCheckinModalOpen] = useState(false);
  const [isDrawerLoading, setIsDrawerLoading] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);

  const fetchSignatures = async () => {
    try {
      const res: any = await api.get('/timesheets/signatures');
      if (res.success) {
        setSignatures(res.data || []);
      }
    } catch (err) {
      console.error('Error fetching signatures:', err);
    }
  };

  const handleSignTimesheet = async (employeeId: string) => {
    setIsSigning(true);
    try {
      const currentMonth = new Date().toISOString().slice(0, 7);
      const res: any = await api.post('/timesheets/sign', {
        employeeId,
        periodMonth: currentMonth
      });
      if (res.success) {
        fetchSignatures();
      } else {
        alert(res.error?.message || 'Erro ao assinar espelho de ponto.');
      }
    } catch (err) {
      alert('Erro de conexão ao realizar assinatura eletrônica.');
    } finally {
      setIsSigning(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'signatures') {
      fetchSignatures();
    }
  }, [activeTab]);

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
      trackEvent('PAGE_VIEW', 'REPORTS', { path: '/app/reports' });
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

  const handleOpenEvent = async (item: any) => {
    setSelectedItem(item);
    if (item.type === 'REMOTE_CHECKIN') {
      setSelectedCheckin(item);
      setIsCheckinModalOpen(true);
    } else {
      setIsDrawerOpen(true);
      setIsDrawerLoading(true);
      setCommentText('');
      try {
        const res = await api.get(`/occurrences/${item.id}`);
        if (res.success) {
          setSelectedOcc(res.data);
        } else {
          alert(res.error?.message || 'Erro ao carregar detalhes da ocorrência.');
          setIsDrawerOpen(false);
        }
      } catch (err) {
        alert('Erro de conexão ao carregar detalhes.');
        setIsDrawerOpen(false);
      } finally {
        setIsDrawerLoading(false);
      }
    }
  };

  const handleStatusChange = async (newStatus: string) => {
    if (!selectedOcc) return;

    try {
      const res = await api.patch(`/occurrences/${selectedOcc.id}/status`, { status: newStatus });
      if (res.success) {
        const detailRes = await api.get(`/occurrences/${selectedOcc.id}`);
        if (detailRes.success) {
          setSelectedOcc(detailRes.data);
        }
        fetchReportData();
      } else {
        alert(res.error?.message || 'Erro ao alterar status.');
      }
    } catch (err) {
      alert('Erro de conexão.');
    }
  };

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentText.trim() || !selectedOcc) return;

    setIsSubmittingComment(true);
    try {
      const res = await api.post(`/occurrences/${selectedOcc.id}/events`, { message: commentText });
      if (res.success) {
        setCommentText('');
        const detailRes = await api.get(`/occurrences/${selectedOcc.id}`);
        if (detailRes.success) {
          setSelectedOcc(detailRes.data);
        }
        fetchReportData();
      } else {
        alert(res.error?.message || 'Erro ao adicionar observação.');
      }
    } catch (err) {
      alert('Erro de conexão.');
    } finally {
      setIsSubmittingComment(false);
    }
  };

  const handleViewFile = async (certId: string) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api'}/medical-certificates/${certId}/file`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (!response.ok) {
        alert('Erro ao carregar o arquivo ou permissão negada.');
        return;
      }
      const blob = await response.blob();
      const fileUrl = URL.createObjectURL(blob);
      window.open(fileUrl, '_blank');
    } catch (err) {
      alert('Erro de conexão ao carregar arquivo.');
    }
  };

  const getEventIcon = (eventType: string) => {
    switch (eventType) {
      case 'OCCURRENCE_CREATED':
        return <Clock className="w-4 h-4 text-indigo-400" />;
      case 'WHATSAPP_INBOUND_RECEIVED':
        return <MessageSquare className="w-4 h-4 text-emerald-400" />;
      case 'WHATSAPP_OUTBOUND_SENT':
        return <Send className="w-4 h-4 text-sky-400" />;
      case 'STATUS_CHANGED':
        return <AlertCircle className="w-4 h-4 text-amber-400" />;
      case 'COMMENT_ADDED':
        return <MessageSquare className="w-4 h-4 text-slate-300" />;
      case 'AUTOMATION_SKIPPED_DUPLICATE':
        return <XCircle className="w-4 h-4 text-rose-400" />;
      case 'MEDICAL_CERTIFICATE_UPLOADED':
        return <FileText className="w-4 h-4 text-indigo-400" />;
      case 'MEDICAL_CERTIFICATE_APPROVED':
        return <CheckCircle2 className="w-4 h-4 text-emerald-400" />;
      case 'MEDICAL_CERTIFICATE_REJECTED':
        return <XCircle className="w-4 h-4 text-rose-400" />;
      case 'MEDICAL_CERTIFICATE_RESUBMISSION_REQUESTED':
        return <AlertCircle className="w-4 h-4 text-orange-400" />;
      case 'MEDICAL_CERTIFICATE_FILE_VIEWED':
        return <Search className="w-4 h-4 text-sky-400" />;
      case 'ABSENCE_PERIOD_CREATED':
        return <Clock className="w-4 h-4 text-purple-400" />;
      case 'EMPLOYEE_NOTIFIED':
        return <Send className="w-4 h-4 text-sky-400" />;
      case 'MANAGER_NOTIFIED':
        return <Send className="w-4 h-4 text-teal-400" />;
      default:
        return <HelpCircle className="w-4 h-4 text-slate-500" />;
    }
  };

  const getSourceBadge = (source: string) => {
    switch (source) {
      case 'WHATSAPP':
        return <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] font-bold">WhatsApp</span>;
      case 'SYSTEM':
      case 'AUTOMATION':
        return <span className="px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 text-[10px] font-bold">Automação</span>;
      default:
        return <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700 text-[10px] font-bold">Manual</span>;
    }
  };

  const getTypeLabel = (type: string) => {
    return OCCURRENCE_TYPES[type] || type;
  };

  const isViewer = currentUser?.role === 'VIEWER';

  const handleExportCSV = () => {
    if (!fromDate || !toDate) return;
    if (isExporting) return;

    setIsExporting(true);
    setExportError(null);
    setExportErrorRequestId(null);
    trackEvent('REPORT_EXPORTED', 'REPORTS', { format: 'CSV', fromDate, toDate });

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

  const handleExportAFD = () => {
    if (!fromDate || !toDate) return;
    if (isExporting) return;

    setIsExporting(true);
    setExportError(null);
    setExportErrorRequestId(null);
    trackEvent('REPORT_EXPORTED', 'REPORTS', { format: 'AFD', fromDate, toDate });

    const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';
    const token = localStorage.getItem('token');
    const params = new URLSearchParams();
    params.append('from', fromDate);
    params.append('to', toDate);

    const exportUrl = `${API_URL}/reports/afd-export?${params.toString()}`;
    const headers = new Headers();
    if (token) {
      headers.append('Authorization', `Bearer ${token}`);
    }

    fetch(exportUrl, { headers })
      .then(async (response) => {
        if (!response.ok) {
          const json = await response.json();
          const err = new Error(json.error?.message || json.error || json.message || 'Erro ao exportar arquivo.') as any;
          err.requestId = json.error?.requestId;
          throw err;
        }
        return response.blob();
      })
      .then((blob) => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `AFD_Portaria671_${fromDate}_${toDate}.txt`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(url);
      })
      .catch((err) => {
        console.error('Error exporting AFD:', err);
        const errMsg = err.message || 'Erro de conexão com o servidor ao exportar.';
        setExportError(errMsg);
        if (err.requestId) {
          setExportErrorRequestId(err.requestId);
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
          <Link
            href="/app/help"
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-indigo-950/30 hover:bg-indigo-900/30 text-indigo-400 border border-indigo-900/40 text-xs font-semibold transition-all cursor-pointer"
          >
            <HelpCircle className="w-3.5 h-3.5" />
            <span>Ver Manuais</span>
          </Link>
          <button
            onClick={() => setIsPendenciesOpen(true)}
            className="px-4 py-2 rounded-lg bg-rose-600/15 hover:bg-rose-600/25 border border-rose-500/30 hover:border-rose-500/40 text-rose-400 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-lg"
          >
            <AlertTriangle className="w-4 h-4 text-rose-500 animate-pulse" />
            <span>Pendências ({pendenciesSummary.total})</span>
          </button>

          {!isViewer && (
            <>
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
              <button
                onClick={handleExportAFD}
                disabled={isExporting}
                className="px-4 py-2 rounded-lg bg-slate-900 hover:bg-slate-850 border border-slate-800 hover:border-slate-700 text-indigo-400 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-md"
              >
                {isExporting ? (
                  <span>Exportando...</span>
                ) : (
                  <>
                    <FileText className="w-4 h-4 text-indigo-400" />
                    <span>Exportar layout AFD</span>
                  </>
                )}
              </button>
            </>
          )}
        </div>
      </div>

      <div className="p-3.5 rounded-lg bg-slate-950 border border-slate-850 text-slate-450 text-[10px] leading-relaxed">
        <strong>Nota de Compliance Regulatório:</strong> Esta exportação técnica em layout AFD deve ser validada conforme o enquadramento regulatório aplicável à operação da empresa e ao tipo de registrador de ponto utilizado. O PresençaFlow fornece a geração de layouts técnicos AFD como ferramenta operacional de suporte ao RH.
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

      {/* Tab Switcher */}
      <div className="flex border-b border-slate-800 gap-6">
        <button
          onClick={() => setActiveTab('reports')}
          className={`pb-3 text-sm font-semibold transition-all border-b-2 cursor-pointer ${
            activeTab === 'reports'
              ? 'border-indigo-500 text-white'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          Conciliação de Ocorrências
        </button>
        <button
          onClick={() => setActiveTab('signatures')}
          className={`pb-3 text-sm font-semibold transition-all border-b-2 cursor-pointer ${
            activeTab === 'signatures'
              ? 'border-indigo-500 text-white'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          Assinaturas de Espelhos de Ponto (Lei 14.063)
        </button>
      </div>

      {activeTab === 'reports' && (
        <>
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
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-4">
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

        {/* Meta de Absenteísmo (KPI) */}
        <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 shadow-lg flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[9px] font-bold text-slate-400 uppercase">Meta Absenteísmo</span>
            <Award className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="mt-2">
            {(() => {
              const absenteeismLimit = 2.0; 
              const occurrencesCount = reportSummary.absences + reportSummary.lateArrivals;
              const totalPossibleCheckins = (reportItems.length || 1) * 20; 
              const actualRate = parseFloat(((occurrencesCount / totalPossibleCheckins) * 100).toFixed(2));
              const isOverLimit = actualRate > absenteeismLimit;

              return (
                <>
                  <p className={`text-2xl font-extrabold tracking-tight ${isOverLimit ? 'text-red-400' : 'text-emerald-400'}`}>
                    {actualRate}%
                  </p>
                  <p className="text-[9px] text-slate-500 font-sans mt-0.5">Meta: máx {absenteeismLimit}%</p>
                </>
              );
            })()}
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
                    <tr key={`${item.employeeId}-${item.date}-${idx}`} onClick={() => handleOpenEvent(item)} className="cursor-pointer hover:bg-slate-800/30 active:bg-slate-800/40 transition-colors">
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
      </>
      )}

      {activeTab === 'signatures' && (
        <div className="space-y-6 animate-fadeIn">
          {/* Info Card */}
          <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 shadow-xl space-y-2">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Award className="w-4 h-4 text-indigo-400" />
              <span>Painel de Assinatura Eletrônica de Espelho de Ponto (Lei 14.063/2020)</span>
            </h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              O PresençaFlow RH assegura validade legal para o fechamento de ponto mensal de equipes de campo e híbridas. Colete o aceite com IP, data/hora e hash de auditoria de forma simples e digital.
            </p>
          </div>

          {/* List of employees and signatures status */}
          <div className="rounded-xl border border-slate-800 bg-slate-900 overflow-hidden shadow-xl">
            <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/20">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Período de Referência: Julho/2026</span>
              <span className="text-xs text-slate-500 font-mono">Assinaturas Coletadas: {signatures.length}</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-400 border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-900/50 text-slate-500 font-semibold text-xs uppercase tracking-wider">
                    <th className="px-6 py-3.5">Colaborador</th>
                    <th className="px-6 py-3.5">Setor</th>
                    <th className="px-6 py-3.5">Status de Assinatura</th>
                    <th className="px-6 py-3.5">Metadados de Auditoria</th>
                    <th className="px-6 py-3.5 text-right">Ação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {reportItems.map((item) => {
                    const signature = signatures.find((sig) => sig.employeeId === item.employeeId);
                    const isSigned = !!signature;

                    return (
                      <tr key={item.employeeId} className="hover:bg-slate-800/20 transition-colors">
                        <td className="px-6 py-4 font-semibold text-slate-200">{item.employeeName}</td>
                        <td className="px-6 py-4 text-xs">{item.sector || '-'}</td>
                        <td className="px-6 py-4">
                          {isSigned ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                              ASSINADO DIGITALMENTE
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-800 text-slate-500 border border-slate-700">
                              PENDENTE DE ASSINATURA
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-xs font-mono">
                          {isSigned ? (
                            <div className="space-y-0.5">
                              <p className="text-[10px] text-slate-350">Hash: {signature.auditHash.slice(0, 16)}...</p>
                              <p className="text-[9px] text-slate-500">IP: {signature.ipAddress} • {new Date(signature.signedAt).toLocaleDateString('pt-BR')}</p>
                            </div>
                          ) : (
                            <span className="text-slate-650 italic">Aguardando assinatura</span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-right">
                          {!isSigned && (
                            <button
                              onClick={() => handleSignTimesheet(item.employeeId)}
                              disabled={isSigning}
                              className="px-3 py-1.5 rounded bg-emerald-650 hover:bg-emerald-500 disabled:bg-emerald-700/50 disabled:cursor-not-allowed text-white text-xs font-bold transition-all cursor-pointer shadow-md"
                            >
                              {isSigning ? 'Assinando...' : 'Assinar Espelho'}
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

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
      {/* Drawer / Modal Side Panel for Occurrence Detail & Timeline */}
      {isDrawerOpen && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm animate-fade-in">
          {/* Backdrop closer */}
          <div className="flex-1" onClick={() => setIsDrawerOpen(false)}></div>

          {/* Drawer container */}
          <div className="w-full max-w-xl bg-slate-900 border-l border-slate-800 h-full flex flex-col shadow-2xl animate-slide-left text-slate-200">
            {isDrawerLoading || !selectedOcc ? (
              <div className="flex-1 flex flex-col items-center justify-center gap-3">
                <div className="w-8 h-8 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
                <span className="text-sm text-slate-400">Carregando detalhes...</span>
              </div>
            ) : (
              <>
                {/* Header */}
                <div className="px-6 py-5 border-b border-slate-800 flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-bold text-white">{selectedOcc.title}</h2>
                    <p className="text-xs text-slate-400">{getTypeLabel(selectedOcc.type)}</p>
                  </div>
                  <button
                    onClick={() => setIsDrawerOpen(false)}
                    className="text-slate-400 hover:text-slate-200 font-medium text-sm transition-colors cursor-pointer"
                  >
                    Fechar
                  </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                  {/* Info Grid */}
                  <div className="grid grid-cols-2 gap-4 p-4 rounded-lg bg-slate-950/40 border border-slate-850">
                    <div>
                      <p className="text-[10px] font-semibold text-slate-500 uppercase">Funcionário</p>
                      <p className="text-sm font-semibold text-slate-200">{selectedOcc.employee?.fullName}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-semibold text-slate-500 uppercase">Contato</p>
                      <p className="text-sm font-semibold text-slate-200">{selectedOcc.employee?.whatsapp}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-semibold text-slate-500 uppercase">Data do Ocorrido</p>
                      <p className="text-sm text-slate-350">{new Date(selectedOcc.occurrenceDate).toLocaleString('pt-BR')}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-semibold text-slate-500 uppercase">Origem / Gravidade</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        {getSourceBadge(selectedOcc.source)}
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold border ${
                          selectedOcc.severity === 'HIGH'
                            ? 'bg-red-500/10 text-red-400 border-red-500/20'
                            : 'bg-slate-850 text-slate-400 border-slate-800'
                        }`}>{selectedOcc.severity}</span>
                      </div>
                    </div>
                  </div>

                  {selectedOcc.description && (
                    <div className="space-y-1">
                      <h3 className="text-xs font-bold text-slate-500 uppercase">Mensagem / Descrição</h3>
                      <p className="text-sm text-slate-300 p-3 rounded-lg bg-slate-950/20 border border-slate-850 leading-relaxed font-sans">{selectedOcc.description}</p>
                    </div>
                  )}

                  {/* Linked Medical Certificates */}
                  {selectedOcc.medicalCertificates && selectedOcc.medicalCertificates.length > 0 && (
                    <div className="space-y-2">
                      <h3 className="text-xs font-bold text-slate-500 uppercase">Atestados Médicos Vinculados</h3>
                      <div className="space-y-2">
                        {selectedOcc.medicalCertificates.map((cert: any) => (
                          <div key={cert.id} className="flex items-center justify-between p-3 rounded-lg bg-slate-950/40 border border-slate-800">
                            <div className="overflow-hidden mr-2">
                              <p className="text-xs font-semibold text-slate-200 truncate max-w-[250px]" title={cert.originalFilename}>
                                {cert.originalFilename}
                              </p>
                              <div className="flex gap-2 items-center mt-1">
                                <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${
                                  cert.status === 'APPROVED' ? 'bg-emerald-500/10 text-emerald-400' :
                                  cert.status === 'REJECTED' ? 'bg-red-500/10 text-red-400' :
                                  cert.status === 'RESUBMISSION_REQUESTED' ? 'bg-amber-500/10 text-amber-400' :
                                  'bg-slate-800 text-slate-400'
                                }`}>
                                  {cert.status}
                                </span>
                                <span className="text-[10px] text-slate-500 font-mono">
                                  {(cert.fileSize / 1024).toFixed(1)} KB
                                </span>
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleViewFile(cert.id)}
                              className="px-2.5 py-1.5 rounded bg-indigo-600/10 hover:bg-indigo-600/20 text-indigo-400 text-xs font-bold border border-indigo-500/20 transition-all cursor-pointer shrink-0"
                            >
                              Ver Arquivo
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Actions Section (Status Update) */}
                  {!isViewer && (
                    <div className="space-y-2">
                      <label className="block text-xs font-bold text-slate-500 uppercase">Alterar Status da Ocorrência</label>
                      <select
                        value={selectedOcc.status}
                        onChange={(e) => handleStatusChange(e.target.value)}
                        className="block w-full px-4 py-2 rounded-lg bg-slate-950 border border-slate-800 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all text-sm cursor-pointer"
                      >
                        {['OPEN', 'WAITING_EMPLOYEE', 'WAITING_MANAGER', 'WAITING_HR', 'RESOLVED', 'REJECTED', 'CANCELLED'].map((stVal) => (
                          <option key={stVal} value={stVal}>{OCCURRENCE_STATUSES[stVal] || stVal}</option>
                        ))}
                      </select>
                    </div>
                  )}

                  {/* Timeline (Occurrence Events) */}
                  <div className="space-y-4">
                    <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Histórico / Timeline</h3>
                    <div className="relative border-l border-slate-800 ml-3 pl-6 space-y-6">
                      {selectedOcc.events?.map((ev: any) => {
                        const Icon = getEventIcon(ev.eventType);
                        return (
                          <div key={ev.id} className="relative">
                            {/* Icon marker */}
                            <span className="absolute -left-[34px] top-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-slate-900 border border-slate-800 shadow shadow-black">
                              {Icon}
                            </span>
                            <div>
                              <div className="flex items-center justify-between gap-2">
                                <p className="text-xs font-semibold text-slate-200">
                                  {ev.eventType === 'OCCURRENCE_CREATED' && 'Ocorrência Criada'}
                                  {ev.eventType === 'WHATSAPP_INBOUND_RECEIVED' && 'Mensagem Recebida'}
                                  {ev.eventType === 'WHATSAPP_OUTBOUND_SENT' && 'Mensagem Enviada'}
                                  {ev.eventType === 'STATUS_CHANGED' && 'Status Atualizado'}
                                  {ev.eventType === 'COMMENT_ADDED' && 'Observação Adicionada'}
                                  {ev.eventType === 'AUTOMATION_SKIPPED_DUPLICATE' && 'Automação Ignorada'}
                                  {ev.eventType === 'MEDICAL_CERTIFICATE_UPLOADED' && 'Atestado Médico Anexado'}
                                  {ev.eventType === 'MEDICAL_CERTIFICATE_APPROVED' && 'Atestado Aprovado'}
                                  {ev.eventType === 'MEDICAL_CERTIFICATE_REJECTED' && 'Atestado Recusado'}
                                  {ev.eventType === 'MEDICAL_CERTIFICATE_RESUBMISSION_REQUESTED' && 'Reenvio de Atestado Solicitado'}
                                  {ev.eventType === 'MEDICAL_CERTIFICATE_FILE_VIEWED' && 'Atestado Visualizado'}
                                  {ev.eventType === 'ABSENCE_PERIOD_CREATED' && 'Período de Afastamento Criado'}
                                  {ev.eventType === 'EMPLOYEE_NOTIFIED' && 'Funcionário Notificado'}
                                  {ev.eventType === 'MANAGER_NOTIFIED' && 'Gestor Notificado'}
                                </p>
                                <span className="text-[10px] text-slate-500">{new Date(ev.createdAt).toLocaleString('pt-BR')}</span>
                              </div>
                              <p className="text-xs text-slate-400 mt-1">{ev.message}</p>
                              
                              {/* Render message bubbles */}
                              {ev.metadata && ev.metadata.content && (
                                <div className="mt-2 p-2.5 rounded bg-slate-950/40 border border-slate-850/50 text-[11px] text-indigo-300 font-sans italic max-w-sm">
                                  "{ev.metadata.content}"
                                </div>
                              )}
                              {ev.metadata && ev.metadata.message && ev.eventType === 'WHATSAPP_INBOUND_RECEIVED' && (
                                <div className="mt-2 p-2.5 rounded bg-slate-950/40 border border-slate-850/50 text-[11px] text-emerald-400 font-sans italic max-w-sm">
                                  "{ev.metadata.message}"
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Footer / Comment Box */}
                {!isViewer && (
                  <form onSubmit={handleAddComment} className="p-4 border-t border-slate-800 bg-slate-900/40 flex items-center gap-3">
                    <input
                      type="text"
                      required
                      placeholder="Adicionar observação na timeline..."
                      value={commentText}
                      onChange={(e) => setCommentText(e.target.value)}
                      className="flex-1 px-4 py-2 rounded-lg bg-slate-950 border border-slate-800 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all text-xs"
                    />
                    <button
                      type="submit"
                      disabled={isSubmittingComment || !commentText.trim()}
                      className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-700/50 disabled:cursor-not-allowed text-white text-xs font-semibold shadow transition-all cursor-pointer"
                    >
                      {isSubmittingComment ? '...' : 'Comentar'}
                    </button>
                  </form>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* Modal - Remote Checkin Detail */}
      {isCheckinModalOpen && selectedCheckin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in animate-fade-in">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-2xl flex flex-col text-slate-200">
            {/* Header */}
            <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
              <h2 className="text-md font-bold text-white">Detalhes do Check-in Remoto</h2>
              <button
                type="button"
                onClick={() => setIsCheckinModalOpen(false)}
                className="text-slate-400 hover:text-slate-200 text-sm font-medium transition-colors cursor-pointer"
              >
                Fechar
              </button>
            </div>

            {/* Content */}
            <div className="p-6 space-y-4">
              <div className="space-y-3.5">
                <div className="p-3 bg-slate-950/40 border border-slate-850 rounded-lg space-y-1">
                  <p className="text-[10px] font-semibold text-slate-500 uppercase">Funcionário</p>
                  <p className="text-sm font-bold text-slate-200">{selectedCheckin.employeeName}</p>
                  <p className="text-xs text-slate-400">CPF: {selectedCheckin.employeeCpfMasked}</p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 bg-slate-950/40 border border-slate-850 rounded-lg">
                    <p className="text-[10px] font-semibold text-slate-500 uppercase">Data</p>
                    <p className="text-xs font-semibold text-slate-200 mt-0.5">
                      {new Date(`${selectedCheckin.date}T12:00:00`).toLocaleDateString('pt-BR')}
                    </p>
                  </div>
                  <div className="p-3 bg-slate-950/40 border border-slate-850 rounded-lg">
                    <p className="text-[10px] font-semibold text-slate-500 uppercase">Status</p>
                    <div className="mt-0.5">{getStatusBadge(selectedCheckin.status)}</div>
                  </div>
                </div>

                <div className="p-3 bg-slate-950/40 border border-slate-850 rounded-lg space-y-1">
                  <p className="text-[10px] font-semibold text-slate-500 uppercase">Setor & Gestor</p>
                  <p className="text-xs text-slate-350">{selectedCheckin.sector}</p>
                  <p className="text-[10px] text-slate-500">Gestor Responsável: {selectedCheckin.managerName}</p>
                </div>

                <div className="p-3 bg-slate-950/40 border border-slate-850 rounded-lg space-y-1">
                  <p className="text-[10px] font-semibold text-slate-500 uppercase">Origem & Canal</p>
                  <p className="text-xs text-slate-350">{selectedCheckin.source}</p>
                </div>

                <div className="p-3 bg-slate-950/40 border border-slate-850 rounded-lg space-y-1">
                  <p className="text-[10px] font-semibold text-slate-500 uppercase">Conteúdo / Resposta</p>
                  <p className="text-xs text-slate-300 leading-relaxed font-sans">{selectedCheckin.notes || '-'}</p>
                </div>
              </div>

              {/* Footer */}
              <div className="pt-4 border-t border-slate-800 flex justify-end">
                <button
                  type="button"
                  onClick={() => setIsCheckinModalOpen(false)}
                  className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-750 text-slate-300 text-xs font-semibold cursor-pointer"
                >
                  Voltar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      <PlanErrorAlert error={planError} onClose={() => setPlanError(null)} />
    </>
  );
}
