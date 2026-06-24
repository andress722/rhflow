'use client';

import React, { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { getUser } from '@/lib/auth';
import {
  Upload,
  FileSpreadsheet,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  HelpCircle,
  ArrowLeft,
  ChevronRight,
  ShieldAlert,
} from 'lucide-react';
import Link from 'next/link';

export default function EmployeesImportPage() {
  const [user, setUser] = useState<any>(null);
  const [file, setFile] = useState<File | null>(null);
  const [previewRows, setPreviewRows] = useState<string[][]>([]);
  const [previewHeaders, setPreviewHeaders] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorRequestId, setErrorRequestId] = useState<string | null>(null);

  // Import results
  const [result, setResult] = useState<any | null>(null);
  const [importErrors, setImportErrors] = useState<any[]>([]);
  const [skipped, setSkipped] = useState<any[]>([]);

  useEffect(() => {
    setUser(getUser());
  }, []);

  if (!user) {
    return (
      <div className="py-12 flex justify-center">
        <div className="w-8 h-8 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  // Restrict: Only ADMIN and HR
  const isAllowed = ['ADMIN', 'HR'].includes(user.role);
  if (!isAllowed) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <div className="w-16 h-16 rounded-full bg-red-950/50 border border-red-800 flex items-center justify-center mb-6">
          <ShieldAlert className="w-8 h-8 text-red-400" />
        </div>
        <h2 className="text-2xl font-bold text-white mb-2">Acesso Negado</h2>
        <p className="text-slate-400 max-w-md text-sm leading-relaxed mb-6">
          Seu perfil de usuário ({user.role}) não tem permissão para importar funcionários. Apenas administradores e membros do RH podem realizar esta ação.
        </p>
        <Link
          href="/app/employees"
          className="px-4 py-2 text-sm font-medium rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white transition-all cursor-pointer"
        >
          Voltar para Funcionários
        </Link>
      </div>
    );
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    setError(null);
    setErrorRequestId(null);
    setResult(null);
    setImportErrors([]);
    setSkipped([]);
    setPreviewRows([]);
    setPreviewHeaders([]);

    if (!selectedFile) {
      setFile(null);
      return;
    }

    if (selectedFile.size > 2 * 1024 * 1024) {
      setError('O arquivo deve ter no máximo 2MB.');
      setFile(null);
      return;
    }

    if (!selectedFile.name.endsWith('.csv')) {
      setError('Por favor, selecione um arquivo CSV válido.');
      setFile(null);
      return;
    }

    setFile(selectedFile);

    // Read first few rows for client-side preview
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const lines = text.split(/\r?\n/).filter(l => l.trim().length > 0);
        if (lines.length > 0) {
          // Detect delimiter
          const commaCount = (lines[0].match(/,/g) || []).length;
          const semicolonCount = (lines[0].match(/;/g) || []).length;
          const delimiter = semicolonCount > commaCount ? ';' : ',';

          const parseLine = (line: string) => {
            const res: string[] = [];
            let curr = '';
            let inQuotes = false;
            for (let i = 0; i < line.length; i++) {
              const char = line[i];
              if (char === '"') inQuotes = !inQuotes;
              else if (char === delimiter && !inQuotes) {
                res.push(curr.replace(/^"|"$/g, '').trim());
                curr = '';
              } else curr += char;
            }
            res.push(curr.replace(/^"|"$/g, '').trim());
            return res;
          };

          const parsedHeaders = parseLine(lines[0]);
          const parsedRows = lines.slice(1, 6).map(line => parseLine(line));

          setPreviewHeaders(parsedHeaders);
          setPreviewRows(parsedRows);
        }
      } catch (err) {
        console.error('Erro ao ler prévia do CSV:', err);
      }
    };
    reader.readAsText(selectedFile);
  };

  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return;
    if (loading) return;

    setLoading(true);
    setError(null);
    setErrorRequestId(null);
    setResult(null);
    setImportErrors([]);
    setSkipped([]);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await api.upload('/employees/import', formData);
      if (response.success) {
        setResult(response.data);
        setSkipped(response.data.skipped || []);
        // Reset file input
        setFile(null);
        setPreviewRows([]);
        setPreviewHeaders([]);
      } else {
        // Validation errors returned inside response.error or response details
        if (response.error?.code === 'IMPORT_ERROR' || response.error?.details) {
          const details = response.error.details || response;
          setResult({ created: 0 });
          setImportErrors(details.errors || []);
          setSkipped(details.skipped || []);
        } else {
          setError(response.error?.message || 'Ocorreu um erro ao importar funcionários.');
          if (response.error?.requestId) {
            setErrorRequestId(response.error.requestId);
          }
        }
      }
    } catch (err: any) {
      setError('Erro de rede ao enviar arquivo.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link
          href="/app/employees"
          className="p-2 rounded-lg bg-slate-900 border border-slate-800 text-slate-400 hover:text-white transition-all cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight flex items-center gap-3">
            <FileSpreadsheet className="w-8 h-8 text-indigo-500" />
            Importar Funcionários
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            Cadastre funcionários em lote enviando uma planilha no formato CSV.
          </p>
        </div>
      </div>

      {/* CSV Guidelines Info */}
      <div className="p-5 bg-slate-900 border border-slate-800 rounded-xl space-y-3">
        <h3 className="font-bold text-white text-sm flex items-center gap-2">
          <HelpCircle className="w-4 h-4 text-indigo-400" />
          Instruções de Formatação do CSV
        </h3>
        <p className="text-xs text-slate-400 leading-relaxed">
          Seu arquivo CSV deve conter um cabeçalho exatamente com as colunas listadas abaixo. O delimitador pode ser vírgula (,) ou ponto e vírgula (;). O limite máximo de registros é de 500 linhas.
        </p>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 border-t border-slate-800/80 pt-3 text-[11px]">
          <div>
            <span className="font-bold text-slate-200 font-mono block">name</span>
            <span className="text-slate-500">Nome completo (Obrigatório)</span>
          </div>
          <div>
            <span className="font-bold text-slate-200 font-mono block">cpf</span>
            <span className="text-slate-500">Apenas números (Obrigatório, único)</span>
          </div>
          <div>
            <span className="font-bold text-slate-200 font-mono block">whatsapp</span>
            <span className="text-slate-500">Com DDD (Obrigatório)</span>
          </div>
          <div>
            <span className="font-bold text-slate-200 font-mono block">email</span>
            <span className="text-slate-500">Formato válido (Opcional)</span>
          </div>
          <div className="mt-2">
            <span className="font-bold text-slate-200 font-mono block">sector</span>
            <span className="text-slate-500">Departamento/Setor (Opcional)</span>
          </div>
          <div className="mt-2">
            <span className="font-bold text-slate-200 font-mono block">workModel</span>
            <span className="text-slate-500">PRESENTIAL, REMOTE ou HYBRID</span>
          </div>
          <div className="mt-2">
            <span className="font-bold text-slate-200 font-mono block">managerEmail</span>
            <span className="text-slate-500">E-mail do gestor MANAGER (Opcional)</span>
          </div>
          <div className="mt-2">
            <span className="font-bold text-slate-200 font-mono block">workScheduleName</span>
            <span className="text-slate-500">Nome exato da escala ativa (Opcional)</span>
          </div>
        </div>
      </div>

      {/* Main Upload Area */}
      {!result && importErrors.length === 0 && (
        <form onSubmit={handleUploadSubmit} className="space-y-6">
          <div className="p-8 rounded-xl border border-dashed border-slate-800 bg-slate-900/30 hover:bg-slate-900/50 transition-all flex flex-col items-center justify-center text-center gap-4 relative">
            <input
              type="file"
              accept=".csv"
              onChange={handleFileChange}
              className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
            />
            <div className="p-4 rounded-full bg-slate-950 border border-slate-800 text-slate-400">
              <Upload className="w-8 h-8 text-indigo-500" />
            </div>
            <div>
              <p className="text-slate-200 font-semibold text-sm">
                {file ? file.name : 'Selecione ou arraste seu arquivo CSV'}
              </p>
              <p className="text-slate-500 text-xs mt-1">
                Tamanho máximo de 2MB. Apenas extensões .csv.
              </p>
            </div>
          </div>

          {error && (
            <div className="flex flex-col gap-1 p-4 rounded-lg bg-red-950/20 border border-red-900/30 text-red-400 text-xs">
              <div className="flex gap-2 items-start">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
              {errorRequestId && (
                <span className="text-[10px] text-slate-500 font-mono mt-1 pl-6 block">
                  ID da Requisição: {errorRequestId}
                </span>
              )}
            </div>
          )}

          {/* Local CSV Preview */}
          {previewRows.length > 0 && (
            <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden space-y-2 p-4">
              <h3 className="font-bold text-xs text-indigo-400 uppercase tracking-wider">Prévia das 5 Primeiras Linhas</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-slate-800 text-slate-400 font-semibold">
                      {previewHeaders.map((h, i) => (
                        <th key={i} className="px-4 py-2 font-mono">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800 text-slate-300">
                    {previewRows.map((row, rowIdx) => (
                      <tr key={rowIdx}>
                        {row.map((cell, cellIdx) => (
                          <td key={cellIdx} className="px-4 py-2 truncate max-w-xs">{cell}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {file && (
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={loading}
                className="px-6 py-2.5 rounded-lg text-sm font-semibold bg-indigo-600 hover:bg-indigo-500 text-white transition-all shadow-lg shadow-indigo-600/10 cursor-pointer disabled:opacity-50"
              >
                {loading ? 'Processando e Validando...' : 'Iniciar Importação'}
              </button>
            </div>
          )}
        </form>
      )}

      {/* Reports Display Section */}
      {(result || importErrors.length > 0) && (
        <div className="space-y-6">
          {/* Status Title Banner */}
          {importErrors.length > 0 ? (
            <div className="p-5 rounded-xl bg-red-950/20 border border-red-900/30 flex items-start gap-4">
              <XCircle className="w-8 h-8 text-red-500 shrink-0 mt-0.5" />
              <div>
                <h2 className="text-lg font-bold text-white">Falha Crítica na Validação!</h2>
                <p className="text-slate-400 text-xs mt-1">
                  Nenhum funcionário foi importado para garantir a integridade dos dados (Transação desfeita). Corrija as inconsistências listadas abaixo e tente novamente.
                </p>
              </div>
            </div>
          ) : (
            <div className="p-5 rounded-xl bg-emerald-950/20 border border-emerald-900/30 flex items-start gap-4">
              <CheckCircle2 className="w-8 h-8 text-emerald-500 shrink-0 mt-0.5" />
              <div>
                <h2 className="text-lg font-bold text-white">Importação Finalizada!</h2>
                <p className="text-slate-400 text-xs mt-1">
                  Planilha processada com sucesso. Veja abaixo os contadores operacionais de importação.
                </p>
              </div>
            </div>
          )}

          {/* Counts Indicators */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 text-center">
              <div className="text-slate-500 text-xs font-semibold">Novos Criados</div>
              <div className="text-3xl font-extrabold text-white mt-1">
                {result?.created || 0}
              </div>
            </div>
            <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 text-center">
              <div className="text-slate-500 text-xs font-semibold">Ignorados (CPF Duplicado na Empresa)</div>
              <div className="text-3xl font-extrabold text-indigo-400 mt-1">
                {skipped.length}
              </div>
            </div>
            <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 text-center">
              <div className="text-slate-500 text-xs font-semibold">Erros Críticos de Validação</div>
              <div className={`text-3xl font-extrabold mt-1 ${importErrors.length > 0 ? 'text-red-400' : 'text-slate-500'}`}>
                {importErrors.length}
              </div>
            </div>
          </div>

          {/* Skipped Rows Details */}
          {skipped.length > 0 && (
            <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden p-4 space-y-2">
              <h3 className="font-bold text-xs text-indigo-400 uppercase tracking-wider">Inconsistências Ignoradas (Skipped)</h3>
              <div className="max-h-40 overflow-y-auto divide-y divide-slate-800/60 text-xs text-slate-300">
                {skipped.map((s, idx) => (
                  <div key={idx} className="py-2 flex justify-between gap-4">
                    <span>
                      Linha {s.line}: <strong className="text-white">{s.name}</strong> (CPF: {s.cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4')})
                    </span>
                    <span className="text-indigo-400">{s.reason}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Errors List Details */}
          {importErrors.length > 0 && (
            <div className="bg-slate-900 border border-red-900/30 rounded-xl overflow-hidden p-4 space-y-2">
              <h3 className="font-bold text-xs text-red-400 uppercase tracking-wider">Erros Críticos na Planilha</h3>
              <div className="max-h-60 overflow-y-auto divide-y divide-slate-800/60 text-xs text-slate-300">
                {importErrors.map((e, idx) => (
                  <div key={idx} className="py-2.5 flex items-start gap-3">
                    <ChevronRight className="w-3.5 h-3.5 text-red-500 shrink-0 mt-0.5" />
                    <span>
                      {e.line > 0 ? (
                        <>
                          Linha <strong className="text-red-400 font-mono">{e.line}</strong>: {e.message}
                        </>
                      ) : (
                        e.message
                      )}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex gap-4">
            <button
              onClick={() => {
                setResult(null);
                setImportErrors([]);
                setSkipped([]);
              }}
              className="px-4 py-2 rounded-lg bg-slate-900 border border-slate-800 hover:bg-slate-800 text-slate-300 text-sm font-semibold transition-all cursor-pointer"
            >
              Importar Outro Arquivo
            </button>
            <Link
              href="/app/employees"
              className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold transition-all cursor-pointer"
            >
              Ir para Lista de Funcionários
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
