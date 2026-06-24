'use client';

import React, { useState, useEffect } from 'react';
import { Search, Filter, Clock, AlertCircle, CheckCircle2, XCircle, Send, MessageSquare, HelpCircle, FileText } from 'lucide-react';
import { api } from '@/lib/api';
import { getUser } from '@/lib/auth';

const OCCURRENCE_TYPES = [
  { value: 'ABSENCE', label: 'Falta' },
  { value: 'LATE_ARRIVAL', label: 'Atraso' },
  { value: 'REMOTE_TECHNICAL_ISSUE', label: 'Problema Técnico' },
  { value: 'MISSED_CLOCK_IN', label: 'Ponto não Registrado' },
  { value: 'TEMPORARY_ABSENCE', label: 'Ausência Temporária' },
  { value: 'MEDICAL_CERTIFICATE', label: 'Atestado Médico' },
];

const OCCURRENCE_STATUSES = [
  { value: 'OPEN', label: 'Aberta' },
  { value: 'WAITING_EMPLOYEE', label: 'Aguardando Funcionário' },
  { value: 'WAITING_MANAGER', label: 'Aguardando Gestor' },
  { value: 'WAITING_HR', label: 'Aguardando RH' },
  { value: 'RESOLVED', label: 'Resolvida' },
  { value: 'REJECTED', label: 'Rejeitada' },
  { value: 'CANCELLED', label: 'Cancelada' },
];

