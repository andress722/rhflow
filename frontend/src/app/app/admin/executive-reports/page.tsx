'use client';

import React, { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import {
  FileText,
  Calendar,
  Building2,
  Copy,
  Check,
  TrendingUp,
  AlertCircle,
  HelpCircle,
  ArrowRight,
  TrendingDown,
  CheckSquare,
  FileCode,
  ShieldCheck,
} from 'lucide-react';
import Link from 'next/link';

interface CompanyItem {
  id: string;
  name: string;
}

export default function AdminExecutiveReportsPage() {
  const [companies, setCompanies] = useState<CompanyItem[]>([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState('');
  
  // Date states (default to last 30 days)
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const [isLoadingCompanies, setIsLoadingCompanies] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [reportData, setReportData] = useState<any>(null);
  
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    // Set default dates
    const today = new Date();
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(today.getDate() - 30);

    setDateTo(today.toISOString().split('T')[0]);
    setDateFrom(thirtyDaysAgo.toISOString().split('T')[0]);

    // Check if companyId is in URL query parameters
    const params = new URLSearchParams(window.location.search);
    const companyIdParam = params.get('companyId');
    if (companyIdParam) {
      setSelectedCompanyId(companyIdParam);
    }

    fetchCompanies();
  }, []);

  const fetchCompanies = async () => {
    setIsLoadingCompanies(true);
    try {
      const res: any = await api.get('/admin/companies');
      if (res.success && Array.isArray(res.data)) {
        setCompanies(res.data);
        // Default to first company if none selected/passed
        const params = new URLSearchParams(window.location.search);
        const companyIdParam = params.get('companyId');
        if (!companyIdParam && res.data.length > 0) {
          setSelectedCompanyId(res.data[0].id);
        }
      }
    } catch (err) {
      console.error('Erro ao buscar empresas:', err);
    } finally {
      setIsLoadingCompanies(false);
    }
  };

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCompanyId || !dateFrom || !dateTo) return;

    setIsGenerating(true);
    setError('');
    setReportData(null);
    setCopied(false);

    try {
      const url = `/admin/executive-reports/company/${selectedCompanyId}?dateFrom=${dateFrom}&dateTo=${dateTo}`;
      const res: any = await api.get(url);
      if (res.success && res.data) {
        setReportData(res.data);
      } else {
        setError(res.error?.message || 'Erro ao gerar relatório executivo.');
      }
    } catch (err) {
      setError('Erro de rede ao comunicar com o servidor.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopy = () => {
    if (!reportData?.markdownReport) return;
    navigator.clipboard.writeText(reportData.markdownReport);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const selectedCompanyName = companies.find((c) => c.id === selectedCompanyId)?.name || 'Empresa';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            <FileText className="w-6 h-6 text-indigo-500" />
            Painel de Relatórios Executivos
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Gere relatórios de valor e pacotes de evidências da operação do cliente piloto.
          </p>
        </div>

        {/* Quick Links Menu */}
        <div className="flex flex-wrap gap-2 text-xs font-bold bg-slate-900 border border-slate-800 p-1.5 rounded-xl">
          <Link
            href="/app/admin/pilots"
            className="px-2.5 py-1.5 hover:bg-slate-800 text-slate-400 hover:text-white rounded-lg transition-all"
          >
            Pilotos
          </Link>
          <Link
            href="/app/admin/billing"
            className="px-2.5 py-1.5 hover:bg-slate-800 text-slate-400 hover:text-white rounded-lg transition-all"
          >
            Faturamento
          </Link>
          <Link
            href="/app/admin/retention"
            className="px-2.5 py-1.5 hover:bg-slate-800 text-slate-400 hover:text-white rounded-lg transition-all"
          >
            Retenção
          </Link>
          <Link
            href="/app/admin/support/customer-success"
            className="px-2.5 py-1.5 hover:bg-slate-800 text-slate-400 hover:text-white rounded-lg transition-all"
          >
            Customer Success
          </Link>
          <Link
            href="/app/admin/pilot-backlog"
            className="px-2.5 py-1.5 hover:bg-slate-800 text-slate-400 hover:text-white rounded-lg transition-all"
          >
            Backlog
          </Link>
        </div>
      </div>

      {/* Controls Card */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-xl">
        <form onSubmit={handleGenerate} className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
          {/* Company Selection */}
          <div className="space-y-1.5">
            <label className="text-[10px] text-slate-400 font-bold block">Empresa Piloto</label>
            {isLoadingCompanies ? (
              <div className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-400">
                Carregando empresas...
              </div>
            ) : (
              <select
                value={selectedCompanyId}
                onChange={(e) => setSelectedCompanyId(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 text-xs text-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:border-indigo-650 cursor-pointer"
              >
                {companies.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Date From */}
          <div className="space-y-1.5">
            <label className="text-[10px] text-slate-400 font-bold block">De</label>
            <div className="relative">
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 text-xs text-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:border-indigo-650"
              />
            </div>
          </div>

          {/* Date To */}
          <div className="space-y-1.5">
            <label className="text-[10px] text-slate-400 font-bold block">Até (Máx. 90 dias)</label>
            <div className="relative">
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 text-xs text-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:border-indigo-650"
              />
            </div>
          </div>

          {/* Generate Button */}
          <button
            type="submit"
            disabled={isGenerating || !selectedCompanyId}
            className="w-full py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-xs font-bold text-white rounded-lg transition-colors cursor-pointer shadow-md shadow-indigo-600/10 flex items-center justify-center gap-1.5"
          >
            <TrendingUp className="w-4 h-4" />
            {isGenerating ? 'Calculando dados...' : 'Gerar Relatório'}
          </button>
        </form>
      </div>

      {error && (
        <div className="flex items-center gap-2.5 p-4 rounded-lg bg-red-950/30 border border-red-800/30 text-red-400 text-xs font-semibold">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}

      {reportData && (
        <div className="space-y-6">
          {/* Summary metrics Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Health score */}
            <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl space-y-1.5 relative overflow-hidden">
              <span className="text-[10px] font-bold text-slate-400 block uppercase">Health Score Final</span>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-3xl font-extrabold text-white">{reportData.customerSuccess.healthScoreFinal}/100</span>
                <span
                  className={`text-[10px] font-bold flex items-center ${
                    reportData.customerSuccess.healthScoreEvolution >= 0 ? 'text-emerald-400' : 'text-rose-400'
                  }`}
                >
                  {reportData.customerSuccess.healthScoreEvolution >= 0 ? (
                    <TrendingUp className="w-3.5 h-3.5 mr-0.5" />
                  ) : (
                    <TrendingDown className="w-3.5 h-3.5 mr-0.5" />
                  )}
                  {reportData.customerSuccess.healthScoreEvolution >= 0 ? '+' : ''}
                  {reportData.customerSuccess.healthScoreEvolution}
                </span>
              </div>
              <span className="text-[10px] text-slate-500 block">Health Score Inicial: {reportData.customerSuccess.healthScoreInitial}</span>
            </div>

            {/* Check-in response rate */}
            <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl space-y-1.5">
              <span className="text-[10px] font-bold text-slate-400 block uppercase">Taxa de Resposta</span>
              <span className="text-3xl font-extrabold text-white mt-1 block">{reportData.adoptionMetrics.checkinResponseRate}%</span>
              <span className="text-[10px] text-slate-500 block">
                {reportData.adoptionMetrics.totalCheckinsResponded} de {reportData.adoptionMetrics.totalCheckinsSent} check-ins
              </span>
            </div>

            {/* Occurrences resolved */}
            <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl space-y-1.5">
              <span className="text-[10px] font-bold text-slate-400 block uppercase">Ocorrências Resolvidas</span>
              <span className="text-3xl font-extrabold text-white mt-1 block">
                {reportData.summary.occurrencesResolved} / {reportData.summary.occurrencesCreated}
              </span>
              <span className="text-[10px] text-slate-500 block">Restantes em aberto: {reportData.summary.openOccurrences}</span>
            </div>

            {/* Atestados */}
            <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl space-y-1.5">
              <span className="text-[10px] font-bold text-slate-400 block uppercase">Atestados Revisados</span>
              <span className="text-3xl font-extrabold text-white mt-1 block">
                {reportData.summary.certificatesReviewed} / {reportData.summary.certificatesUploaded}
              </span>
              <span className="text-[10px] text-slate-500 block">Relatórios gerados: {reportData.summary.reportsExported}</span>
            </div>
          </div>

          {/* Main Content: Markdown Preview & Telemetry */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Markdown Report Preview (Left/Middle) */}
            <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-xl flex flex-col">
              <div className="px-5 py-3.5 bg-slate-950/60 border-b border-slate-800 flex items-center justify-between">
                <span className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                  <FileCode className="w-4 h-4 text-indigo-400" />
                  Visualização do Relatório (Markdown)
                </span>
                <button
                  onClick={handleCopy}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-750 border border-slate-700 text-[10px] font-bold text-slate-200 rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  {copied ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                      Copiado!
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5 text-slate-400" />
                      Copiar Markdown
                    </>
                  )}
                </button>
              </div>

              {/* Text Area containing formatted markdown */}
              <textarea
                readOnly
                value={reportData.markdownReport}
                className="w-full flex-1 min-h-[450px] bg-slate-950 border-0 p-5 text-slate-300 font-mono text-xs focus:outline-none focus:ring-0 leading-relaxed resize-y"
              />
            </div>

            {/* Recommendations & CS Health signals (Right) */}
            <div className="space-y-6">
              {/* Recommendations Card */}
              <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl space-y-4">
                <h3 className="text-xs font-bold text-slate-100 flex items-center gap-2 uppercase tracking-wider">
                  <CheckSquare className="w-4 h-4 text-indigo-400" />
                  Próximos Passos
                </h3>
                <div className="space-y-3">
                  {reportData.recommendations.map((rec: string, idx: number) => (
                    <div key={idx} className="flex gap-2.5 text-xs text-slate-350 leading-relaxed">
                      <span className="w-5 h-5 rounded bg-slate-950 border border-slate-800 flex items-center justify-center text-[10px] text-slate-400 font-bold shrink-0">
                        {idx + 1}
                      </span>
                      <span>{rec}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Security info */}
              <div className="bg-slate-900/50 border border-slate-800 p-5 rounded-xl space-y-3">
                <h4 className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                  <ShieldCheck className="w-4.5 h-4.5 text-emerald-500" />
                  Controle de Privacidade
                </h4>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  O relatório gerado oculta dados cadastrais confidenciais (CPF, e-mails), diagnósticos médicos sensíveis e mensagens de texto brutas de comunicação.
                </p>
                <div className="text-[10px] text-indigo-400 font-semibold bg-indigo-950/20 border border-indigo-900/30 p-2 rounded-lg">
                  Perfil SUPER_ADMIN: Inclui visualização de notas comerciais da plataforma.
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
