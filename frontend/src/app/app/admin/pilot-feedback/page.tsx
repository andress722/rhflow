'use client';

import React, { useEffect, useState } from 'react';
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
  ClipboardList
} from 'lucide-react';
import Link from 'next/link';

export default function AdminPilotFeedbackPage() {
  const [items, setItems] = useState<any[]>([]);
  const [companies, setCompanies] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
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
  const [selectedSeverity, setSelectedSeverity] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedSource, setSelectedSource] = useState('');

  // Overview stats
  const [stats, setStats] = useState({
    openFeedbacks: 0,
    criticalFeedbacks: 0,
    resolved7d: 0,
    companiesWithOpenFeedback: 0,
  });

  // Modal / Drawer state
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedFeedback, setSelectedFeedback] = useState<any | null>(null);
  const [updating, setUpdating] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Create Form inputs
  const [newCompanyId, setNewCompanyId] = useState('');
  const [reportedByName, setReportedByName] = useState('');
  const [reportedByRole, setReportedByRole] = useState('');
  const [newSource, setNewSource] = useState('WHATSAPP');
  const [newCategory, setNewCategory] = useState('BUG');
  const [newSeverity, setNewSeverity] = useState('MEDIUM');
  const [newTitle, setNewTitle] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newImpact, setNewImpact] = useState('');
  const [newRelatedUrl, setNewRelatedUrl] = useState('');
  const [newAssignedId, setNewAssignedId] = useState('');
  const [newKnowledgeArticleId, setNewKnowledgeArticleId] = useState('');
  const [knowledgeArticles, setKnowledgeArticles] = useState<any[]>([]);

  // Edit fields
  const [editStatus, setEditStatus] = useState('OPEN');
  const [editSeverity, setEditSeverity] = useState('MEDIUM');
  const [editAssignedId, setEditAssignedId] = useState('');
  const [editActionTaken, setEditActionTaken] = useState('');
  const [editKnowledgeArticleId, setEditKnowledgeArticleId] = useState('');

  const fetchOverviewStats = async () => {
    try {
      const res = await api.get('/admin/command-center/overview');
      if (res.success && res.data?.pilotFeedback) {
        setStats(res.data.pilotFeedback);
      }
    } catch (e) {}
  };

  const fetchKnowledgeArticles = async () => {
    try {
      const res = await api.get('/admin/knowledge/articles');
      if (res.success) {
        setKnowledgeArticles(res.data || []);
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

  const fetchFeedbacks = async () => {
    setLoading(true);
    setError(null);
    try {
      const query = new URLSearchParams();
      query.append('page', page.toString());
      query.append('pageSize', pageSize.toString());
      if (search) query.append('search', search);
      if (selectedCompanyId) query.append('companyId', selectedCompanyId);
      if (selectedStatus) query.append('status', selectedStatus);
      if (selectedSeverity) query.append('severity', selectedSeverity);
      if (selectedCategory) query.append('category', selectedCategory);
      if (selectedSource) query.append('source', selectedSource);

      const res = await api.get(`/admin/pilot-feedback?${query.toString()}`);
      if (res.success) {
        setItems(res.data || []);
        setTotalPages((res as any).pagination?.totalPages || 1);
      } else {
        setError(res.error?.message || 'Erro ao carregar feedbacks.');
      }
    } catch (e) {
      setError('Erro de rede ao carregar feedbacks.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOverviewStats();
    fetchCompanies();
    fetchKnowledgeArticles();
  }, []);

  useEffect(() => {
    fetchFeedbacks();
  }, [page, search, selectedCompanyId, selectedStatus, selectedSeverity, selectedCategory, selectedSource]);

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    try {
      const payload = {
        companyId: newCompanyId,
        reportedByName,
        reportedByRole: reportedByRole || null,
        source: newSource,
        category: newCategory,
        severity: newSeverity,
        title: newTitle,
        description: newDescription,
        impact: newImpact || null,
        relatedUrl: newRelatedUrl || null,
        assignedToUserId: newAssignedId || null,
        knowledgeArticleId: newKnowledgeArticleId || null,
      };

      const res = await api.post('/admin/pilot-feedback', payload);
      if (res.success) {
        setIsCreateOpen(false);
        // Clear fields
        setNewCompanyId('');
        setReportedByName('');
        setReportedByRole('');
        setNewTitle('');
        setNewDescription('');
        setNewImpact('');
        setNewRelatedUrl('');
        setNewAssignedId('');
        setNewKnowledgeArticleId('');
        fetchFeedbacks();
        fetchOverviewStats();
      } else {
        alert(res.error?.message || 'Erro ao criar feedback.');
      }
    } catch (e) {
      alert('Erro de rede ao cadastrar.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFeedback || updating) return;
    setUpdating(true);
    try {
      const payload = {
        status: editStatus,
        severity: editSeverity,
        assignedToUserId: editAssignedId || null,
        actionTaken: editActionTaken || null,
        knowledgeArticleId: editKnowledgeArticleId || null,
      };

      const res = await api.patch(`/admin/pilot-feedback/${selectedFeedback.id}`, payload);
      if (res.success) {
        setSelectedFeedback(null);
        fetchFeedbacks();
        fetchOverviewStats();
      } else {
        alert(res.error?.message || 'Erro ao atualizar feedback.');
      }
    } catch (e) {
      alert('Erro de rede ao atualizar.');
    } finally {
      setUpdating(false);
    }
  };

  const openEditDrawer = (feedback: any) => {
    setSelectedFeedback(feedback);
    setEditStatus(feedback.status);
    setEditSeverity(feedback.severity);
    setEditAssignedId(feedback.assignedToUserId || '');
    setEditActionTaken(feedback.actionTaken || '');
    setEditKnowledgeArticleId(feedback.knowledgeArticleId || '');
  };

  return (
    <div className="p-6 space-y-6 text-slate-100 bg-slate-950 min-h-screen">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            <MessageSquare className="w-6 h-6 text-indigo-500" />
            Central de Feedback do Piloto
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            Registre e gerencie incidentes, dúvidas e solicitações de clientes piloto em go-live assistido.
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/app/admin/pilot-backlog"
            className="inline-flex items-center gap-2 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 rounded-lg text-sm font-semibold transition-all cursor-pointer"
          >
            <ClipboardList className="w-4 h-4 text-indigo-400" />
            Ver Backlog Técnico
          </Link>
          <button
            onClick={() => setIsCreateOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-semibold transition-all cursor-pointer shadow-lg shadow-indigo-650/30"
          >
            <Plus className="w-4 h-4" />
            Registrar Feedback
          </button>
        </div>
      </div>

      {/* Summary Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl flex items-center gap-4">
          <div className="p-3 bg-indigo-950/40 text-indigo-400 rounded-xl">
            <ClipboardList className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs text-slate-500 font-semibold block uppercase">Abertos Total</span>
            <span className="text-2xl font-extrabold text-white">{stats.openFeedbacks}</span>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl flex items-center gap-4">
          <div className="p-3 bg-red-950/40 text-red-400 rounded-xl">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs text-slate-500 font-semibold block uppercase">Críticos / High</span>
            <span className="text-2xl font-extrabold text-white">{stats.criticalFeedbacks}</span>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl flex items-center gap-4">
          <div className="p-3 bg-emerald-950/40 text-emerald-400 rounded-xl">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs text-slate-500 font-semibold block uppercase">Resolvidos 7d</span>
            <span className="text-2xl font-extrabold text-white">{stats.resolved7d}</span>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl flex items-center gap-4">
          <div className="p-3 bg-amber-950/40 text-amber-400 rounded-xl">
            <Building2 className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs text-slate-500 font-semibold block uppercase">Empresas com Pendências</span>
            <span className="text-2xl font-extrabold text-white">{stats.companiesWithOpenFeedback}</span>
          </div>
        </div>
      </div>

      {/* Filters Box */}
      <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
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
            className="w-full px-3 py-2 bg-slate-950 border border-slate-850 rounded-lg text-xs text-slate-300 focus:outline-none"
          >
            <option value="">Todas Empresas</option>
            {companies.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>

          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="w-full px-3 py-2 bg-slate-950 border border-slate-850 rounded-lg text-xs text-slate-300 focus:outline-none"
          >
            <option value="">Todos Status</option>
            <option value="OPEN">Aberto</option>
            <option value="IN_REVIEW">Em Revisão</option>
            <option value="PLANNED">Planejado</option>
            <option value="RESOLVED">Resolvido</option>
            <option value="DISMISSED">Descartado</option>
          </select>

          <select
            value={selectedSeverity}
            onChange={(e) => setSelectedSeverity(e.target.value)}
            className="w-full px-3 py-2 bg-slate-950 border border-slate-850 rounded-lg text-xs text-slate-300 focus:outline-none"
          >
            <option value="">Todas Severidades</option>
            <option value="LOW">Low</option>
            <option value="MEDIUM">Medium</option>
            <option value="HIGH">High</option>
            <option value="CRITICAL">Critical</option>
          </select>

          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="w-full px-3 py-2 bg-slate-950 border border-slate-850 rounded-lg text-xs text-slate-300 focus:outline-none"
          >
            <option value="">Todas Categorias</option>
            <option value="BUG">Bug</option>
            <option value="QUESTION">Dúvida</option>
            <option value="USABILITY">Usabilidade</option>
            <option value="TRAINING">Treinamento</option>
            <option value="FEATURE_REQUEST">Feature Request</option>
            <option value="INCIDENT">Incidente</option>
            <option value="COMMERCIAL">Comercial</option>
            <option value="OTHER">Outros</option>
          </select>

          <select
            value={selectedSource}
            onChange={(e) => setSelectedSource(e.target.value)}
            className="w-full px-3 py-2 bg-slate-950 border border-slate-850 rounded-lg text-xs text-slate-300 focus:outline-none"
          >
            <option value="">Todas Origens</option>
            <option value="WHATSAPP">WhatsApp</option>
            <option value="CALL">Chamada</option>
            <option value="EMAIL">E-mail</option>
            <option value="MEETING">Reunião</option>
            <option value="INTERNAL">Interno</option>
            <option value="SYSTEM">Sistema</option>
          </select>
        </div>
      </div>

      {/* Main Table Card */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
        {loading ? (
          <div className="py-24 text-center">
            <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
            <p className="text-xs text-slate-450">Buscando feedbacks e incidentes...</p>
          </div>
        ) : error ? (
          <div className="py-24 text-center text-red-400">
            <AlertTriangle className="w-8 h-8 mx-auto mb-2 text-red-500" />
            <p className="text-xs">{error}</p>
          </div>
        ) : items.length === 0 ? (
          <div className="py-24 text-center text-slate-500">
            <MessageSquare className="w-8 h-8 mx-auto mb-2 text-slate-650" />
            <p className="text-xs">Nenhum feedback registrado com os filtros ativos.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-950/60 text-slate-400 font-semibold">
                  <th className="px-6 py-4">Empresa / Reportado Por</th>
                  <th className="px-6 py-4">Feedback (Título)</th>
                  <th className="px-6 py-4">Categoria</th>
                  <th className="px-6 py-4">Severidade</th>
                  <th className="px-6 py-4">Origem</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4 text-right">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80 text-slate-350">
                {items.map((item) => {
                  return (
                    <tr key={item.id} className="hover:bg-slate-950/20 transition-colors">
                      <td className="px-6 py-4 space-y-1">
                        <div className="font-semibold text-slate-100">{item.company.name}</div>
                        <div className="text-[10px] text-slate-500 font-mono">
                          {item.reportedByName} {item.reportedByRole ? `(${item.reportedByRole})` : ''}
                        </div>
                      </td>
                      <td className="px-6 py-4 max-w-xs truncate font-medium text-slate-200">
                        {item.title}
                      </td>
                      <td className="px-6 py-4">
                        <span className="inline-flex px-2 py-0.5 rounded bg-slate-950 border border-slate-850 text-[10px] font-semibold text-slate-400">
                          {item.category}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex px-2 py-0.5 rounded text-[10px] font-bold ${
                          item.severity === 'CRITICAL' ? 'bg-red-950/40 text-red-400 border border-red-900/50' :
                          item.severity === 'HIGH' ? 'bg-amber-950/40 text-amber-400 border border-amber-900/50' :
                          item.severity === 'MEDIUM' ? 'bg-indigo-950/40 text-indigo-400 border border-indigo-900/50' :
                          'bg-slate-950 text-slate-400 border border-slate-850'
                        }`}>
                          {item.severity}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-slate-500">{item.source}</td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center gap-1.5 font-semibold ${
                          item.status === 'RESOLVED' ? 'text-emerald-450' :
                          item.status === 'IN_REVIEW' ? 'text-indigo-450' :
                          item.status === 'PLANNED' ? 'text-blue-450' :
                          item.status === 'DISMISSED' ? 'text-slate-550 font-normal' :
                          'text-amber-450'
                        }`}>
                          {item.status === 'RESOLVED' ? <CheckCircle2 className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
                          {item.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right flex justify-end gap-2">
                        {item.status !== 'PLANNED' && item.status !== 'RESOLVED' && item.status !== 'DISMISSED' && (
                          <Link
                            href={`/app/admin/pilot-backlog?fromFeedbackId=${item.id}`}
                            className="px-2.5 py-1.5 bg-indigo-950/20 hover:bg-indigo-950/40 text-indigo-455 border border-indigo-900/30 rounded text-[11px] font-semibold transition-colors cursor-pointer"
                          >
                            Criar Backlog
                          </Link>
                        )}
                        <button
                          onClick={() => openEditDrawer(item)}
                          className="px-2.5 py-1.5 bg-slate-950 hover:bg-slate-850 border border-slate-800 rounded text-[11px] font-semibold transition-colors cursor-pointer text-slate-300"
                        >
                          Ver / Tratar
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

      {/* Pagination Footer */}
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
          <div className="w-full max-w-xl bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <Plus className="w-5 h-5 text-indigo-500" />
                Registrar Feedback / Incidente
              </h2>
              <button
                onClick={() => setIsCreateOpen(false)}
                className="text-slate-400 hover:text-white transition-colors cursor-pointer"
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
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded text-slate-200 focus:outline-none focus:border-indigo-500"
                    >
                      <option value="">Selecione uma empresa...</option>
                      {companies.map(c => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-slate-400 font-semibold">Reportado Por (Nome) *</label>
                    <input
                      type="text"
                      required
                      value={reportedByName}
                      onChange={(e) => setReportedByName(e.target.value)}
                      placeholder="Ex: Carlos RH"
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded text-white focus:outline-none focus:border-indigo-500"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-slate-400 font-semibold">Cargo (Role)</label>
                    <input
                      type="text"
                      value={reportedByRole}
                      onChange={(e) => setReportedByRole(e.target.value)}
                      placeholder="Ex: Diretor de RH"
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded text-white focus:outline-none"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-slate-400 font-semibold">Origem do Contato *</label>
                    <select
                      value={newSource}
                      onChange={(e) => setNewSource(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded text-slate-250 focus:outline-none"
                    >
                      <option value="WHATSAPP">WhatsApp</option>
                      <option value="CALL">Chamada de Voz</option>
                      <option value="EMAIL">E-mail</option>
                      <option value="MEETING">Reunião / Call</option>
                      <option value="INTERNAL">Interno PF</option>
                      <option value="SYSTEM">Automático Sistema</option>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-slate-400 font-semibold">Categoria *</label>
                    <select
                      value={newCategory}
                      onChange={(e) => setNewCategory(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded text-slate-250 focus:outline-none"
                    >
                      <option value="BUG">Bug / Falha</option>
                      <option value="QUESTION">Dúvida / Ajuda</option>
                      <option value="USABILITY">Usabilidade</option>
                      <option value="TRAINING">Treinamento</option>
                      <option value="FEATURE_REQUEST">Feature Request</option>
                      <option value="INCIDENT">Incidente Geral</option>
                      <option value="COMMERCIAL">Comercial</option>
                      <option value="OTHER">Outros</option>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-slate-400 font-semibold">Severidade *</label>
                    <select
                      value={newSeverity}
                      onChange={(e) => setNewSeverity(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded text-slate-250 focus:outline-none"
                    >
                      <option value="LOW">Low (Baixa)</option>
                      <option value="MEDIUM">Medium (Média)</option>
                      <option value="HIGH">High (Alta)</option>
                      <option value="CRITICAL">Critical (Crítica)</option>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-slate-400 font-semibold">URL de Referência (Opcional)</label>
                    <input
                      type="text"
                      value={newRelatedUrl}
                      onChange={(e) => setNewRelatedUrl(e.target.value)}
                      placeholder="/app/presence"
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded text-white focus:outline-none"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-slate-400 font-semibold">Título do Resumo *</label>
                  <input
                    type="text"
                    required
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    placeholder="Ex: Erro ao fazer upload de atestado médico PDF"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded text-white focus:outline-none"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-slate-400 font-semibold">Descrição Detalhada *</label>
                  <textarea
                    required
                    rows={4}
                    value={newDescription}
                    onChange={(e) => setNewDescription(e.target.value)}
                    placeholder="Descreva o incidente. Não inclua informações médicas ou CPFs confidenciais."
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded text-slate-200 focus:outline-none"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-slate-400 font-semibold">Impacto no Cliente (Opcional)</label>
                  <textarea
                    rows={2}
                    value={newImpact}
                    onChange={(e) => setNewImpact(e.target.value)}
                    placeholder="Impacto comercial ou operacional"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded text-slate-200 focus:outline-none"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-slate-400 font-semibold">Resolvido com Artigo da Base? (Opcional)</label>
                  <select
                    value={newKnowledgeArticleId}
                    onChange={(e) => setNewKnowledgeArticleId(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded text-slate-200 focus:outline-none"
                  >
                    <option value="">Não (ou Nenhum)</option>
                    {knowledgeArticles.map(a => (
                      <option key={a.id} value={a.id}>[{a.category}] {a.title}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="px-6 py-4 border-t border-slate-800 bg-slate-950/40 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsCreateOpen(false)}
                  className="px-4 py-2 rounded bg-slate-850 hover:bg-slate-800 text-slate-350 font-semibold transition-all cursor-pointer text-xs"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 rounded bg-indigo-655 hover:bg-indigo-600 text-white font-semibold transition-all cursor-pointer disabled:opacity-50 text-xs"
                >
                  {submitting ? 'Processando...' : 'Salvar Registro'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Drawer */}
      {selectedFeedback && (
        <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/80 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-slate-900 border-l border-slate-800 h-full p-6 flex flex-col justify-between shadow-2xl animate-in slide-in-from-right duration-150 text-xs">
            <div className="space-y-6 overflow-y-auto">
              <div className="flex justify-between items-center border-b border-slate-850 pb-4">
                <div>
                  <span className="text-[10px] text-slate-500 uppercase tracking-wider block font-semibold">{selectedFeedback.company.name}</span>
                  <h2 className="text-sm font-bold text-white mt-1">{selectedFeedback.title}</h2>
                </div>
                <button
                  onClick={() => setSelectedFeedback(null)}
                  className="text-slate-400 hover:text-white transition-colors cursor-pointer text-sm"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-4">
                <div className="bg-slate-950/40 p-4 border border-slate-850 rounded-xl space-y-2">
                  <span className="text-slate-500 block">Descrição:</span>
                  <p className="text-slate-200 whitespace-pre-wrap leading-relaxed">{selectedFeedback.description}</p>
                </div>

                {selectedFeedback.impact && (
                  <div className="space-y-1">
                    <span className="text-slate-550 block">Impacto Comercial/Operacional:</span>
                    <p className="text-slate-300 font-medium">{selectedFeedback.impact}</p>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4 border-t border-slate-850/60 pt-4">
                  <div>
                    <span className="text-slate-500 block">Categoria:</span>
                    <span className="text-slate-300 font-bold block mt-0.5">{selectedFeedback.category}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Data de Criação:</span>
                    <span className="text-slate-300 block mt-0.5">{new Date(selectedFeedback.createdAt).toLocaleDateString('pt-BR')}</span>
                  </div>
                </div>

                {/* Edit Form */}
                <form onSubmit={handleUpdateSubmit} className="space-y-4 border-t border-slate-850/60 pt-4">
                  <h3 className="text-xs font-bold text-indigo-400 uppercase tracking-wider">Tratamento e Correção</h3>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-slate-450 font-semibold block">Alterar Status</label>
                      <select
                        value={editStatus}
                        onChange={(e) => setEditStatus(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded text-slate-250 focus:outline-none"
                      >
                        <option value="OPEN">Open (Aberto)</option>
                        <option value="IN_REVIEW">In Review</option>
                        <option value="PLANNED">Planned</option>
                        <option value="RESOLVED">Resolved (Corrigido)</option>
                        <option value="DISMISSED">Dismissed (Descartado)</option>
                      </select>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-slate-450 font-semibold block">Severidade</label>
                      <select
                        value={editSeverity}
                        onChange={(e) => setEditSeverity(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded text-slate-250 focus:outline-none"
                      >
                        <option value="LOW">Low</option>
                        <option value="MEDIUM">Medium</option>
                        <option value="HIGH">High</option>
                        <option value="CRITICAL">Critical</option>
                      </select>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-slate-450 font-semibold block">Ações Tomadas / Correção Efetuada</label>
                    <textarea
                      rows={4}
                      value={editActionTaken}
                      onChange={(e) => setEditActionTaken(e.target.value)}
                      placeholder="Medidas corretivas..."
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded text-slate-200 focus:outline-none"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-slate-450 font-semibold block">Resolvido com Artigo da Base?</label>
                    <select
                      value={editKnowledgeArticleId}
                      onChange={(e) => setEditKnowledgeArticleId(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded text-slate-250 focus:outline-none"
                    >
                      <option value="">Não (ou Nenhum)</option>
                      {knowledgeArticles.map(a => (
                        <option key={a.id} value={a.id}>[{a.category}] {a.title}</option>
                      ))}
                    </select>
                  </div>

                  <div className="flex gap-3 justify-end pt-2">
                    <button
                      type="button"
                      onClick={() => setSelectedFeedback(null)}
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
