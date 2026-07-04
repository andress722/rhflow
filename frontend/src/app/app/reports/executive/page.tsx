'use client';

import React, { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { getUser } from '@/lib/auth';
import {
  FileText,
  Calendar,
  Copy,
  Check,
  TrendingUp,
  AlertCircle,
  TrendingDown,
  CheckSquare,
  FileCode,
  ShieldAlert,
  Printer,
} from 'lucide-react';

export default function CorporateExecutiveReportPage() {
  const [currentUser, setCurrentUser] = useState<any>(null);
  
  // Date states (default to last 30 days)
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [reportData, setReportData] = useState<any>(null);
  
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const loggedUser = getUser();
    setCurrentUser(loggedUser);
    setIsLoading(false);

    // Set default dates
    const today = new Date();
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(today.getDate() - 30);

    setDateTo(today.toISOString().split('T')[0]);
    setDateFrom(thirtyDaysAgo.toISOString().split('T')[0]);
  }, []);

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!dateFrom || !dateTo) return;

    setIsGenerating(true);
    setError('');
    setReportData(null);
    setCopied(false);

    try {
      const url = `/executive-reports/my-company?dateFrom=${dateFrom}&dateTo=${dateTo}`;
      const res: any = await api.get(url);
      if (res.success && res.data) {
        setReportData(res.data);
      } else {
        setError(res.error?.message || 'Erro ao gerar relatório executivo corporativo.');
      }
    } catch (err) {
      setError('Erro de conexão com o servidor.');
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

  if (isLoading) {
    return (
      <div className="py-20 flex flex-col items-center gap-3">
        <div className="w-8 h-8 border-4 border-indigo-650 border-t-transparent rounded-full animate-spin"></div>
        <span className="text-xs text-slate-400 font-semibold">Verificando permissões...</span>
      </div>
    );
  }

  // Role check
  if (!currentUser || !['ADMIN', 'HR'].includes(currentUser.role)) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="w-16 h-16 rounded-full bg-red-950/50 border border-red-800 flex items-center justify-center mb-6">
          <ShieldAlert className="w-8 h-8 text-red-400" />
        </div>
        <h2 className="text-2xl font-bold text-white mb-2">Acesso Negado</h2>
        <p className="text-slate-400 max-w-md text-sm leading-relaxed">
          O relatório de valor executivo e o consolidado de adoção só estão acessíveis para gestores de nível Administrador (ADMIN) e Recursos Humanos (HR).
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 print-container">
      {/* Print Style */}
      <style dangerouslySetInnerHTML={{__html: `
        @media print {
          aside, nav, header, button, .no-print, form {
            display: none !important;
          }
          body, html, main, #root, .print-container {
            background: white !important;
            color: #0f172a !important;
            margin: 0 !important;
            padding: 0 !important;
          }
          .print-card {
            background: #f8fafc !important;
            color: #0f172a !important;
            border: 1px solid #e2e8f0 !important;
          }
          textarea {
            border: none !important;
            background: transparent !important;
            color: #0f172a !important;
            height: auto !important;
            min-height: 800px !important;
            resize: none !important;
            font-family: inherit !important;
            font-size: 11pt !important;
            line-height: 1.6 !important;
          }
          .page-break {
            page-break-after: always !important;
          }
        }
      `}} />

      {/* Printable Cover Page */}
      <div className="hidden print:flex flex-col justify-between h-[280mm] p-16 text-slate-900 bg-white page-break">
        <div className="space-y-4">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">PresençaFlow Corporate Analytics</p>
          <div className="h-1 w-16 bg-indigo-650"></div>
        </div>

        <div className="space-y-6 my-auto">
          <h1 className="text-4xl font-extrabold tracking-tight text-slate-950 uppercase">
            Relatório Executivo de Valor
          </h1>
          <p className="text-sm text-slate-500 max-w-lg leading-relaxed">
            Consolidado estratégico de conformidade, adoção de jornada, homologações de atestados e análise preditiva de turnover.
          </p>
          <div className="grid grid-cols-2 gap-4 pt-8 text-xs border-t border-slate-200">
            <div>
              <p className="font-bold text-slate-400 uppercase">Referência</p>
              <p className="font-semibold text-slate-800">{dateFrom} a {dateTo}</p>
            </div>
            <div>
              <p className="font-bold text-slate-400 uppercase">Gerado por</p>
              <p className="font-semibold text-slate-800">{currentUser?.name || 'Administrador'}</p>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between text-[10px] text-slate-400 border-t border-slate-100 pt-6">
          <span>PresençaFlow © {new Date().getFullYear()}</span>
          <span>Confidencial • Uso Interno</span>
        </div>
      </div>

      {/* Header */}
      <div className="no-print">
        <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
          <FileText className="w-6 h-6 text-indigo-500" />
          Relatório Executivo de Valor
        </h1>
        <p className="text-sm text-slate-400 mt-1">
          Consolide a evolução de seu Health Score, engajamento e métricas operacionais para reuniões corporativas.
        </p>
      </div>

      {/* Controls Form */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-xl no-print">
        <form onSubmit={handleGenerate} className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
          {/* Date From */}
          <div className="space-y-1.5">
            <label className="text-[10px] text-slate-400 font-bold block">Data Inicial</label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 text-xs text-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:border-indigo-650"
            />
          </div>

          {/* Date To */}
          <div className="space-y-1.5">
            <label className="text-[10px] text-slate-400 font-bold block">Data Final (Máx. 90 dias)</label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 text-xs text-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:border-indigo-650"
            />
          </div>

          {/* Generate Button */}
          <button
            type="submit"
            disabled={isGenerating}
            className="w-full py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-xs font-bold text-white rounded-lg transition-colors cursor-pointer shadow-md shadow-indigo-600/10 flex items-center justify-center gap-1.5"
          >
            <TrendingUp className="w-4 h-4" />
            {isGenerating ? 'Processando...' : 'Gerar Relatório'}
          </button>
        </form>
      </div>

      {error && (
        <div className="flex items-center gap-2.5 p-4 rounded-lg bg-red-950/30 border border-red-800/30 text-red-400 text-xs font-semibold no-print">
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
              <span className="text-[10px] text-slate-500 block">Em aberto: {reportData.summary.openOccurrences}</span>
            </div>

            {/* Atestados */}
            <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl space-y-1.5">
              <span className="text-[10px] font-bold text-slate-400 block uppercase">Atestados Revisados</span>
              <span className="text-3xl font-extrabold text-white mt-1 block">
                {reportData.summary.certificatesReviewed} / {reportData.summary.certificatesUploaded}
              </span>
              <span className="text-[10px] text-slate-500 block">Exportações efetuadas: {reportData.summary.reportsExported}</span>
            </div>
          </div>

          {/* Report Display */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Markdown Preview */}
            <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-xl flex flex-col">
              <div className="px-5 py-3.5 bg-slate-950/60 border-b border-slate-800 flex items-center justify-between no-print">
                <span className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                  <FileCode className="w-4 h-4 text-indigo-400" />
                  Visualização do Relatório (Markdown Seguro)
                </span>
                <div className="flex items-center gap-2">
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
                        Copiar Relatório
                      </>
                    )}
                  </button>
                  <button
                    onClick={() => window.print()}
                    className="px-3 py-1.5 bg-slate-800 hover:bg-slate-750 border border-slate-700 text-[10px] font-bold text-slate-200 rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <Printer className="w-3.5 h-3.5 text-indigo-400" />
                    Imprimir / PDF
                  </button>
                </div>
              </div>

              <textarea
                readOnly
                value={reportData.markdownReport}
                className="w-full flex-1 min-h-[450px] bg-slate-950 border-0 p-5 text-slate-300 font-mono text-xs focus:outline-none focus:ring-0 leading-relaxed resize-y"
              />
            </div>

            {/* Recommendations */}
            <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl space-y-4 h-fit no-print">
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
          </div>

          {/* Printable Signature Page */}
          <div className="hidden print:block mt-16 pt-16 border-t border-slate-200 page-break">
            <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider mb-8">Folha de Aprovação e Fechamento</h3>
            <div className="grid grid-cols-2 gap-12 text-xs pt-12">
              <div className="border-t border-slate-400 pt-3 text-center">
                <p className="font-semibold text-slate-800">Responsável Recursos Humanos (HR)</p>
                <p className="text-[10px] text-slate-500 mt-1">Data: ____/____/________</p>
              </div>
              <div className="border-t border-slate-400 pt-3 text-center">
                <p className="font-semibold text-slate-800">Diretoria Executiva</p>
                <p className="text-[10px] text-slate-500 mt-1">Data: ____/____/________</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