export default function OccurrencesPage() {
  const [occurrences, setOccurrences] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  // Filters state
  const [typeFilter, setTypeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  // Selected occurrence state (for Drawer)
  const [selectedOccId, setSelectedOccId] = useState<string | null>(null);
  const [selectedOcc, setSelectedOcc] = useState<any>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isDrawerLoading, setIsDrawerLoading] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);

  useEffect(() => {
    setCurrentUser(getUser());
    fetchData();
  }, []);

  const fetchData = async () => {
    setIsLoading(true);
    setError('');
    try {
      const occRes = await api.get('/occurrences');
      if (occRes.success) {
        setOccurrences(occRes.data || []);
      } else {
        setError(occRes.error?.message || 'Erro ao carregar ocorrências.');
      }

      const empRes = await api.get('/employees');
      if (empRes.success) {
        setEmployees(empRes.data || []);
      }
    } catch (err) {
      setError('Erro de conexão com o servidor.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenDrawer = async (id: string) => {
    setSelectedOccId(id);
    setIsDrawerOpen(true);
    setIsDrawerLoading(true);
    setCommentText('');

    try {
      const res = await api.get(`/occurrences/${id}`);
      if (res.success) {
        setSelectedOcc(res.data);
      } else {
        alert(res.error?.message || 'Erro ao carregar detalhes.');
        setIsDrawerOpen(false);
      }
    } catch (err) {
      alert('Erro de conexão.');
      setIsDrawerOpen(false);
    } finally {
      setIsDrawerLoading(false);
    }
  };

  const handleStatusChange = async (newStatus: string) => {
    if (!selectedOcc) return;

    try {
      const res = await api.patch(`/occurrences/${selectedOcc.id}/status`, { status: newStatus });
      if (res.success) {
        // Reload details & list
        const detailRes = await api.get(`/occurrences/${selectedOcc.id}`);
        if (detailRes.success) {
          setSelectedOcc(detailRes.data);
        }
        fetchData();
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
        // Reload details
        const detailRes = await api.get(`/occurrences/${selectedOcc.id}`);
        if (detailRes.success) {
          setSelectedOcc(detailRes.data);
        }
        fetchData();
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

  // VIEWER is read-only
  const isViewer = currentUser?.role === 'VIEWER';

  // Filters logic
  const filteredOccurrences = occurrences.filter((occ) => {
    const matchesSearch =
      occ.employee?.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      occ.title.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesType = !typeFilter || occ.type === typeFilter;
    const matchesStatus = !statusFilter || occ.status === statusFilter;

    return matchesSearch && matchesType && matchesStatus;
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'OPEN':
        return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-800 text-slate-300 border border-slate-700">Aberta</span>;
      case 'WAITING_EMPLOYEE':
        return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">Aguardando Func.</span>;
      case 'WAITING_MANAGER':
        return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-500/10 text-purple-400 border border-purple-500/20">Aguardando Gestor</span>;
      case 'WAITING_HR':
        return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20">Aguardando RH</span>;
      case 'RESOLVED':
        return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">Resolvida</span>;
      case 'REJECTED':
        return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-red-500/10 text-red-400 border border-red-500/20">Rejeitada</span>;
      case 'CANCELLED':
        return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-850 text-slate-500 border border-slate-800">Cancelada</span>;
      default:
        return status;
    }
  };

  const getTypeLabel = (type: string) => {
    return OCCURRENCE_TYPES.find((t) => t.value === type)?.label || type;
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

  return (
    <>
      {/* Page header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-white">Ocorrências</h1>
        <p className="text-slate-400 text-sm mt-1">
          Acompanhe faltas, atrasos e outras pendências de presença operacional reportadas.
        </p>
      </div>

      {/* Filter and search bar */}
      <div className="flex flex-col md:flex-row gap-4 p-5 rounded-xl border border-slate-800 bg-slate-900 shadow-lg">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            type="text"
            placeholder="Buscar por funcionário ou título..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="block w-full pl-10 pr-4 py-2 rounded-lg bg-slate-950 border border-slate-800 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all text-sm"
          />
        </div>
        <div className="flex gap-4">
          <div className="relative">
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="block w-44 px-4 py-2 rounded-lg bg-slate-950 border border-slate-800 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all text-sm appearance-none cursor-pointer"
            >
              <option value="">Todos Tipos</option>
              {OCCURRENCE_TYPES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>
          <div className="relative">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="block w-44 px-4 py-2 rounded-lg bg-slate-950 border border-slate-800 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all text-sm appearance-none cursor-pointer"
            >
              <option value="">Todos Status</option>
              {OCCURRENCE_STATUSES.map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Table Card */}
      <div className="rounded-xl border border-slate-800 bg-slate-900 overflow-hidden shadow-xl">
        {isLoading ? (
          <div className="py-20 flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
            <span className="text-sm text-slate-400">Carregando ocorrências...</span>
          </div>
        ) : error ? (
          <div className="py-16 text-center text-slate-400 flex flex-col items-center gap-3">
            <AlertCircle className="w-12 h-12 text-red-500" />
            <p className="text-sm">{error}</p>
          </div>
        ) : filteredOccurrences.length === 0 ? (
          <div className="py-20 text-center text-slate-500">
            Nenhuma ocorrência registrada correspondente.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-400 border-collapse">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-900/50 text-slate-500 font-semibold text-xs uppercase tracking-wider">
                  <th className="px-6 py-3.5">Funcionário</th>
                  <th className="px-6 py-3.5">Título / Tipo</th>
                  <th className="px-6 py-3.5">Data / Hora</th>
                  <th className="px-6 py-3.5">Origem</th>
                  <th className="px-6 py-3.5">Status</th>
                  <th className="px-6 py-3.5 text-right">Detalhe</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filteredOccurrences.map((occ) => (
                  <tr key={occ.id} className="hover:bg-slate-800/20 transition-colors">
                    <td className="px-6 py-4">
                      <p className="font-semibold text-slate-200">{occ.employee?.fullName}</p>
                      <p className="text-xs text-slate-500">{occ.employee?.sector || '-'}</p>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-slate-200 font-medium">{occ.title}</p>
                      <p className="text-xs text-slate-500">{getTypeLabel(occ.type)}</p>
                    </td>
                    <td className="px-6 py-4 font-mono text-xs text-slate-300">
                      {new Date(occ.occurrenceDate).toLocaleString('pt-BR')}
                    </td>
                    <td className="px-6 py-4">{getSourceBadge(occ.source)}</td>
                    <td className="px-6 py-4">{getStatusBadge(occ.status)}</td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => handleOpenDrawer(occ.id)}
                        className="px-3 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-indigo-400 hover:text-indigo-300 text-xs font-semibold border border-slate-700 transition-colors"
                      >
                        Visualizar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Drawer / Modal Side Panel for Occurrence Detail & Timeline */}
      {isDrawerOpen && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm">
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
                    className="text-slate-400 hover:text-slate-200 font-medium text-sm transition-colors"
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
                        {OCCURRENCE_STATUSES.map((status) => (
                          <option key={status.value} value={status.value}>{status.label}</option>
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
                              
                              {/* Render WhatsApp Inbound/Outbound text bubbles from metadata */}
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
                      className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-700/50 disabled:cursor-not-allowed text-white text-xs font-semibold shadow transition-all"
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
    </>
  );
}
