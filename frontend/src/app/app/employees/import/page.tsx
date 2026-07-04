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
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // CSV parsing state
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [csvRows, setCsvRows] = useState<any[]>([]);

  // Mapping state
  const [mappings, setMappings] = useState({
    name: '',
    cpf: '',
    whatsapp: '',
    email: '',
    sector: '',
    workModel: '',
  });

  // Validation results
  const [validationResult, setValidationResult] = useState<any | null>(null);
  const [isImported, setIsImported] = useState(false);

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
          Seu perfil de usuário ({user.role}) não tem permissão para importar funcionários.
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
    setValidationResult(null);
    setIsImported(false);

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

    // Read and parse CSV headers & rows
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

          const parseLine = (line: string): string[] => {
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

          const headers = parseLine(lines[0]);
          const rows = lines.slice(1).map(line => {
            const values = parseLine(line);
            const rowObj: any = {};
            headers.forEach((h, i) => {
              rowObj[h] = values[i] || '';
            });
            return rowObj;
          });

          setCsvHeaders(headers);
          setCsvRows(rows);

          // Try automatic matching
          const findMatch = (key: string, list: string[]) => {
            const normalized = key.toLowerCase();
            return list.find(h => {
              const hl = h.toLowerCase();
              return hl === normalized || hl.includes(normalized) || normalized.includes(hl);
            }) || '';
          };

          setMappings({
            name: findMatch('nome', headers) || findMatch('name', headers) || headers[0] || '',
            cpf: findMatch('cpf', headers) || headers[1] || '',
            whatsapp: findMatch('whatsapp', headers) || findMatch('celular', headers) || headers[2] || '',
            email: findMatch('email', headers) || '',
            sector: findMatch('setor', headers) || findMatch('sector', headers) || '',
            workModel: findMatch('modelo', headers) || findMatch('workmodel', headers) || '',
          });
        }
      } catch (err) {
        setError('Erro ao processar estrutura do arquivo CSV.');
      }
    };
    reader.readAsText(selectedFile);
  };

  const handleValidateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    setLoading(true);
    setError(null);
    setValidationResult(null);

    try {
      const response = await api.post('/employees/batch-validate', {
        rows: csvRows,
        mappings,
      });

      if (response.success) {
        setValidationResult(response.data);
      } else {
        setError(response.error?.message || 'Falha ao validar os dados do lote.');
      }
    } catch (err) {
      setError('Erro de conexão ao validar o lote.');
    } finally {
      setLoading(false);
    }
  };

  const handleImportSubmit = async () => {
    if (loading) return;
    setLoading(true);
    setError(null);

    try {
      const response = await api.post('/employees/batch-import', {
        rows: csvRows,
        mappings,
      });

      if (response.success) {
        setIsImported(true);
        setValidationResult(null);
        setFile(null);
        setCsvRows([]);
      } else {
        setError(response.error?.message || 'Erro ao realizar importação.');
      }
    } catch (err) {
      setError('Erro de conexão ao processar importação.');
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
            Importador Inteligente
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            Cadastre funcionários mapeando as colunas de qualquer planilha CSV.
          </p>
        </div>
      </div>

      {isImported && (
        <div className="p-6 bg-emerald-950/20 border border-emerald-900/30 rounded-xl space-y-4 text-center">
          <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto" />
          <h2 className="text-xl font-bold text-white">Importação Concluída com Sucesso!</h2>
          <p className="text-sm text-slate-400 max-w-md mx-auto">
            Todos os colaboradores válidos foram criados em lote no banco de dados e adicionados ao painel.
          </p>
          <div className="flex justify-center gap-4 pt-2">
            <button
              onClick={() => setIsImported(false)}
              className="px-4 py-2 rounded-lg bg-slate-900 border border-slate-800 text-slate-350 hover:text-white transition-all text-xs cursor-pointer"
            >
              Importar Nova Planilha
            </button>
            <Link
              href="/app/employees"
              className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white transition-all text-xs font-semibold"
            >
              Ir para Lista de Funcionários
            </Link>
          </div>
        </div>
      )}

      {!isImported && (
        <>
          {/* Main Upload Area */}
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
            <div className="p-4 rounded-lg bg-red-950/20 border border-red-900/30 text-red-400 text-xs flex gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Mappings Form */}
          {file && !validationResult && (
            <form onSubmit={handleValidateSubmit} className="space-y-6 bg-slate-900 border border-slate-800 p-6 rounded-xl">
              <h3 className="font-bold text-white text-sm">Mapeamento de Colunas da Planilha</h3>
              <p className="text-xs text-slate-500">Mapeie as propriedades do banco de dados com os cabeçalhos detectados no seu CSV:</p>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Nome Completo *</label>
                  <select
                    value={mappings.name}
                    onChange={e => setMappings({ ...mappings, name: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white text-xs"
                  >
                    {csvHeaders.map((h, idx) => <option key={idx} value={h}>{h}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">CPF *</label>
                  <select
                    value={mappings.cpf}
                    onChange={e => setMappings({ ...mappings, cpf: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white text-xs"
                  >
                    {csvHeaders.map((h, idx) => <option key={idx} value={h}>{h}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">WhatsApp/Celular *</label>
                  <select
                    value={mappings.whatsapp}
                    onChange={e => setMappings({ ...mappings, whatsapp: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white text-xs"
                  >
                    {csvHeaders.map((h, idx) => <option key={idx} value={h}>{h}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">E-mail (Opcional)</label>
                  <select
                    value={mappings.email}
                    onChange={e => setMappings({ ...mappings, email: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white text-xs"
                  >
                    <option value="">-- Não importar --</option>
                    {csvHeaders.map((h, idx) => <option key={idx} value={h}>{h}</option>)}
                  </select>
                </div>
              </div>

              <div className="flex justify-end pt-4">
                <button
                  type="submit"
                  disabled={loading}
                  className="px-6 py-2.5 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white transition-all shadow-lg cursor-pointer"
                >
                  {loading ? 'Validando...' : 'Validar Planilha'}
                </button>
              </div>
            </form>
          )}

          {/* Validation Report */}
          {validationResult && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 text-center">
                  <div className="text-slate-500 text-[10px] uppercase font-bold">Total Encontrado</div>
                  <div className="text-3xl font-extrabold text-white mt-1">{validationResult.totalCount}</div>
                </div>
                <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 text-center">
                  <div className="text-slate-500 text-[10px] uppercase font-bold">Válidos para Criação</div>
                  <div className="text-3xl font-extrabold text-emerald-500 mt-1">{validationResult.validCount}</div>
                </div>
              </div>

              {validationResult.errors.length > 0 && (
                <div className="p-4 bg-slate-900 border border-red-900/30 rounded-xl space-y-2">
                  <h3 className="font-bold text-xs text-red-400 uppercase tracking-wider">Erros de Validação Encontrados</h3>
                  <div className="max-h-60 overflow-y-auto divide-y divide-slate-800/60 text-xs text-slate-350">
                    {validationResult.errors.map((e: any, idx: number) => (
                      <div key={idx} className="py-2 flex items-start gap-2">
                        <ChevronRight className="w-3.5 h-3.5 text-red-500 mt-0.5 shrink-0" />
                        <span>Linha {e.index + 2}: {e.message}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-4">
                <button
                  onClick={() => setValidationResult(null)}
                  className="px-4 py-2 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 text-xs cursor-pointer"
                >
                  Voltar e Ajustar Mapeamento
                </button>
                {validationResult.validCount > 0 && (
                  <button
                    onClick={handleImportSubmit}
                    disabled={loading}
                    className="px-6 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition-all shadow-lg cursor-pointer"
                  >
                    {loading ? 'Importando...' : `Confirmar Importação de ${validationResult.validCount} Colaboradores`}
                  </button>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
