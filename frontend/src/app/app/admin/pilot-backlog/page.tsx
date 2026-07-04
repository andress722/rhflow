'use client';

import React, { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import {
  MessageSquare,
  Search,
  Plus,
  ShieldAlert,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Clock,
  User,
  Building2,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  FileText,
  Copy,
  Zap
} from 'lucide-react';
import Link from 'next/link';

function PilotBacklogContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const [items, setItems] = useState<any[]>([]);
  const [companies, setCompanies] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Pagination
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [pageSize] = useState(10);

  // Filters
  const [search, setSearch] = useState('');
  const [selectedCompanyId, setSelectedCompanyId] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');
  const [selectedPriority, setSelectedPriority] = useState('');
  const [selectedType, setSelectedType] = useState('');

  // Overview stats
  const [stats, setStats] = useState({
    openItems: 0,
    urgentItems: 0,
    inProgressItems: 0,
    done7d: 0,
    overdueTargetItems: 0,
  });

  // Modal / Drawer state
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isReleaseNotesOpen, setIsReleaseNotesOpen] = useState(false);
  const [selectedBacklogItem, setSelectedBacklogItem] = useState<any | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [updating, setUpdating] = useState(false);

  // Release Notes modal state
  const [rnCompanyId, setRnCompanyId] = useState('');
  const [rnStartDate, setRnStartDate] = useState('');
  const [rnEndDate, setRnEndDate] = useState('');
  const [generatedNotes, setGeneratedNotes] = useState('');
  const [generatingNotes, setGeneratingNotes] = useState(false);
  const [copied, setCopied] = useState(false);

  // Create Form inputs
  const [newCompanyId, setNewCompanyId] = useState('');
  const [newFeedbackId, setNewFeedbackId] = useState('');
  const [newTitle, setNewTitle] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newType, setNewType] = useState('BUGFIX');
  const [newPriority, setNewPriority] = useState('MEDIUM');
  const [newStatus, setNewStatus] = useState('TRIAGED');
  const [newImpact, setNewImpact] = useState('');
  const [newRootCause, setNewRootCause] = useState('');
  const [newPlannedAction, setNewPlannedAction] = useState('');
  const [newReleaseNote, setNewReleaseNote] = useState('');
  const [newTargetReleaseDate, setNewTargetReleaseDate] = useState('');
  const [newAssignedId, setNewAssignedId] = useState('');

  // Edit fields
  const [editStatus, setEditStatus] = useState('TRIAGED');
  const [editPriority, setEditPriority] = useState('MEDIUM');
  const [editAssignedId, setEditAssignedId] = useState('');
  const [editRootCause, setEditRootCause] = useState('');
  const [editPlannedAction, setEditPlannedAction] = useState('');
  const [editReleaseNote, setEditReleaseNote] = useState('');

  const fetchOverviewStats = async () => {
    try {
      const res = await api.get('/admin/command-center/overview');
      if (res.success && res.data?.pilotBacklog) {
        setStats(res.data.pilotBacklog);
      }
    } catch (e) {}
  };

  const fetchCompanies = async () => {
    try {
      const res = await api.get('/admin/companies');
      if (res.success) {
        setCompanies(res.data || []);
      }
    } catch (e) {}
  };

  const fetchBacklog = async () => {
    setLoading(true);
    setError(null);
    try {
      const query = new URLSearchParams();
      query.append('page', page.toString());
      query.append('pageSize', pageSize.toString());
      if (search) query.append('search', search);
      if (selectedCompanyId) query.append('companyId', selectedCompanyId);
      if (selectedStatus) query.append('status', selectedStatus);
      if (selectedPriority) query.append('priority', selectedPriority);
      if (selectedType) query.append('type', selectedType);

      const res = await api.get(`/admin/pilot-backlog?${query.toString()}`);
      if (res.success) {
        setItems(res.data || []);
        setTotalPages((res as any).pagination?.totalPages || 1);
      } else {
        setError(res.error?.message || 'Erro ao carregar backlog.');
      }
    } catch (e) {
      setError('Erro de rede ao buscar backlog.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOverviewStats();
    fetchCompanies();

    // Check query params for instant feedback conversion
    const fbId = searchParams.get('fromFeedbackId');
    if (fbId) {
      handleCreateFromFeedback(fbId);
    }
  }, []);

  useEffect(() => {
    fetchBacklog();
  }, [page, search, selectedCompanyId, selectedStatus, selectedPriority, selectedType]);

  const handleCreateFromFeedback = async (feedbackId: string) => {
    setLoading(true);
    try {
      const res = await api.post(`/admin/pilot-backlog/from-feedback/${feedbackId}`, {});
      if (res.success) {
        alert('Feedback convertido em item de backlog com sucesso!');
        router.replace('/app/admin/pilot-backlog');
        fetchBacklog();
        fetchOverviewStats();
      } else {
        alert(res.error?.message || 'Erro ao converter feedback.');
      }
    } catch (e) {
      alert('Erro de rede ao converter.');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    try {
      const payload = {
        companyId: newCompanyId,
        feedbackId: newFeedbackId || null,
        title: newTitle,
        description: newDescription,
        type: newType,
        priority: newPriority,
        status: newStatus,
        impact: newImpact || null,
        rootCause: newRootCause || null,
        plannedAction: newPlannedAction || null,
        releaseNote: newReleaseNote || null,
        targetReleaseDate: newTargetReleaseDate || null,
        assignedToUserId: newAssignedId || null,
      };

      const res = await api.post('/admin/pilot-backlog', payload);
      if (res.success) {
        setIsCreateOpen(false);
        // Clear
        setNewCompanyId('');
        setNewFeedbackId('');
        setNewTitle('');
        setNewDescription('');
        setNewImpact('');
        setNewRootCause('');
        setNewPlannedAction('');
        setNewReleaseNote('');
        setNewTargetReleaseDate('');
        setNewAssignedId('');
        fetchBacklog();
        fetchOverviewStats();
      } else {
        alert(res.error?.message || 'Erro ao salvar backlog.');
      }
    } catch (e) {
      alert('Erro de rede ao cadastrar.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBacklogItem || updating) return;
    setUpdating(true);
    try {
      const payload = {
        status: editStatus,
        priority: editPriority,
        assignedToUserId: editAssignedId || null,
        rootCause: editRootCause || null,
        plannedAction: editPlannedAction || null,
        releaseNote: editReleaseNote || null,
      };

      const res = await api.patch(`/admin/pilot-backlog/${selectedBacklogItem.id}`, payload);
      if (res.success) {
        setSelectedBacklogItem(null);
        fetchBacklog();
        fetchOverviewStats();
      } else {
        alert(res.error?.message || 'Erro ao atualizar.');
      }
    } catch (e) {
      alert('Erro de rede ao atualizar.');
    } finally {
      setUpdating(false);
    }
  };

  const generateReleaseNotes = async () => {
    if (!rnCompanyId) {
      alert('Selecione uma empresa.');
      return;
    }
    setGeneratingNotes(true);
    setGeneratedNotes('');
    setCopied(false);
    try {
      const res = await api.post('/admin/pilot-backlog/release-notes', {
        companyId: rnCompanyId,
        startDate: rnStartDate || null,
        endDate: rnEndDate || null,
      });
      if (res.success) {
        setGeneratedNotes((res as any).markdown || '');
      } else {
        alert(res.error?.message || 'Erro ao gerar release notes.');
      }
    } catch (e) {
      alert('Erro de rede.');
    } finally {
      setGeneratingNotes(false);
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(generatedNotes);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const openEditDrawer = (item: any) => {
    setSelectedBacklogItem(item);
    setEditStatus(item.status);
    setEditPriority(item.priority);
    setEditAssignedId(item.assignedToUserId || '');
    setEditRootCause(item.rootCause || '');
    setEditPlannedAction(item.plannedAction || '');
    setEditReleaseNote(item.releaseNote || '');
  };

  return (
    <div className="p-6 space-y-6 text-slate-100 bg-slate-950 min-h-screen">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            <ClipboardList className="w-6 h-6 text-indigo-500" />
            Backlog de Produto & Releases do Piloto
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            Planeje hotfixes, catalogue causa raiz e gere comunicados semanais de liberação.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setIsReleaseNotesOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 rounded-lg text-sm font-semibold transition-all cursor-pointer"
          >
            <FileText className="w-4 h-4 text-emerald-450" />
            Gerar Release Notes
          </button>
          <button
            onClick={() => setIsCreateOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-semibold transition-all cursor-pointer shadow-lg shadow-indigo-650/30"
          >
            <Plus className="w-4 h-4" />
            Adicionar Item
          </button>
        </div>
      </div>

      {/* KPI Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="bg-slate-900 border border-slate-850 p-4 rounded-xl flex items-center gap-3">
          <div className="p-2.5 bg-indigo-950/40 text-indigo-400 rounded-lg">
            <ClipboardList className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] text-slate-500 font-semibold block uppercase">Itens Abertos</span>
            <span className="text-xl font-extrabold text-white">{stats.openItems}</span>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-850 p-4 rounded-xl flex items-center gap-3">
          <div className="p-2.5 bg-red-950/40 text-red-450 rounded-lg animate-pulse">
            <ShieldAlert className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] text-slate-500 font-semibold block uppercase">Urgentes</span>
            <span className="text-xl font-extrabold text-white">{stats.urgentItems}</span>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-850 p-4 rounded-xl flex items-center gap-3">
          <div className="p-2.5 bg-blue-950/40 text-blue-400 rounded-lg">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] text-slate-500 font-semibold block uppercase">Em Progresso</span>
            <span className="text-xl font-extrabold text-white">{stats.inProgressItems}</span>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-850 p-4 rounded-xl flex items-center gap-3">
          <div className="p-2.5 bg-emerald-950/40 text-emerald-450 rounded-lg">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] text-slate-500 font-semibold block uppercase">Concluídos 7d</span>
            <span className="text-xl font-extrabold text-white">{stats.done7d}</span>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-850 p-4 rounded-xl flex items-center gap-3">
          <div className="p-2.5 bg-amber-950/40 text-amber-500 rounded-lg">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] text-slate-500 font-semibold block uppercase">Prazos Vencidos</span>
            <span className="text-xl font-extrabold text-white">{stats.overdueTargetItems}</span>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-slate-900 border border-slate-850 p-4 rounded-xl">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar título/descrição..."
              className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-850 rounded-lg text-xs focus:outline-none focus:border-indigo-500 text-slate-200"
            />
          </div>

          <select
            value={selectedCompanyId}
            onChange={(e) => setSelectedCompanyId(e.target.value)}
            className="w-full px-3 py-2 bg-slate-950 border border-slate-850 rounded-lg text-xs text-slate-350 focus:outline-none"
          >
            <option value="">Todas Empresas</option>
            {companies.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>

          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="w-full px-3 py-2 bg-slate-950 border border-slate-850 rounded-lg text-xs text-slate-350 focus:outline-none"
          >
            <option value="">Todos Status</option>
            <option value="TRIAGED">Triado (Aberto)</option>
            <option value="PLANNED">Planejado</option>
            <option value="IN_PROGRESS">Em Andamento</option>
            <option value="DONE">Done (Concluído)</option>
            <option value="CANCELED">Cancelado</option>
          </select>

          <select
            value={selectedPriority}
            onChange={(e) => setSelectedPriority(e.target.value)}
            className="w-full px-3 py-2 bg-slate-950 border border-slate-850 rounded-lg text-xs text-slate-350 focus:outline-none"
          >
            <option value="">Todas Prioridades</option>
            <option value="LOW">Low</option>
            <option value="MEDIUM">Medium</option>
            <option value="HIGH">High</option>
            <option value="URGENT">Urgent</option>
          </select>

          <select
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value)}
            className="w-full px-3 py-2 bg-slate-950 border border-slate-850 rounded-lg text-xs text-slate-350 focus:outline-none"
          >
            <option value="">Todas Categorias</option>
            <option value="BUGFIX">Bugfix (Correção)</option>
            <option value="IMPROVEMENT">Melhoria</option>
            <option value="CONFIGURATION">Configuração</option>
            <option value="TRAINING">Treinamento</option>
            <option value="DOCUMENTATION">Documentação</option>
            <option value="FEATURE_REQUEST">Feature Request</option>
          </select>
        </div>
      </div>

      {/* Main Table View */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
        {loading ? (
          <div className="py-24 text-center">
            <div className="w-8 h-8 border-4 border-indigo-650 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
            <p className="text-xs text-slate-500">Buscando itens do backlog...</p>
          </div>
        ) : error ? (
          <div className="py-24 text-center text-red-400">
            <AlertTriangle className="w-8 h-8 mx-auto mb-2 text-red-500" />
            <p className="text-xs">{error}</p>
          </div>
        ) : items.length === 0 ? (
          <div className="py-24 text-center text-slate-500">
            <ClipboardList className="w-8 h-8 mx-auto mb-2 text-slate-655" />
            <p className="text-xs">Nenhum item de backlog planejado ou triado.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-850 bg-slate-950/60 text-slate-400 font-semibold">
                  <th className="px-6 py-4">Empresa</th>
                  <th className="px-6 py-4">Título</th>
                  <th className="px-6 py-4">Tipo</th>
                  <th className="px-6 py-4">Prioridade</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4">Prazo Alvo</th>
                  <th className="px-6 py-4 text-right">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-slate-350">
                {items.map((item) => {
                  const isOverdue = item.targetReleaseDate && new Date(item.targetReleaseDate) < new Date() && item.status !== 'DONE' && item.status !== 'CANCELED';
                  return (
                    <tr key={item.id} className="hover:bg-slate-950/20 transition-colors">
                      <td className="px-6 py-4 font-semibold text-slate-100">{item.company.name}</td>
                      <td className="px-6 py-4 font-medium text-slate-200 max-w-xs truncate">
                        {item.title}
                      </td>
                      <td className="px-6 py-4">
                        <span className="inline-flex px-2 py-0.5 rounded bg-slate-950 border border-slate-850 text-[10px] text-slate-400 font-mono">
                          {item.type}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex px-2 py-0.5 rounded text-[10px] font-bold ${
                          item.priority === 'URGENT' ? 'bg-red-950/40 text-red-400 border border-red-900/50' :
                          item.priority === 'HIGH' ? 'bg-amber-950/40 text-amber-450 border border-amber-900/50' :
                          'bg-slate-950 text-slate-400 border border-slate-850'
                        }`}>
                          {item.priority}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center gap-1.5 font-bold ${
                          item.status === 'DONE' ? 'text-emerald-450' :
                          item.status === 'IN_PROGRESS' ? 'text-indigo-400' :
                          item.status === 'PLANNED' ? 'text-blue-450' :
                          'text-amber-500'
                        }`}>
                          {item.status === 'DONE' ? <CheckCircle2 className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
                          {item.status}
                        </span>
                      </td>
                      <td className={`px-6 py-4 font-semibold ${isOverdue ? 'text-red-450' : 'text-slate-450'}`}>
                        {item.targetReleaseDate ? new Date(item.targetReleaseDate).toLocaleDateString('pt-BR') : 'Sem data'}
                        {isOverdue && ' (Atrasado)'}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button
                          onClick={() => openEditDrawer(item)}
                          className="px-2.5 py-1.5 bg-slate-950 hover:bg-slate-850 border border-slate-800 rounded text-[11px] font-semibold transition-colors cursor-pointer text-slate-350"
                        >
                          Tratar / Engenharia
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-between items-center text-xs text-slate-500 bg-slate-900/40 p-4 border border-slate-850 rounded-xl">
          <span>Página {page} de {totalPages}</span>
          <div className="flex gap-2">
            <button
              disabled={page === 1}
              onClick={() => setPage(p => Math.max(1, p - 1))}
              className="p-1.5 bg-slate-900 border border-slate-800 rounded hover:bg-slate-850 text-slate-350 disabled:opacity-40 cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              disabled={page === totalPages}
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              className="p-1.5 bg-slate-900 border border-slate-800 rounded hover:bg-slate-850 text-slate-350 disabled:opacity-40 cursor-pointer"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Create Modal */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="w-full max-w-xl bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-155">
            <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <Plus className="w-5 h-5 text-indigo-500" />
                Criar Item no Backlog Técnico
              </h2>
              <button
                onClick={() => setIsCreateOpen(false)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateSubmit}>
              <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto text-xs">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5 col-span-2">
                    <label className="text-slate-400 font-semibold">Empresa Piloto *</label>
                    <select
                      required
                      value={newCompanyId}
                      onChange={(e) => setNewCompanyId(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded text-slate-200 focus:outline-none"
                    >
                      <option value="">Selecione a empresa...</option>
                      {companies.map(c => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-slate-400 font-semibold">ID do Feedback Relacionado (Opcional)</label>
                    <input
                      type="text"
                      value={newFeedbackId}
                      onChange={(e) => setNewFeedbackId(e.target.value)}
                      placeholder="Ex: feedback-uuid"
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded text-white focus:outline-none"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-slate-400 font-semibold">Categoria/Tipo *</label>
                    <select
                      value={newType}
                      onChange={(e) => setNewType(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded text-slate-250 focus:outline-none"
                    >
                      <option value="BUGFIX">Bugfix (Correção)</option>
                      <option value="IMPROVEMENT">Improvement (Melhoria)</option>
                      <option value="CONFIGURATION">Configuração</option>
                      <option value="TRAINING">Treinamento</option>
                      <option value="DOCUMENTATION">Documentação</option>
                      <option value="FEATURE_REQUEST">Feature Request</option>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-slate-400 font-semibold">Prioridade *</label>
                    <select
                      value={newPriority}
                      onChange={(e) => setNewPriority(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded text-slate-250 focus:outline-none"
                    >
                      <option value="LOW">Low</option>
                      <option value="MEDIUM">Medium</option>
                      <option value="HIGH">High</option>
                      <option value="URGENT">Urgent</option>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-slate-400 font-semibold">Status Inicial</label>
                    <select
                      value={newStatus}
                      onChange={(e) => setNewStatus(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded text-slate-250 focus:outline-none"
                    >
                      <option value="TRIAGED">Triaged (Triado)</option>
                      <option value="PLANNED">Planned</option>
                      <option value="IN_PROGRESS">In Progress</option>
                      <option value="DONE">Done</option>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-slate-400 font-semibold">Data Alvo de Entrega</label>
                    <input
                      type="date"
                      value={newTargetReleaseDate}
                      onChange={(e) => setNewTargetReleaseDate(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded text-white focus:outline-none"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-slate-400 font-semibold">Atribuído para (ID)</label>
                    <input
                      type="text"
                      value={newAssignedId}
                      onChange={(e) => setNewAssignedId(e.target.value)}
                      placeholder="Ex: user-id"
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded text-white focus:outline-none"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-slate-400 font-semibold">Título *</label>
                  <input
                    type="text"
                    required
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    placeholder="Título descritivo resumido do backlog"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded text-white focus:outline-none"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-slate-400 font-semibold">Descrição do Problema *</label>
                  <textarea
                    required
                    rows={3}
                    value={newDescription}
                    onChange={(e) => setNewDescription(e.target.value)}
                    placeholder="Descreva a tarefa técnica sem dados de saúde ou CPFs sensíveis..."
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded text-slate-200 focus:outline-none"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-slate-400 font-semibold">Impacto Relatado</label>
                  <textarea
                    rows={2}
                    value={newImpact}
                    onChange={(e) => setNewImpact(e.target.value)}
                    placeholder="Impacto comercial ou operacional"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded text-slate-200 focus:outline-none"
                  />
                </div>
              </div>

              <div className="px-6 py-4 border-t border-slate-800 bg-slate-950/40 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsCreateOpen(false)}
                  className="px-4 py-2 rounded bg-slate-850 hover:bg-slate-800 text-slate-350 font-semibold text-xs transition-all cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 rounded bg-indigo-650 hover:bg-indigo-600 text-white font-semibold text-xs transition-all cursor-pointer disabled:opacity-50"
                >
                  {submitting ? 'Processando...' : 'Salvar Item'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Release Notes Modal */}
      {isReleaseNotesOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-155">
            <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <FileText className="w-5 h-5 text-emerald-455" />
                Compilar Release Notes
              </h2>
              <button
                onClick={() => {
                  setIsReleaseNotesOpen(false);
                  setGeneratedNotes('');
                }}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs">
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1.5 col-span-3">
                  <label className="text-slate-400 font-semibold">Empresa Cliente *</label>
                  <select
                    value={rnCompanyId}
                    onChange={(e) => setRnCompanyId(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded text-slate-200 focus:outline-none"
                  >
                    <option value="">Selecione...</option>
                    {companies.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-slate-400 font-semibold">Data Início (Opcional)</label>
                  <input
                    type="date"
                    value={rnStartDate}
                    onChange={(e) => setRnStartDate(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded text-white focus:outline-none"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-slate-400 font-semibold">Data Fim (Opcional)</label>
                  <input
                    type="date"
                    value={rnEndDate}
                    onChange={(e) => setRnEndDate(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded text-white focus:outline-none"
                  />
                </div>

                <div className="flex items-end">
                  <button
                    onClick={generateReleaseNotes}
                    disabled={generatingNotes}
                    className="w-full py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded font-semibold transition-colors cursor-pointer disabled:opacity-50"
                  >
                    {generatingNotes ? 'Compilando...' : 'Carregar Itens Concluídos'}
                  </button>
                </div>
              </div>

              {generatedNotes && (
                <div className="space-y-2 border-t border-slate-850 pt-4">
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400 font-semibold">Release Notes Markdown:</span>
                    <button
                      onClick={copyToClipboard}
                      className="inline-flex items-center gap-1 text-[11px] text-indigo-400 hover:text-indigo-300 font-bold transition-all cursor-pointer"
                    >
                      <Copy className="w-3.5 h-3.5" />
                      {copied ? 'Copiado!' : 'Copiar Markdown'}
                    </button>
                  </div>
                  <pre className="p-4 bg-slate-950 border border-slate-850 rounded-xl overflow-x-auto text-[10px] font-mono text-slate-350 h-64 overflow-y-auto whitespace-pre-wrap leading-relaxed select-all">
                    {generatedNotes}
                  </pre>
                </div>
              )}
            </div>

            <div className="px-6 py-4 border-t border-slate-800 bg-slate-950/40 flex justify-end">
              <button
                type="button"
                onClick={() => {
                  setIsReleaseNotesOpen(false);
                  setGeneratedNotes('');
                }}
                className="px-4 py-2 rounded bg-slate-850 hover:bg-slate-800 text-slate-350 font-semibold transition-all cursor-pointer"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Drawer */}
      {selectedBacklogItem && (
        <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/80 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-slate-900 border-l border-slate-800 h-full p-6 flex flex-col justify-between shadow-2xl animate-in slide-in-from-right duration-155 text-xs">
            <div className="space-y-6 overflow-y-auto">
              <div className="flex justify-between items-center border-b border-slate-850 pb-4">
                <div>
                  <span className="text-[10px] text-slate-500 uppercase tracking-wider block font-semibold">Backlog: {selectedBacklogItem.company.name}</span>
                  <h2 className="text-sm font-bold text-white mt-1">{selectedBacklogItem.title}</h2>
                </div>
                <button
                  onClick={() => setSelectedBacklogItem(null)}
                  className="text-slate-405 hover:text-white transition-colors cursor-pointer text-sm"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-4">
                <div className="bg-slate-950/40 p-4 border border-slate-850 rounded-xl space-y-2">
                  <span className="text-slate-500 block">Descrição Técnica:</span>
                  <p className="text-slate-200 whitespace-pre-wrap leading-relaxed">{selectedBacklogItem.description}</p>
                </div>

                {selectedBacklogItem.impact && (
                  <div className="space-y-1">
                    <span className="text-slate-550 block">Impacto no Cliente:</span>
                    <p className="text-slate-300 font-medium">{selectedBacklogItem.impact}</p>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4 border-t border-slate-850/60 pt-4">
                  <div>
                    <span className="text-slate-500 block">Tipo:</span>
                    <span className="text-slate-300 font-mono block mt-0.5">{selectedBacklogItem.type}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Data de Criação:</span>
                    <span className="text-slate-300 block mt-0.5">{new Date(selectedBacklogItem.createdAt).toLocaleDateString('pt-BR')}</span>
                  </div>
                </div>

                {/* Edit Form */}
                <form onSubmit={handleUpdateSubmit} className="space-y-4 border-t border-slate-850/60 pt-4">
                  <h3 className="text-xs font-bold text-indigo-400 uppercase tracking-wider">Acompanhamento de Engenharia</h3>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-slate-450 font-semibold block">Alterar Status</label>
                      <select
                        value={editStatus}
                        onChange={(e) => setEditStatus(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded text-slate-250 focus:outline-none"
                      >
                        <option value="TRIAGED">Triaged (Triado)</option>
                        <option value="PLANNED">Planned</option>
                        <option value="IN_PROGRESS">In Progress</option>
                        <option value="DONE">Done (Concluído)</option>
                        <option value="CANCELED">Canceled (Cancelado)</option>
                      </select>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-slate-450 font-semibold block">Prioridade</label>
                      <select
                        value={editPriority}
                        onChange={(e) => setEditPriority(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded text-slate-250 focus:outline-none"
                      >
                        <option value="LOW">Low</option>
                        <option value="MEDIUM">Medium</option>
                        <option value="HIGH">High</option>
                        <option value="URGENT">Urgent</option>
                      </select>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-slate-450 font-semibold block">Causa Raiz (Root Cause)</label>
                    <textarea
                      rows={2}
                      value={editRootCause}
                      onChange={(e) => setEditRootCause(e.target.value)}
                      placeholder="Identifique o motivo da falha técnica."
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded text-slate-200 focus:outline-none"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-slate-455 font-semibold block">Ação Técnica Corretiva Planejada</label>
                    <textarea
                      rows={2}
                      value={editPlannedAction}
                      onChange={(e) => setEditPlannedAction(e.target.value)}
                      placeholder="Planejamento técnico ou refatoração planejada."
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded text-slate-200 focus:outline-none"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-slate-450 font-semibold block">Release Note (Linguagem Amigável)</label>
                    <textarea
                      rows={3}
                      value={editReleaseNote}
                      onChange={(e) => setEditReleaseNote(e.target.value)}
                      placeholder="Escreva a nota explicativa amigável de fechamento para o cliente..."
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded text-slate-200 focus:outline-none"
                    />
                  </div>

                  <div className="flex gap-3 justify-end pt-2">
                    <button
                      type="button"
                      onClick={() => setSelectedBacklogItem(null)}
                      className="px-4 py-2 rounded bg-slate-850 hover:bg-slate-800 text-slate-350 font-semibold transition-all cursor-pointer"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      disabled={updating}
                      className="px-4 py-2 rounded bg-indigo-650 hover:bg-indigo-600 text-white font-semibold transition-all cursor-pointer disabled:opacity-50"
                    >
                      {updating ? 'Gravando...' : 'Salvar Alterações'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function AdminPilotBacklogPage() {
  return (
    <Suspense fallback={
      <div className="p-6 text-center text-slate-400 bg-slate-950 min-h-screen">
        Carregando Backlog...
      </div>
    }>
      <PilotBacklogContent />
    </Suspense>
  );
}
