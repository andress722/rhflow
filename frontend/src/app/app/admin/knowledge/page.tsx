'use client';

import React, { useEffect, useState, Suspense } from 'react';
import { api } from '@/lib/api';
import {
  BookOpen,
  Search,
  Plus,
  Edit2,
  Trash2,
  FileText,
  Clock,
  Eye,
  CheckCircle,
  AlertTriangle,
  FolderOpen,
  Users,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Archive,
  Save,
  Tag
} from 'lucide-react';

function AdminKnowledgeContent() {
  const [articles, setArticles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedAudience, setSelectedAudience] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');

  // Form State
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedArticle, setSelectedArticle] = useState<any | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Edit / Create Form inputs
  const [title, setTitle] = useState('');
  const [slug, setSlug] = useState('');
  const [category, setCategory] = useState('FAQ');
  const [audience, setAudience] = useState('PUBLIC');
  const [status, setStatus] = useState('DRAFT');
  const [summary, setSummary] = useState('');
  const [contentMarkdown, setContentMarkdown] = useState('');
  const [tagInput, setTagInput] = useState('');
  const [relatedUrl, setRelatedUrl] = useState('');

  // Active view tab for markdown editor: 'edit' or 'preview'
  const [editorTab, setEditorTab] = useState<'edit' | 'preview'>('edit');

  const fetchArticles = async () => {
    setLoading(true);
    setError(null);
    try {
      const query = new URLSearchParams();
      if (search) query.append('search', search);
      if (selectedCategory) query.append('category', selectedCategory);
      if (selectedAudience) query.append('audience', selectedAudience);
      if (selectedStatus) query.append('status', selectedStatus);

      const res = await api.get(`/admin/knowledge/articles?${query.toString()}`);
      if (res.success) {
        setArticles(res.data || []);
      } else {
        setError(res.error?.message || 'Erro ao carregar artigos.');
      }
    } catch (e) {
      setError('Erro de rede ao buscar artigos.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchArticles();
  }, [search, selectedCategory, selectedAudience, selectedStatus]);

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    try {
      const tags = tagInput.split(',').map(t => t.trim()).filter(Boolean);
      const payload = {
        title,
        slug: slug || null,
        category,
        audience,
        status,
        summary,
        contentMarkdown,
        tags,
        relatedUrl: relatedUrl || null,
      };

      const res = await api.post('/admin/knowledge/articles', payload);
      if (res.success) {
        setIsCreateOpen(false);
        resetForm();
        fetchArticles();
      } else {
        alert(res.error?.message || 'Erro ao criar artigo.');
      }
    } catch (e) {
      alert('Erro de rede.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedArticle || submitting) return;
    setSubmitting(true);
    try {
      const tags = tagInput.split(',').map(t => t.trim()).filter(Boolean);
      const payload = {
        title,
        category,
        audience,
        status,
        summary,
        contentMarkdown,
        tags,
        relatedUrl: relatedUrl || null,
      };

      const res = await api.patch(`/admin/knowledge/articles/${selectedArticle.id}`, payload);
      if (res.success) {
        setSelectedArticle(null);
        resetForm();
        fetchArticles();
      } else {
        alert(res.error?.message || 'Erro ao atualizar.');
      }
    } catch (e) {
      alert('Erro de rede.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleArchive = async (id: string) => {
    if (!confirm('Deseja realmente arquivar este artigo? Ele não aparecerá mais nas buscas de clientes.')) return;
    try {
      const res = await api.delete(`/admin/knowledge/articles/${id}`);
      if (res.success) {
        fetchArticles();
      } else {
        alert(res.error?.message || 'Erro ao arquivar.');
      }
    } catch (e) {
      alert('Erro ao arquivar.');
    }
  };

  const resetForm = () => {
    setTitle('');
    setSlug('');
    setCategory('FAQ');
    setAudience('PUBLIC');
    setStatus('DRAFT');
    setSummary('');
    setContentMarkdown('');
    setTagInput('');
    setRelatedUrl('');
    setEditorTab('edit');
  };

  const startEdit = (art: any) => {
    setSelectedArticle(art);
    setTitle(art.title);
    setSlug(art.slug);
    setCategory(art.category);
    setAudience(art.audience);
    setStatus(art.status);
    setSummary(art.summary);
    setContentMarkdown(art.contentMarkdown);
    setTagInput(art.tags?.join(', ') || '');
    setRelatedUrl(art.relatedUrl || '');
    setEditorTab('edit');
    setIsCreateOpen(true);
  };

  // Simple Markdown renderer representation
  const renderPreview = (md: string) => {
    if (!md) return <span className="text-slate-500 italic">Sem conteúdo digitado.</span>;
    // Replace headings, bold, bullet points
    let html = md
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/^# (.*$)/gim, '<h1 class="text-xl font-extrabold text-white mt-4 mb-2 pb-1 border-b border-slate-800">$1</h1>')
      .replace(/^## (.*$)/gim, '<h2 class="text-lg font-bold text-white mt-3 mb-1.5">$1</h2>')
      .replace(/^### (.*$)/gim, '<h3 class="text-sm font-bold text-white mt-2 mb-1">$1</h3>')
      .replace(/\*\*(.*?)\*\*/gim, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/gim, '<em>$1</em>')
      .replace(/`(.*?)`/gim, '<code class="bg-slate-950 px-1 py-0.5 rounded text-amber-400 font-mono text-[11px]">$1</code>')
      .replace(/^\s*-\s*(.*$)/gim, '<li class="ml-4 list-disc text-slate-300 my-0.5">$1</li>')
      .replace(/\n/g, '<br/>');

    return <div className="space-y-1 text-slate-300 leading-relaxed text-xs" dangerouslySetInnerHTML={{ __html: html }} />;
  };

  return (
    <div className="p-6 space-y-6 text-slate-100 bg-slate-950 min-h-screen">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            <BookOpen className="w-6 h-6 text-indigo-500" />
            Gestão da Base de Conhecimento
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            Crie manuais de onboarding, perguntas frequentes, tutoriais de WhatsApp e relatórios.
          </p>
        </div>
        <button
          onClick={() => {
            setSelectedArticle(null);
            resetForm();
            setIsCreateOpen(true);
          }}
          className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-650 hover:bg-indigo-600 text-white rounded-lg text-sm font-semibold transition-all cursor-pointer shadow-lg shadow-indigo-650/30"
        >
          <Plus className="w-4 h-4" />
          Novo Artigo
        </button>
      </div>

      {/* Stats Summary Panel */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="bg-slate-900 border border-slate-850 p-4 rounded-xl">
          <span className="text-[10px] text-slate-500 font-bold block uppercase">Total de Artigos</span>
          <span className="text-xl font-extrabold text-white">{articles.length}</span>
        </div>
        <div className="bg-slate-900 border border-slate-850 p-4 rounded-xl">
          <span className="text-[10px] text-slate-500 font-bold block uppercase text-emerald-450">Publicados</span>
          <span className="text-xl font-extrabold text-white">
            {articles.filter(a => a.status === 'PUBLISHED').length}
          </span>
        </div>
        <div className="bg-slate-900 border border-slate-850 p-4 rounded-xl">
          <span className="text-[10px] text-slate-500 font-bold block uppercase text-amber-500">Rascunhos</span>
          <span className="text-xl font-extrabold text-white">
            {articles.filter(a => a.status === 'DRAFT').length}
          </span>
        </div>
        <div className="bg-slate-900 border border-slate-850 p-4 rounded-xl">
          <span className="text-[10px] text-slate-500 font-bold block uppercase text-slate-450">Arquivados</span>
          <span className="text-xl font-extrabold text-white">
            {articles.filter(a => a.status === 'ARCHIVED').length}
          </span>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-slate-900 border border-slate-850 p-4 rounded-xl">
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por título ou resumo..."
              className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-850 rounded-lg text-xs focus:outline-none focus:border-indigo-500 text-slate-200"
            />
          </div>

          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="w-full px-3 py-2 bg-slate-950 border border-slate-850 rounded-lg text-xs text-slate-350 focus:outline-none"
          >
            <option value="">Todas Categorias</option>
            <option value="ONBOARDING">Onboarding (Implantação)</option>
            <option value="WHATSAPP">WhatsApp Channel</option>
            <option value="CHECKIN">Check-in / Presença</option>
            <option value="OCCURRENCES">Ocorrências</option>
            <option value="MEDICAL_CERTIFICATES">Atestados Médicos</option>
            <option value="REPORTS">Relatórios</option>
            <option value="BILLING">Billing / Financeiro</option>
            <option value="TROUBLESHOOTING">Resolução de Problemas</option>
            <option value="FAQ">FAQ / Dúvidas Frequentes</option>
            <option value="RELEASE_NOTES">Release Notes</option>
          </select>

          <select
            value={selectedAudience}
            onChange={(e) => setSelectedAudience(e.target.value)}
            className="w-full px-3 py-2 bg-slate-950 border border-slate-850 rounded-lg text-xs text-slate-350 focus:outline-none"
          >
            <option value="">Todas Audiências</option>
            <option value="SUPER_ADMIN">Super Admin (Plataforma)</option>
            <option value="ADMIN_HR">Admin / RH</option>
            <option value="MANAGER">Gestores / Managers</option>
            <option value="EMPLOYEE">Colaboradores</option>
            <option value="PUBLIC">Público / Visitantes</option>
          </select>

          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="w-full px-3 py-2 bg-slate-950 border border-slate-850 rounded-lg text-xs text-slate-350 focus:outline-none"
          >
            <option value="">Todos Status</option>
            <option value="DRAFT">Rascunho (Draft)</option>
            <option value="PUBLISHED">Publicado</option>
            <option value="ARCHIVED">Arquivado</option>
          </select>
        </div>
      </div>

      {/* Main Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
        {loading ? (
          <div className="py-20 text-center">
            <div className="w-8 h-8 border-4 border-indigo-650 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
            <p className="text-xs text-slate-500">Buscando artigos...</p>
          </div>
        ) : error ? (
          <div className="py-20 text-center text-red-400">
            <AlertTriangle className="w-8 h-8 mx-auto mb-2 text-red-500" />
            <p className="text-xs">{error}</p>
          </div>
        ) : articles.length === 0 ? (
          <div className="py-20 text-center text-slate-500">
            <FolderOpen className="w-8 h-8 mx-auto mb-2 text-slate-655" />
            <p className="text-xs">Nenhum artigo encontrado.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-850 bg-slate-950/60 text-slate-400 font-semibold">
                  <th className="px-6 py-4">Título</th>
                  <th className="px-6 py-4">Slug</th>
                  <th className="px-6 py-4">Categoria</th>
                  <th className="px-6 py-4">Audiência</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4">Data Publicação</th>
                  <th className="px-6 py-4 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-slate-350">
                {articles.map((art) => (
                  <tr key={art.id} className="hover:bg-slate-950/20 transition-colors">
                    <td className="px-6 py-4 font-semibold text-slate-100 max-w-xs truncate">{art.title}</td>
                    <td className="px-6 py-4 font-mono text-slate-400">{art.slug}</td>
                    <td className="px-6 py-4">
                      <span className="px-2 py-0.5 rounded bg-slate-950 border border-slate-850 text-[10px] font-semibold text-slate-400">
                        {art.category}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-slate-400 font-semibold">{art.audience}</td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center gap-1 font-bold ${
                        art.status === 'PUBLISHED' ? 'text-emerald-450' :
                        art.status === 'DRAFT' ? 'text-amber-500' :
                        'text-slate-500'
                      }`}>
                        {art.status === 'PUBLISHED' ? <CheckCircle className="w-3.5 h-3.5" /> : <Clock className="w-3.5 h-3.5" />}
                        {art.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-slate-500">
                      {art.publishedAt ? new Date(art.publishedAt).toLocaleDateString('pt-BR') : 'Não publicado'}
                    </td>
                    <td className="px-6 py-4 text-right flex justify-end gap-2">
                      <button
                        onClick={() => startEdit(art)}
                        className="p-1.5 bg-slate-950 hover:bg-slate-850 border border-slate-800 rounded text-slate-350 transition-colors cursor-pointer"
                        title="Editar Artigo"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      {art.status !== 'ARCHIVED' && (
                        <button
                          onClick={() => handleArchive(art.id)}
                          className="p-1.5 bg-slate-955/20 hover:bg-slate-955/40 border border-red-950 text-red-400 rounded transition-colors cursor-pointer"
                          title="Arquivar Artigo"
                        >
                          <Archive className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Editor Modal */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="w-full max-w-4xl bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-155 flex flex-col max-h-[90vh]">
            <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between shrink-0">
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <FileText className="w-5 h-5 text-indigo-500" />
                {selectedArticle ? 'Editar Artigo' : 'Adicionar Artigo de Ajuda'}
              </h2>
              <button
                onClick={() => setIsCreateOpen(false)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={selectedArticle ? handleUpdateSubmit : handleCreateSubmit} className="flex flex-col flex-1 overflow-hidden">
              <div className="p-6 space-y-4 overflow-y-auto flex-1 text-xs">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <div className="space-y-1.5 col-span-2">
                    <label className="text-slate-400 font-semibold">Título *</label>
                    <input
                      type="text"
                      required
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="Ex: Como configurar atestados médicos"
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded text-white focus:outline-none"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-slate-400 font-semibold">Slug (opcional)</label>
                    <input
                      type="text"
                      value={slug}
                      onChange={(e) => setSlug(e.target.value)}
                      placeholder="Ex: como-configurar-atestados"
                      disabled={!!selectedArticle}
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded text-white focus:outline-none disabled:opacity-50"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-slate-400 font-semibold">Categoria *</label>
                    <select
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded text-slate-250 focus:outline-none"
                    >
                      <option value="ONBOARDING">Onboarding (Implantação)</option>
                      <option value="WHATSAPP">WhatsApp Channel</option>
                      <option value="CHECKIN">Check-in / Presença</option>
                      <option value="OCCURRENCES">Ocorrências</option>
                      <option value="MEDICAL_CERTIFICATES">Atestados Médicos</option>
                      <option value="REPORTS">Relatórios</option>
                      <option value="BILLING">Billing / Financeiro</option>
                      <option value="TROUBLESHOOTING">Resolução de Problemas</option>
                      <option value="FAQ">FAQ / Dúvidas Frequentes</option>
                      <option value="RELEASE_NOTES">Release Notes</option>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-slate-400 font-semibold">Audiência *</label>
                    <select
                      value={audience}
                      onChange={(e) => setAudience(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded text-slate-250 focus:outline-none"
                    >
                      <option value="SUPER_ADMIN">Super Admin (Plataforma)</option>
                      <option value="ADMIN_HR">Admin / RH</option>
                      <option value="MANAGER">Gestores / Managers</option>
                      <option value="EMPLOYEE">Colaboradores</option>
                      <option value="PUBLIC">Público / Visitantes</option>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-slate-400 font-semibold">Status *</label>
                    <select
                      value={status}
                      onChange={(e) => setStatus(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded text-slate-250 focus:outline-none"
                    >
                      <option value="DRAFT">Rascunho (Draft)</option>
                      <option value="PUBLISHED">Publicado</option>
                      <option value="ARCHIVED">Arquivado</option>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-slate-400 font-semibold">Tags (separadas por vírgula)</label>
                    <input
                      type="text"
                      value={tagInput}
                      onChange={(e) => setTagInput(e.target.value)}
                      placeholder="Ex: importacao, planilha, csv"
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded text-white focus:outline-none"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-slate-400 font-semibold">URL de Link Contextual (opcional)</label>
                    <input
                      type="text"
                      value={relatedUrl}
                      onChange={(e) => setRelatedUrl(e.target.value)}
                      placeholder="Ex: /app/onboarding"
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded text-white focus:outline-none"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-slate-400 font-semibold">Resumo descritivo (máx 500 caract.) *</label>
                  <textarea
                    required
                    rows={2}
                    maxLength={500}
                    value={summary}
                    onChange={(e) => setSummary(e.target.value)}
                    placeholder="Escreva um breve resumo contendo as principais informações descritas no artigo..."
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded text-slate-200 focus:outline-none"
                  />
                </div>

                {/* Editor / Preview Tabs */}
                <div className="space-y-2 flex flex-col flex-1 min-h-[250px]">
                  <div className="flex border-b border-slate-800 pb-1 justify-between items-center">
                    <span className="text-slate-400 font-semibold">Conteúdo Markdown (máx 20.000 caract.) *</span>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setEditorTab('edit')}
                        className={`px-3 py-1 rounded text-[11px] font-semibold cursor-pointer ${
                          editorTab === 'edit' ? 'bg-indigo-650 text-white' : 'bg-slate-950 text-slate-400 border border-slate-800'
                        }`}
                      >
                        Editar
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditorTab('preview')}
                        className={`px-3 py-1 rounded text-[11px] font-semibold cursor-pointer ${
                          editorTab === 'preview' ? 'bg-indigo-650 text-white' : 'bg-slate-950 text-slate-400 border border-slate-800'
                        }`}
                      >
                        Preview Renderizado
                      </button>
                    </div>
                  </div>

                  {editorTab === 'edit' ? (
                    <textarea
                      required
                      rows={8}
                      maxLength={20000}
                      value={contentMarkdown}
                      onChange={(e) => setContentMarkdown(e.target.value)}
                      placeholder="# Título do Artigo&#10;&#10;Escreva as instruções utilizando Markdown básico...&#10;- Passo 1&#10;- Passo 2"
                      className="w-full flex-1 p-3 bg-slate-950 border border-slate-800 rounded font-mono text-[11px] text-slate-250 focus:outline-none min-h-[200px]"
                    />
                  ) : (
                    <div className="w-full flex-1 p-4 bg-slate-950 border border-slate-800 rounded min-h-[200px] overflow-y-auto">
                      {renderPreview(contentMarkdown)}
                    </div>
                  )}
                </div>
              </div>

              <div className="px-6 py-4 border-t border-slate-800 bg-slate-950/40 flex justify-end gap-3 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsCreateOpen(false)}
                  className="px-4 py-2 rounded bg-slate-850 hover:bg-slate-800 text-slate-350 font-semibold transition-all cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 rounded bg-indigo-650 hover:bg-indigo-650 text-white font-semibold transition-all cursor-pointer disabled:opacity-50"
                >
                  {submitting ? 'Salvando...' : 'Salvar Artigo'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default function AdminKnowledgePage() {
  return (
    <Suspense fallback={
      <div className="p-6 text-center text-slate-400 bg-slate-950 min-h-screen">
        Carregando base de conhecimento...
      </div>
    }>
      <AdminKnowledgeContent />
    </Suspense>
  );
}
