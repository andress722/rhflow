'use client';

import React, { useState, useEffect } from 'react';
import {
  FileText,
  UploadCloud,
  Search,
  Filter,
  Calendar,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Info,
  Clock,
  ExternalLink,
  ChevronRight,
  Loader2,
  Download,
} from 'lucide-react';
import { api } from '@/lib/api';
import { getUser } from '@/lib/auth';
import PlanErrorAlert from '@/components/PlanErrorAlert';

const STATUS_LABELS = {
  RECEIVED: 'Recebido',
  UNDER_REVIEW: 'Em Análise',
  APPROVED: 'Aprovado',
  REJECTED: 'Rejeitado',
  RESUBMISSION_REQUESTED: 'Reenvio Solicitado',
};

const STATUS_THEMES: Record<string, string> = {
  RECEIVED: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20',
  UNDER_REVIEW: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  APPROVED: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  REJECTED: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
  RESUBMISSION_REQUESTED: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
};

export default function MedicalCertificatesPage() {
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [planError, setPlanError] = useState<string | null>(null);
  const [certificates, setCertificates] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [occurrences, setOccurrences] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  // Filtering
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [periodFilter, setPeriodFilter] = useState(''); // 'today' | 'week' | 'month' | ''

  // Upload Modal State
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [uploadEmployeeId, setUploadEmployeeId] = useState('');
  const [uploadOccurrenceId, setUploadOccurrenceId] = useState('');
  const [uploadCertDate, setUploadCertDate] = useState('');
  const [uploadSuggestedDays, setUploadSuggestedDays] = useState('');
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [uploadErrorRequestId, setUploadErrorRequestId] = useState<string | null>(null);

  // Review Drawer State
  const [selectedCert, setSelectedCert] = useState<any>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isDrawerLoading, setIsDrawerLoading] = useState(false);
  const [reviewAction, setReviewAction] = useState<'APPROVE' | 'REJECT' | 'RESUBMIT' | null>(null);

  // Review fields
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [approvedDays, setApprovedDays] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');
  const [notes, setNotes] = useState('');
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);
  const [reviewError, setReviewError] = useState('');
  const [reviewErrorRequestId, setReviewErrorRequestId] = useState<string | null>(null);

  // File Preview State
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewError, setPreviewError] = useState('');
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);

  useEffect(() => {
    const user = getUser();
    setCurrentUser(user);
    fetchData();
  }, []);

  const fetchData = async () => {
    setIsLoading(true);
    setError('');
    try {
      const certRes = await api.get('/medical-certificates');
      if (certRes.success) {
        setCertificates(certRes.data || []);
      } else {
        const errCode = certRes.error?.code || certRes.error || (certRes as any).error;
        if (['PLAN_LIMIT_EXCEEDED', 'PLAN_FEATURE_DISABLED', 'FEATURE_DISABLED', 'FORBIDDEN'].includes(errCode)) {
          setPlanError(errCode);
        } else {
          setError(certRes.error?.message || 'Erro ao carregar atestados médicos.');
        }
      }

      // Load employees list for upload dialog
      const empRes = await api.get('/employees');
      if (empRes.success) {
        setEmployees(empRes.data || []);
      }

      // Load occurrences to show linkage
      const occRes = await api.get('/occurrences');
      if (occRes.success) {
        setOccurrences(occRes.data || []);
      }
    } catch (err) {
      setError('Erro de conexão ao carregar dados.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenDrawer = async (cert: any) => {
    setSelectedCert(cert);
    setIsDrawerOpen(true);
    setIsDrawerLoading(true);
    setReviewAction(null);
    setStartDate('');
    setEndDate('');
    setApprovedDays('');
    setRejectionReason('');
    setNotes('');
    setReviewError('');
    setPreviewUrl(null);
    setPreviewError('');

    try {
      const res = await api.get(`/medical-certificates/${cert.id}`);
      if (res.success) {
        setSelectedCert(res.data);
        // Load file stream in background
        loadFilePreview(cert.id);
      } else {
        alert(res.error?.message || 'Erro ao carregar detalhes do atestado.');
        setIsDrawerOpen(false);
      }
    } catch (err) {
      alert('Erro de conexão.');
      setIsDrawerOpen(false);
    } finally {
      setIsDrawerLoading(false);
    }
  };

  const loadFilePreview = async (certId: string) => {
    setIsPreviewLoading(true);
    setPreviewError('');
    setPreviewUrl(null);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api'}/medical-certificates/${certId}/file`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (!response.ok) {
        if (response.status === 403) {
          throw new Error('FORBIDDEN');
        }
        throw new Error('Permissão negada ou arquivo físico não localizado.');
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      setPreviewUrl(url);
    } catch (err: any) {
      if (err.message === 'FORBIDDEN') {
        setIsDrawerOpen(false);
        setPlanError('FORBIDDEN');
      } else {
        setPreviewError(err.message || 'Erro de conexão ao recuperar arquivo.');
      }
    } finally {
      setIsPreviewLoading(false);
    }
  };

  const handleDownloadFile = () => {
    if (!previewUrl || !selectedCert) return;
    const a = document.createElement('a');
    a.href = previewUrl;
    a.download = selectedCert.originalFilename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  // Auto calculate days when startDate/endDate are selected
  useEffect(() => {
    if (startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);
      if (start <= end) {
        const diffTime = Math.abs(end.getTime() - start.getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1; // inclusive
        setApprovedDays(diffDays.toString());
      } else {
        setApprovedDays('');
      }
    }
  }, [startDate, endDate]);

  const handleReviewSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCert || !reviewAction) return;
    if (isSubmittingReview) return;

    setIsSubmittingReview(true);
    setReviewError('');
    setReviewErrorRequestId(null);

    let payload: any = {};
    if (reviewAction === 'APPROVE') {
      payload = {
        status: 'APPROVED',
        startDate: startDate ? new Date(startDate).toISOString() : undefined,
        endDate: endDate ? new Date(endDate).toISOString() : undefined,
        approvedDays: approvedDays ? parseInt(approvedDays, 10) : undefined,
        notes: notes || undefined,
      };
    } else if (reviewAction === 'REJECT') {
      payload = {
        status: 'REJECTED',
        rejectionReason,
        notes: notes || undefined,
      };
    } else {
      payload = {
        status: 'RESUBMISSION_REQUESTED',
        rejectionReason,
        notes: notes || undefined,
      };
    }

    try {
      const res = await api.patch(`/medical-certificates/${selectedCert.id}/review`, payload);
      if (res.success) {
        // Reset and refresh
        setIsDrawerOpen(false);
        fetchData();
      } else {
        const errCode = res.error?.code || res.error || (res as any).error;
        if (['PLAN_LIMIT_EXCEEDED', 'PLAN_FEATURE_DISABLED', 'FEATURE_DISABLED', 'FORBIDDEN'].includes(errCode)) {
          setIsDrawerOpen(false);
          setPlanError(errCode);
        } else {
          setReviewError(res.error?.message || 'Erro ao processar a avaliação.');
          if (res.error?.requestId) {
            setReviewErrorRequestId(res.error.requestId);
          }
        }
      }
    } catch (err) {
      setReviewError('Erro de rede ao submeter avaliação.');
    } finally {
      setIsSubmittingReview(false);
    }
  };

  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadEmployeeId || !uploadFile) {
      setUploadError('Funcionário e Arquivo são obrigatórios.');
      return;
    }
    if (isUploading) return;

    // Client-side file size verification (5MB)
    if (uploadFile.size > 5242880) {
      setUploadError('Tamanho do arquivo excede o limite de 5MB.');
      return;
    }

    setIsUploading(true);
    setUploadError('');
    setUploadErrorRequestId(null);

    const formData = new FormData();
    formData.append('employeeId', uploadEmployeeId);
    formData.append('file', uploadFile);
    if (uploadOccurrenceId) formData.append('occurrenceId', uploadOccurrenceId);
    if (uploadCertDate) formData.append('certificateDate', uploadCertDate);
    if (uploadSuggestedDays) formData.append('suggestedDays', uploadSuggestedDays);

    try {
      const res = await api.upload('/medical-certificates/upload', formData);
      if (res.success) {
        setIsUploadOpen(false);
        // Reset fields
        setUploadEmployeeId('');
        setUploadOccurrenceId('');
        setUploadCertDate('');
        setUploadSuggestedDays('');
        setUploadFile(null);
        fetchData();
      } else {
        const errCode = res.error?.code || res.error || (res as any).error;
        if (['PLAN_LIMIT_EXCEEDED', 'PLAN_FEATURE_DISABLED', 'FEATURE_DISABLED', 'FORBIDDEN'].includes(errCode)) {
          setIsUploadOpen(false);
          setPlanError(errCode);
        } else {
          setUploadError(res.error?.message || 'Erro ao enviar atestado.');
          if (res.error?.requestId) {
            setUploadErrorRequestId(res.error.requestId);
          }
        }
      }
    } catch (err) {
      setUploadError('Erro de conexão ao enviar arquivo.');
    } finally {
      setIsUploading(false);
    }
  };

  // Filtering Logic
  const filteredCertificates = certificates.filter((cert) => {
    const matchesSearch =
      cert.employee?.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      cert.originalFilename.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus = !statusFilter || cert.status === statusFilter;

    let matchesPeriod = true;
    if (periodFilter) {
      const certDate = new Date(cert.createdAt);
      const now = new Date();
      if (periodFilter === 'today') {
        matchesPeriod = certDate.toDateString() === now.toDateString();
      } else if (periodFilter === 'week') {
        const oneWeekAgo = new Date();
        oneWeekAgo.setDate(now.getDate() - 7);
        matchesPeriod = certDate >= oneWeekAgo;
      } else if (periodFilter === 'month') {
        const oneMonthAgo = new Date();
        oneMonthAgo.setMonth(now.getMonth() - 1);
        matchesPeriod = certDate >= oneMonthAgo;
      }
    }

    return matchesSearch && matchesStatus && matchesPeriod;
  });

  const isRoleAuthorizedToReview = currentUser && ['ADMIN', 'HR'].includes(currentUser.role);
  const showUploadAction = currentUser && ['ADMIN', 'HR'].includes(currentUser.role);

  // Filter occurrences for selected employee
  const employeeOccurrences = occurrences.filter(
    (occ) => occ.employeeId === uploadEmployeeId && occ.status !== 'RESOLVED' && occ.status !== 'CANCELLED'
  );

  return (
    <>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white flex items-center gap-3">
            <FileText className="w-8 h-8 text-indigo-500" />
            Controle de Atestados Médicos
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            Gestão de licenças médicas, upload seguro de atestados e validação de afastamentos.
          </p>
        </div>

        {showUploadAction && (
          <button
            onClick={() => setIsUploadOpen(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold shadow shadow-indigo-600/10 transition-all text-sm cursor-pointer"
          >
            <UploadCloud className="w-4.5 h-4.5" />
            Enviar Atestado
          </button>
        )}
      </div>

      {/* Filter and search bar */}
      <div className="flex flex-col md:flex-row gap-4 p-5 rounded-xl border border-slate-800 bg-slate-900 shadow-lg">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            type="text"
            placeholder="Buscar por funcionário ou arquivo..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="block w-full pl-10 pr-4 py-2 rounded-lg bg-slate-950 border border-slate-800 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all text-sm"
          />
        </div>
        <div className="flex gap-4">
          <div className="relative">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="block w-44 px-4 py-2 rounded-lg bg-slate-950 border border-slate-800 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all text-sm appearance-none cursor-pointer"
            >
              <option value="">Todos Status</option>
              {Object.entries(STATUS_LABELS).map(([val, label]) => (
                <option key={val} value={val}>{label}</option>
              ))}
            </select>
          </div>
          <div className="relative">
            <select
              value={periodFilter}
              onChange={(e) => setPeriodFilter(e.target.value)}
              className="block w-44 px-4 py-2 rounded-lg bg-slate-950 border border-slate-800 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all text-sm appearance-none cursor-pointer"
            >
              <option value="">Todo Período</option>
              <option value="today">Hoje</option>
              <option value="week">Últimos 7 dias</option>
              <option value="month">Último mês</option>
            </select>
          </div>
        </div>
      </div>

      {/* Main Table List */}
      <div className="rounded-xl border border-slate-800 bg-slate-900 overflow-hidden shadow-xl">
        {isLoading ? (
          <div className="py-20 flex flex-col items-center gap-3">
            <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
            <span className="text-sm text-slate-400">Carregando atestados...</span>
          </div>
        ) : error ? (
          <div className="py-16 text-center text-slate-400 flex flex-col items-center gap-3">
            <AlertCircle className="w-12 h-12 text-red-500" />
            <p className="text-sm">{error}</p>
          </div>
        ) : filteredCertificates.length === 0 ? (
          <div className="py-20 text-center text-slate-500">
            Nenhum atestado médico registrado correspondente.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-400 border-collapse">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-900/50 text-slate-500 font-semibold text-xs uppercase tracking-wider">
                  <th className="px-6 py-3.5">Funcionário</th>
                  <th className="px-6 py-3.5">Arquivo</th>
                  <th className="px-6 py-3.5">Data de Envio</th>
                  <th className="px-6 py-3.5">Dias Sugeridos</th>
                  <th className="px-6 py-3.5">Status</th>
                  <th className="px-6 py-3.5 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filteredCertificates.map((cert) => (
                  <tr key={cert.id} className="hover:bg-slate-800/20 transition-colors">
                    <td className="px-6 py-4">
                      <p className="font-semibold text-slate-200">{cert.employee?.fullName}</p>
                      <p className="text-xs text-slate-500">{cert.employee?.sector || '-'}</p>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-slate-300 font-mono text-xs truncate max-w-[200px]" title={cert.originalFilename}>
                        {cert.originalFilename}
                      </p>
                      <p className="text-[10px] text-slate-500 font-mono">
                        {(cert.fileSize / 1024).toFixed(1)} KB
                      </p>
                    </td>
                    <td className="px-6 py-4 text-xs text-slate-300">
                      {new Date(cert.createdAt).toLocaleDateString('pt-BR')} {new Date(cert.createdAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td className="px-6 py-4 text-slate-300 font-semibold">
                      {cert.suggestedDays ? `${cert.suggestedDays} dias` : '-'}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${STATUS_THEMES[cert.status] || ''}`}>
                        {STATUS_LABELS[cert.status as keyof typeof STATUS_LABELS] || cert.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => handleOpenDrawer(cert)}
                        className="px-3 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-indigo-400 hover:text-indigo-300 text-xs font-bold border border-slate-700 transition-colors cursor-pointer"
                      >
                        {isRoleAuthorizedToReview && ['RECEIVED', 'UNDER_REVIEW'].includes(cert.status) ? 'Analisar' : 'Visualizar'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Upload Modal Dialog */}
      {isUploadOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-2xl flex flex-col text-slate-200">
            <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <UploadCloud className="w-5 h-5 text-indigo-500" />
                Upload de Atestado Médico
              </h2>
              <button
                type="button"
                onClick={() => setIsUploadOpen(false)}
                className="text-slate-400 hover:text-slate-200 text-sm font-medium transition-colors cursor-pointer"
              >
                Fechar
              </button>
            </div>

            <form onSubmit={handleUploadSubmit} className="p-6 space-y-4">
              {uploadError && (
                <div className="flex flex-col gap-1 p-3.5 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>{uploadError}</span>
                  </div>
                  {uploadErrorRequestId && (
                    <span className="text-[10px] text-slate-500 font-mono mt-1 pl-6 block">
                      ID da Requisição: {uploadErrorRequestId}
                    </span>
                  )}
                </div>
              )}

              {/* Employee selection */}
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-slate-400 uppercase">Funcionário *</label>
                <select
                  required
                  value={uploadEmployeeId}
                  onChange={(e) => {
                    setUploadEmployeeId(e.target.value);
                    setUploadOccurrenceId('');
                  }}
                  className="block w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm cursor-pointer"
                >
                  <option value="">Selecione o funcionário</option>
                  {employees.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.fullName} ({emp.sector || 'Sem Setor'})
                    </option>
                  ))}
                </select>
              </div>

              {/* Link to Occurrence (conditional) */}
              {uploadEmployeeId && (
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-slate-400 uppercase">
                    Vincular Ocorrência Pendente (Opcional)
                  </label>
                  <select
                    value={uploadOccurrenceId}
                    onChange={(e) => setUploadOccurrenceId(e.target.value)}
                    className="block w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm cursor-pointer"
                  >
                    <option value="">Criar nova ocorrência MEDICAL_CERTIFICATE</option>
                    {employeeOccurrences.map((occ) => (
                      <option key={occ.id} value={occ.id}>
                        {occ.title} ({new Date(occ.occurrenceDate).toLocaleDateString('pt-BR')})
                      </option>
                    ))}
                  </select>
                  <p className="text-[10px] text-slate-500">
                    Se não selecionado, uma nova ocorrência de atestado médico será aberta na timeline do funcionário.
                  </p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                {/* Certificate Date */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-slate-400 uppercase">Data do Atestado</label>
                  <input
                    type="date"
                    value={uploadCertDate}
                    onChange={(e) => setUploadCertDate(e.target.value)}
                    className="block w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm cursor-pointer"
                  />
                </div>

                {/* Suggested Days */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-slate-400 uppercase">Dias Sugeridos</label>
                  <input
                    type="number"
                    min="1"
                    placeholder="Ex: 3"
                    value={uploadSuggestedDays}
                    onChange={(e) => setUploadSuggestedDays(e.target.value)}
                    className="block w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm"
                  />
                </div>
              </div>

              {/* File upload */}
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-slate-400 uppercase">Arquivo do Atestado *</label>
                <div className="flex items-center justify-center w-full">
                  <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-slate-800 border-dashed rounded-lg cursor-pointer bg-slate-950/40 hover:bg-slate-950/80 hover:border-slate-700 transition-all">
                    <div className="flex flex-col items-center justify-center pt-5 pb-6">
                      <UploadCloud className="w-8 h-8 text-slate-500 mb-2" />
                      <p className="text-xs text-slate-400 font-semibold">
                        {uploadFile ? uploadFile.name : 'Selecione ou arraste o arquivo'}
                      </p>
                      <p className="text-[10px] text-slate-500 mt-1">
                        PDF, JPG, PNG ou WEBP (Máx. 5MB)
                      </p>
                    </div>
                    <input
                      type="file"
                      required
                      accept=".pdf, .jpg, .jpeg, .png, .webp"
                      onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                      className="hidden"
                    />
                  </label>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-800 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsUploadOpen(false)}
                  className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isUploading}
                  className="px-5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold flex items-center gap-2 shadow cursor-pointer disabled:opacity-50"
                >
                  {isUploading ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      Enviando...
                    </>
                  ) : (
                    'Confirmar Envio'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Review Drawer Side Panel */}
      {isDrawerOpen && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/70 backdrop-blur-sm">
          <div className="flex-1" onClick={() => setIsDrawerOpen(false)}></div>

          <div className="w-full max-w-4xl bg-slate-900 border-l border-slate-800 h-full flex shadow-2xl animate-slide-left text-slate-200 overflow-hidden">
            {/* Main scrollable detail panel */}
            <div className="w-1/2 flex flex-col h-full border-r border-slate-800 overflow-y-auto">
              {isDrawerLoading || !selectedCert ? (
                <div className="flex-1 flex flex-col items-center justify-center gap-3">
                  <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
                  <span className="text-sm text-slate-400">Carregando detalhes...</span>
                </div>
              ) : (
                <>
                  {/* Header */}
                  <div className="px-6 py-5 border-b border-slate-800 flex items-center justify-between">
                    <div>
                      <h2 className="text-lg font-bold text-white">Revisão de Atestado</h2>
                      <p className="text-xs text-slate-400">Código: {selectedCert.id.substring(0, 8)}...</p>
                    </div>
                    <button
                      onClick={() => setIsDrawerOpen(false)}
                      className="text-slate-400 hover:text-slate-200 font-medium text-sm transition-colors cursor-pointer"
                    >
                      Fechar
                    </button>
                  </div>

                  {/* Body Content */}
                  <div className="p-6 space-y-6 flex-1">
                    {/* Employee & Certificate Info Card */}
                    <div className="p-4 rounded-lg bg-slate-950/40 border border-slate-850 space-y-3">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-[10px] font-semibold text-slate-500 uppercase">Funcionário</p>
                          <p className="text-sm font-semibold text-slate-200">{selectedCert.employee?.fullName}</p>
                          <p className="text-[11px] text-slate-400">{selectedCert.employee?.sector || 'Sem setor'}</p>
                        </div>
                        <div>
                          <p className="text-[10px] font-semibold text-slate-500 uppercase">Contato WhatsApp</p>
                          <p className="text-sm font-semibold text-slate-200">{selectedCert.employee?.whatsapp}</p>
                        </div>
                        <div>
                          <p className="text-[10px] font-semibold text-slate-500 uppercase">Data de Emissão</p>
                          <p className="text-sm text-slate-300">
                            {selectedCert.certificateDate
                              ? new Date(selectedCert.certificateDate).toLocaleDateString('pt-BR')
                              : 'Não informada'}
                          </p>
                        </div>
                        <div>
                          <p className="text-[10px] font-semibold text-slate-500 uppercase">Dias Sugeridos</p>
                          <p className="text-sm text-slate-200 font-semibold">
                            {selectedCert.suggestedDays ? `${selectedCert.suggestedDays} dias` : 'Não informado'}
                          </p>
                        </div>
                      </div>

                      {selectedCert.occurrence && (
                        <div className="pt-3 border-t border-slate-800/60">
                          <p className="text-[10px] font-semibold text-slate-500 uppercase">Ocorrência Vinculada</p>
                          <div className="flex items-center justify-between mt-1">
                            <span className="text-xs text-indigo-400 font-medium">{selectedCert.occurrence.title}</span>
                            <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700">
                              {selectedCert.occurrence.status}
                            </span>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Status Badge & Notes */}
                    <div className="space-y-3">
                      <h3 className="text-xs font-bold text-slate-500 uppercase">Status da Revisão</h3>
                      <div className="flex items-center gap-2">
                        <span className={`inline-flex px-3 py-1 rounded-full text-xs font-semibold border ${STATUS_THEMES[selectedCert.status]}`}>
                          {STATUS_LABELS[selectedCert.status as keyof typeof STATUS_LABELS] || selectedCert.status}
                        </span>
                      </div>

                      {/* Display final outcome notes */}
                      {selectedCert.notes && (
                        <div className="p-3 rounded-lg bg-slate-950/20 border border-slate-850">
                          <p className="text-[10px] font-bold text-slate-500 uppercase">Observações do RH</p>
                          <p className="text-xs text-slate-300 mt-1">{selectedCert.notes}</p>
                        </div>
                      )}

                      {selectedCert.rejectionReason && (
                        <div className="p-3 rounded-lg bg-rose-950/10 border border-rose-900/20">
                          <p className="text-[10px] font-bold text-rose-500 uppercase">Motivo de Rejeição/Reenvio</p>
                          <p className="text-xs text-rose-300 mt-1">{selectedCert.rejectionReason}</p>
                        </div>
                      )}

                      {/* Approved details display */}
                      {selectedCert.status === 'APPROVED' && (
                        <div className="grid grid-cols-3 gap-2 p-3 rounded-lg bg-emerald-950/10 border border-emerald-900/20 text-xs">
                          <div>
                            <span className="text-slate-500 block text-[9px] uppercase font-bold">Início</span>
                            <span className="text-emerald-400 font-semibold">
                              {selectedCert.startDate ? new Date(selectedCert.startDate).toLocaleDateString('pt-BR') : '-'}
                            </span>
                          </div>
                          <div>
                            <span className="text-slate-500 block text-[9px] uppercase font-bold">Fim</span>
                            <span className="text-emerald-400 font-semibold">
                              {selectedCert.endDate ? new Date(selectedCert.endDate).toLocaleDateString('pt-BR') : '-'}
                            </span>
                          </div>
                          <div>
                            <span className="text-slate-500 block text-[9px] uppercase font-bold">Dias Abonados</span>
                            <span className="text-emerald-400 font-bold">{selectedCert.approvedDays}</span>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Review Forms for ADMIN/HR if status is mutable */}
                    {isRoleAuthorizedToReview && ['RECEIVED', 'UNDER_REVIEW'].includes(selectedCert.status) && (
                      <div className="pt-6 border-t border-slate-800 space-y-4">
                        <h3 className="text-sm font-bold text-white">Processar Decisão</h3>

                        {reviewError && (
                          <div className="flex flex-col gap-1 p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs">
                            <div className="flex items-center gap-2">
                              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                              <span>{reviewError}</span>
                            </div>
                            {reviewErrorRequestId && (
                              <span className="text-[10px] text-slate-500 font-mono mt-1 pl-6 block">
                                ID da Requisição: {reviewErrorRequestId}
                              </span>
                            )}
                          </div>
                        )}

                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => setReviewAction('APPROVE')}
                            className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all border ${
                              reviewAction === 'APPROVE'
                                ? 'bg-emerald-600 text-white border-emerald-500'
                                : 'bg-slate-950/40 text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/5'
                            }`}
                          >
                            Aprovar
                          </button>
                          <button
                            type="button"
                            onClick={() => setReviewAction('REJECT')}
                            className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all border ${
                              reviewAction === 'REJECT'
                                ? 'bg-rose-600 text-white border-rose-500'
                                : 'bg-slate-950/40 text-rose-400 border-rose-500/20 hover:bg-rose-500/5'
                            }`}
                          >
                            Recusar
                          </button>
                          <button
                            type="button"
                            onClick={() => setReviewAction('RESUBMIT')}
                            className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all border ${
                              reviewAction === 'RESUBMIT'
                                ? 'bg-orange-600 text-white border-orange-500'
                                : 'bg-slate-950/40 text-orange-400 border-orange-500/20 hover:bg-orange-500/5'
                            }`}
                          >
                            Pedir Reenvio
                          </button>
                        </div>

                        {reviewAction && (
                          <form onSubmit={handleReviewSubmit} className="space-y-4 p-4 rounded-lg bg-slate-950/30 border border-slate-850">
                            {reviewAction === 'APPROVE' && (
                              <>
                                <div className="grid grid-cols-2 gap-3">
                                  <div className="space-y-1">
                                    <label className="block text-[10px] font-bold text-slate-500 uppercase">Data de Início *</label>
                                    <input
                                      type="date"
                                      required
                                      value={startDate}
                                      onChange={(e) => setStartDate(e.target.value)}
                                      className="block w-full px-3 py-1.5 rounded bg-slate-950 border border-slate-855 text-white focus:outline-none focus:ring-1 focus:ring-indigo-500 text-xs"
                                    />
                                  </div>
                                  <div className="space-y-1">
                                    <label className="block text-[10px] font-bold text-slate-500 uppercase">Data de Término *</label>
                                    <input
                                      type="date"
                                      required
                                      value={endDate}
                                      onChange={(e) => setEndDate(e.target.value)}
                                      className="block w-full px-3 py-1.5 rounded bg-slate-950 border border-slate-855 text-white focus:outline-none focus:ring-1 focus:ring-indigo-500 text-xs"
                                    />
                                  </div>
                                </div>
                                <div className="space-y-1">
                                  <label className="block text-[10px] font-bold text-slate-500 uppercase">Dias de Afastamento Aprovados *</label>
                                  <input
                                    type="number"
                                    required
                                    min="1"
                                    placeholder="Calculado automaticamente"
                                    value={approvedDays}
                                    onChange={(e) => setApprovedDays(e.target.value)}
                                    className="block w-full px-3 py-1.5 rounded bg-slate-950 border border-slate-855 text-white focus:outline-none focus:ring-1 focus:ring-indigo-500 text-xs"
                                  />
                                </div>
                              </>
                            )}

                            {(reviewAction === 'REJECT' || reviewAction === 'RESUBMIT') && (
                              <div className="space-y-1">
                                <label className="block text-[10px] font-bold text-slate-500 uppercase">
                                  Motivo de {reviewAction === 'REJECT' ? 'Rejeição' : 'Reenvio'} *
                                </label>
                                <textarea
                                  required
                                  rows={3}
                                  placeholder={`Descreva claramente o motivo...`}
                                  value={rejectionReason}
                                  onChange={(e) => setRejectionReason(e.target.value)}
                                  className="block w-full px-3 py-2 rounded bg-slate-950 border border-slate-855 text-white focus:outline-none focus:ring-1 focus:ring-indigo-500 text-xs resize-none"
                                />
                              </div>
                            )}

                            <div className="space-y-1">
                              <label className="block text-[10px] font-bold text-slate-500 uppercase">Observações Internas (Opcional)</label>
                              <textarea
                                rows={2}
                                placeholder="Notas internas visíveis apenas no sistema..."
                                value={notes}
                                onChange={(e) => setNotes(e.target.value)}
                                className="block w-full px-3 py-2 rounded bg-slate-950 border border-slate-855 text-white focus:outline-none focus:ring-1 focus:ring-indigo-500 text-xs resize-none"
                              />
                            </div>

                            <div className="flex justify-end gap-2 pt-2">
                              <button
                                type="button"
                                onClick={() => setReviewAction(null)}
                                className="px-3 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-400 text-xs font-semibold cursor-pointer"
                              >
                                Cancelar
                              </button>
                              <button
                                type="submit"
                                disabled={isSubmittingReview}
                                className={`px-4 py-1.5 rounded text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer disabled:opacity-50 ${
                                  reviewAction === 'APPROVE' ? 'bg-emerald-600 hover:bg-emerald-500' :
                                  reviewAction === 'REJECT' ? 'bg-rose-600 hover:bg-rose-500' :
                                  'bg-orange-600 hover:bg-orange-500'
                                }`}
                              >
                                {isSubmittingReview ? (
                                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                ) : (
                                  'Confirmar Decisão'
                                )}
                              </button>
                            </div>
                          </form>
                        )}
                      </div>
                    )}

                    {/* Show explanation to reader roles */}
                    {!isRoleAuthorizedToReview && (
                      <div className="p-3.5 rounded-lg bg-slate-950/40 border border-slate-850 flex items-start gap-2.5 text-xs text-slate-400 leading-relaxed">
                        <Info className="w-4 h-4 text-indigo-500 shrink-0 mt-0.5" />
                        <span>
                          Você está visualizando este documento em modo <strong>somente leitura</strong> devido ao seu perfil ({currentUser?.role}). Apenas administradores e analistas de RH podem homologar atestados.
                        </span>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>

            {/* Document Preview Panel */}
            <div className="w-1/2 bg-slate-950 flex flex-col h-full">
              <div className="px-6 py-5 border-b border-slate-800 bg-slate-900/60 flex items-center justify-between">
                <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">Preview do Atestado</span>
                {previewUrl && (
                  <button
                    onClick={handleDownloadFile}
                    className="flex items-center gap-1.5 px-3 py-1 rounded bg-slate-850 hover:bg-slate-800 text-indigo-400 text-xs font-bold border border-slate-800 transition-all cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Download
                  </button>
                )}
              </div>

              <div className="flex-1 flex items-center justify-center p-6 relative">
                {isPreviewLoading ? (
                  <div className="flex flex-col items-center gap-2">
                    <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
                    <span className="text-xs text-slate-500">Buscando stream seguro...</span>
                  </div>
                ) : previewError ? (
                  <div className="flex flex-col items-center gap-2 text-center max-w-xs p-4">
                    <AlertCircle className="w-10 h-10 text-red-500" />
                    <p className="text-xs font-medium text-slate-400">{previewError}</p>
                  </div>
                ) : previewUrl && selectedCert ? (
                  selectedCert.mimeType === 'application/pdf' ? (
                    <iframe
                      src={`${previewUrl}#toolbar=0`}
                      className="w-full h-full rounded border border-slate-800 bg-slate-900 shadow-inner"
                      title="PDF Preview"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center overflow-auto rounded border border-slate-800 bg-slate-900 p-2 shadow-inner">
                      <img
                        src={previewUrl}
                        alt="Preview do atestado"
                        className="max-w-full max-h-full object-contain rounded"
                      />
                    </div>
                  )
                ) : (
                  <div className="text-xs text-slate-500 italic">Nenhum arquivo para pré-visualização.</div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
      <PlanErrorAlert error={planError} onClose={() => setPlanError(null)} />
    </>
  );
}
