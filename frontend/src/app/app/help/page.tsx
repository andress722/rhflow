'use client';

import React, { useEffect, useState, Suspense } from 'react';
import { api } from '@/lib/api';
import {
  BookOpen,
  Search,
  ChevronRight,
  FolderOpen,
  AlertTriangle,
  ArrowLeft,
  ExternalLink,
  Tag,
  Rocket,
  ShieldCheck,
  HelpCircle
} from 'lucide-react';
import Link from 'next/link';
import { trackEvent } from '@/lib/telemetry';

function ClientHelpContent() {
  const [articles, setArticles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');

  // Selected article view
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);
  const [articleDetail, setArticleDetail] = useState<any | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  const fetchArticles = async () => {
    setLoading(true);
    setError(null);
    try {
      const query = new URLSearchParams();
      if (search) query.append('search', search);
      if (selectedCategory) query.append('category', selectedCategory);

      // Leitura corporativa/pública de artigos publicados
      const res = await api.get(`/knowledge/articles?${query.toString()}`);
      if (res.success) {
        setArticles(res.data || []);
      } else {
        setError(res.error?.message || 'Erro ao consultar central de ajuda.');
      }
    } catch (e) {
      setError('Erro de conexão ao buscar artigos.');
    } finally {
      setLoading(false);
    }
  };

  const fetchArticleDetail = async (slug: string) => {
    setLoadingDetail(true);
    try {
      const res = await api.get(`/knowledge/articles/${slug}`);
      if (res.success) {
        setArticleDetail(res.data);
        trackEvent('ARTICLE_VIEW', 'KNOWLEDGE_BASE', { slug, title: res.data.title });
      } else {
        alert(res.error?.message || 'Erro ao carregar detalhes do artigo.');
      }
    } catch (e) {
      alert('Erro de conexão.');
    } finally {
      setLoadingDetail(false);
    }
  };

  useEffect(() => {
    fetchArticles();
    trackEvent('PAGE_VIEW', 'KNOWLEDGE_BASE', { path: '/app/help' });
  }, [search, selectedCategory]);

  useEffect(() => {
    if (selectedSlug) {
      fetchArticleDetail(selectedSlug);
    } else {
      setArticleDetail(null);
    }
  }, [selectedSlug]);

  const renderMarkdown = (md: string) => {
    if (!md) return null;
    let html = md
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/^# (.*$)/gim, '<h1 class="text-xl font-extrabold text-white mt-6 mb-3 pb-1.5 border-b border-slate-800">$1</h1>')
      .replace(/^## (.*$)/gim, '<h2 class="text-lg font-bold text-white mt-5 mb-2">$1</h2>')
      .replace(/^### (.*$)/gim, '<h3 class="text-sm font-bold text-white mt-3 mb-1.5">$1</h3>')
      .replace(/\*\*(.*?)\*\*/gim, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/gim, '<em>$1</em>')
      .replace(/`(.*?)`/gim, '<code class="bg-slate-950 px-1.5 py-0.5 rounded text-indigo-400 font-mono text-[11px]">$1</code>')
      .replace(/^\s*-\s*(.*$)/gim, '<li class="ml-5 list-disc text-slate-350 my-1">$1</li>')
      .replace(/\n/g, '<br/>');

    return <div className="space-y-2 text-slate-300 leading-relaxed text-xs" dangerouslySetInnerHTML={{ __html: html }} />;
  };

  const categories = [
    { value: '', label: 'Todos' },
    { value: 'ONBOARDING', label: 'Onboarding' },
    { value: 'CHECKIN', label: 'Check-in Remoto' },
    { value: 'OCCURRENCES', label: 'Ocorrências' },
    { value: 'MEDICAL_CERTIFICATES', label: 'Atestados' },
    { value: 'REPORTS', label: 'Relatórios' },
    { value: 'FAQ', label: 'Perguntas Frequentes' },
    { value: 'TROUBLESHOOTING', label: 'Resolução de Problemas' },
  ];

  return (
    <div className="p-6 space-y-6 text-slate-100 bg-slate-950 min-h-screen">
      {/* Help Center Layout */}
      {!selectedSlug ? (
        <>
          {/* Hero Section */}
          <div className="text-center py-8 space-y-3 bg-gradient-to-b from-indigo-950/20 via-slate-950 to-slate-950 border border-slate-900 rounded-2xl p-6">
            <h1 className="text-2xl font-extrabold tracking-tight text-white flex items-center justify-center gap-2">
              <HelpCircle className="w-7 h-7 text-indigo-500" />
              Central de Ajuda e Suporte
            </h1>
            <p className="text-slate-400 text-xs max-w-lg mx-auto">
              Encontre guias de primeiros passos, tutoriais de bater ponto e configurações do piloto RH.
            </p>

            {/* Central Search */}
            <div className="max-w-md mx-auto relative pt-2">
              <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-5.5" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Qual sua dúvida hoje? Digite palavras-chave..."
                className="w-full pl-10 pr-4 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-xs focus:outline-none focus:border-indigo-500 text-slate-200 shadow-xl"
              />
            </div>
          </div>

          {/* Featured Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-slate-900 border border-slate-850 p-4 rounded-xl space-y-2">
              <div className="p-2 bg-indigo-950/40 text-indigo-400 rounded-lg w-fit">
                <Rocket className="w-5 h-5" />
              </div>
              <h3 className="text-xs font-bold text-white uppercase tracking-wider">Primeiros Passos</h3>
              <p className="text-slate-400 text-[11px] leading-relaxed">
                Aprenda a importar funcionários por planilha e cadastrar escalas iniciais.
              </p>
              <button
                onClick={() => setSelectedSlug('como-importar-funcionarios')}
                className="text-xs text-indigo-400 hover:text-indigo-300 font-semibold flex items-center gap-1 cursor-pointer"
              >
                Ler manual <ChevronRight className="w-3 h-3" />
              </button>
            </div>

            <div className="bg-slate-900 border border-slate-850 p-4 rounded-xl space-y-2">
              <div className="p-2 bg-emerald-950/40 text-emerald-400 rounded-lg w-fit">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <h3 className="text-xs font-bold text-white uppercase tracking-wider">Check-in pelo WhatsApp</h3>
              <p className="text-slate-400 text-[11px] leading-relaxed">
                Entenda o fluxo simplificado para colaboradores registrarem presença remotamente.
              </p>
              <button
                onClick={() => setSelectedSlug('como-usar-check-in-remoto')}
                className="text-xs text-emerald-400 hover:text-emerald-350 font-semibold flex items-center gap-1 cursor-pointer"
              >
                Ler manual <ChevronRight className="w-3 h-3" />
              </button>
            </div>

            <div className="bg-slate-900 border border-slate-850 p-4 rounded-xl space-y-2">
              <div className="p-2 bg-amber-950/40 text-amber-500 rounded-lg w-fit">
                <BookOpen className="w-5 h-5" />
              </div>
              <h3 className="text-xs font-bold text-white uppercase tracking-wider">Envio de Atestados</h3>
              <p className="text-slate-400 text-[11px] leading-relaxed">
                Como os colaboradores anexam imagens de atestados e como o RH os valida.
              </p>
              <button
                onClick={() => setSelectedSlug('como-enviar-e-revisar-atestados')}
                className="text-xs text-amber-500 hover:text-amber-450 font-semibold flex items-center gap-1 cursor-pointer"
              >
                Ler manual <ChevronRight className="w-3 h-3" />
              </button>
            </div>
          </div>

          {/* Categories Filter Bar */}
          <div className="flex flex-wrap gap-2 border-b border-slate-850 pb-2">
            {categories.map((cat) => (
              <button
                key={cat.value}
                onClick={() => setSelectedCategory(cat.value)}
                className={`px-3 py-1.5 rounded-full text-[11px] font-semibold transition-all cursor-pointer ${
                  selectedCategory === cat.value
                    ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-650/20'
                    : 'bg-slate-900 hover:bg-slate-850 text-slate-400 border border-slate-800'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>

          {/* Articles List */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {loading ? (
              <div className="col-span-2 py-12 text-center text-slate-500">
                <div className="w-6 h-6 border-2 border-indigo-650 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
                Carregando manuais...
              </div>
            ) : error ? (
              <div className="col-span-2 py-12 text-center text-red-400">
                <AlertTriangle className="w-6 h-6 mx-auto mb-2 text-red-500" />
                {error}
              </div>
            ) : articles.length === 0 ? (
              <div className="col-span-2 py-12 text-center text-slate-500">
                <FolderOpen className="w-6 h-6 mx-auto mb-2 text-slate-655" />
                Nenhum manual de instrução publicado nesta categoria.
              </div>
            ) : (
              articles.map((art) => (
                <div
                  key={art.id}
                  onClick={() => setSelectedSlug(art.slug)}
                  className="bg-slate-900 border border-slate-850 p-4 rounded-xl hover:border-slate-700 hover:bg-slate-900/60 transition-all cursor-pointer flex flex-col justify-between group"
                >
                  <div className="space-y-1.5">
                    <span className="text-[10px] px-2 py-0.5 rounded bg-slate-950 text-slate-405 font-semibold w-fit block font-mono">
                      {art.category}
                    </span>
                    <h4 className="text-xs font-bold text-white group-hover:text-indigo-400 transition-colors">
                      {art.title}
                    </h4>
                    <p className="text-slate-400 text-[11px] leading-relaxed line-clamp-2">
                      {art.summary}
                    </p>
                  </div>

                  <div className="flex justify-between items-center pt-3 border-t border-slate-850/60 mt-3 text-[10px] text-slate-500">
                    <span className="flex items-center gap-1">
                      <Tag className="w-3 h-3 text-indigo-500" />
                      {art.tags?.join(', ') || 'geral'}
                    </span>
                    <span className="text-indigo-400 font-semibold group-hover:underline">Acessar tutorial &rarr;</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </>
      ) : (
        /* Selected Article Detail View */
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-6">
          <button
            onClick={() => setSelectedSlug(null)}
            className="inline-flex items-center gap-2 text-slate-400 hover:text-white text-xs font-semibold cursor-pointer pb-2"
          >
            <ArrowLeft className="w-4 h-4" /> Voltar para central de ajuda
          </button>

          {loadingDetail ? (
            <div className="py-20 text-center text-slate-500">
              <div className="w-6 h-6 border-2 border-indigo-650 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
              Carregando artigo...
            </div>
          ) : !articleDetail ? (
            <div className="py-20 text-center text-red-405">Artigo não encontrado ou sem permissão de acesso.</div>
          ) : (
            <div className="space-y-6">
              <div className="border-b border-slate-800 pb-4 space-y-2">
                <span className="px-2.5 py-0.5 rounded bg-slate-950 border border-slate-850 text-[10px] font-mono font-semibold text-slate-400">
                  {articleDetail.category}
                </span>
                <h2 className="text-lg font-extrabold text-white">{articleDetail.title}</h2>
                <p className="text-slate-400 text-xs font-medium leading-relaxed italic">{articleDetail.summary}</p>
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {articleDetail.tags?.map((t: string) => (
                    <span key={t} className="text-[10px] bg-slate-950 text-indigo-400 border border-indigo-950/80 px-2 py-0.5 rounded-full font-semibold">
                      #{t}
                    </span>
                  ))}
                </div>
              </div>

              {/* Rendered Body */}
              <div className="bg-slate-950/40 p-5 border border-slate-850 rounded-xl">
                {renderMarkdown(articleDetail.contentMarkdown)}
              </div>

              {/* Action Link Button */}
              {articleDetail.relatedUrl && (
                <div className="pt-2">
                  <Link
                    href={articleDetail.relatedUrl}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded font-bold text-xs transition-colors shadow-lg shadow-indigo-650/20"
                  >
                    <ExternalLink className="w-4 h-4" />
                    Ir para tela do sistema
                  </Link>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function ClientHelpPage() {
  return (
    <Suspense fallback={
      <div className="p-6 text-center text-slate-400 bg-slate-950 min-h-screen">
        Carregando Central de Ajuda...
      </div>
    }>
      <ClientHelpContent />
    </Suspense>
  );
}
