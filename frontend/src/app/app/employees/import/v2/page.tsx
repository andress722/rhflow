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
  ArrowLeft,
  ChevronRight,
  ShieldAlert,
  Download,
  RefreshCw,
  Play,
  FileText,
  Layers,
  Settings,
  ListFilter,
  Check,
} from 'lucide-react';
import Link from 'next/link';

export default function EmployeesImportV2Page() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Flow State
  // 1: Upload, 2: Worksheet, 3: Preview, 4: Mapping, 5: Validation, 6: Summary, 7: Progress, 8: Result
  const [step, setStep] = useState<number>(1);
  const [jobId, setJobId] = useState<string | null>(null);

  // File Upload State
  const [file, setFile] = useState<File | null>(null);
  const [availableWorksheets, setAvailableWorksheets] = useState<string[]>([]);
  const [selectedWorksheet, setSelectedWorksheet] = useState<string>('');

  // Preview State
  const [previewHeaders, setPreviewHeaders] = useState<string[]>([]);
  const [previewRows, setPreviewRows] = useState<any[]>([]);
  const [totalRows, setTotalRows] = useState<number>(0);

  // Mapping State
  const [mappings, setMappings] = useState<Record<string, string>>({
    name: '',
    cpf: '',
    whatsapp: '',
    email: '',
    sector: '',
    jobTitle: '',
    registrationNumber: '',
    workModel: '',
    managerUserId: '',
    workScheduleId: '',
  });

  // Validation State
  const [validationSummary, setValidationSummary] = useState<any>(null);
  const [validationIssues, setValidationIssues] = useState<any[]>([]);

  // Confirmation/Mode State
  const [importMode, setImportMode] = useState<'CREATE_ONLY' | 'UPDATE_EXISTING' | 'UPSERT'>('CREATE_ONLY');

  // Real-time Progress State
  const [progress, setProgress] = useState<any>(null);

  // Saved Templates list
  const [templates, setTemplates] = useState<any[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  const [saveTemplateName, setSaveTemplateName] = useState<string>('');
  const [isSavingTemplate, setIsSavingTemplate] = useState<boolean>(false);

  useEffect(() => {
    setUser(getUser());
    loadTemplates();
  }, []);

  // Poll progress state
  useEffect(() => {
    let intervalId: any;
    if (step === 7 && jobId) {
      const fetchProgress = async () => {
        try {
          const res = await api.get(`/import-jobs/${jobId}/progress`);
          if (res.success) {
            setProgress(res.data);
            if (res.data.status === 'COMPLETED' || res.data.status === 'PARTIAL' || res.data.status === 'FAILED') {
              clearInterval(intervalId);
              setStep(8);
            }
          }
        } catch (err) {
          console.error('Erro ao buscar progresso:', err);
        }
      };

      fetchProgress();
      intervalId = setInterval(fetchProgress, 2000);
    }
    return () => clearInterval(intervalId);
  }, [step, jobId]);

  const loadTemplates = async () => {
    try {
      const res = await api.get('/import-mapping-templates');
      if (res.success) {
        setTemplates(res.data);
      }
    } catch (_) {}
  };

  if (!user) {
    return (
      <div className="py-12 flex justify-center">
        <div className="w-8 h-8 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  // Access checks
  const isAllowed = ['ADMIN', 'HR'].includes(user.role);
  if (!isAllowed) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <div className="w-16 h-16 rounded-full bg-red-950/50 border border-red-800 flex items-center justify-center mb-6">
          <ShieldAlert className="w-8 h-8 text-red-400" />
        </div>
        <h2 className="text-2xl font-bold text-white mb-2">Acesso Negado</h2>
        <p className="text-slate-400 max-w-md text-sm leading-relaxed mb-6">
          Sua conta não possui permissão administrativa (ADMIN/HR) para importar colaboradores.
        </p>
        <Link
          href="/app/employees"
          className="px-4 py-2 text-sm font-medium rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white transition-all"
        >
          Voltar para Funcionários
        </Link>
      </div>
    );
  }

  // Step 1: Upload file
  const handleFileUpload = async (uploadedFile: File, worksheetName: string = '') => {
    setLoading(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append('file', uploadedFile);

      const queryParams = worksheetName ? `?sheetName=${encodeURIComponent(worksheetName)}` : '';
      const response = await fetch(`/api/import-jobs/upload${queryParams}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
        body: formData,
      });

      const res = await response.json();

      if (!response.ok || !res.success) {
        throw new Error(res.error?.message || 'Falha ao processar arquivo.');
      }

      setJobId(res.data.jobId);
      setFile(uploadedFile);
      setPreviewHeaders(res.data.preview.headers);
      setPreviewRows(res.data.preview.previewRows || res.data.preview.rows || []);
      setTotalRows(res.data.totalRows);
      setAvailableWorksheets(res.data.availableWorksheets || []);
      setSelectedWorksheet(res.data.selectedWorksheet || '');

      // Trigger automap suggestion from server
      await fetchAutoMapSuggestion(res.data.jobId, res.data.preview.headers);

      if (res.data.fileType === 'XLSX' && res.data.availableWorksheets?.length > 1 && !worksheetName) {
        setStep(2); // Go to worksheet selection
      } else {
        setStep(3); // Go to preview
      }
    } catch (err: any) {
      setError(err.message || 'Ocorreu um erro no upload do arquivo.');
    } finally {
      setLoading(false);
    }
  };

  const fetchAutoMapSuggestion = async (targetJobId: string, headers: string[]) => {
    try {
      const res = await api.post(`/import-jobs/${targetJobId}/auto-map`);
      if (res.success) {
        // Build mappings state based on response
        const autoMappings: any = {};
        Object.keys(mappings).forEach(key => {
          autoMappings[key] = res.data.suggestion[key] || '';
        });
        setMappings(autoMappings);
      }
    } catch (_) {}
  };

  // Step 2: Change worksheet
  const handleWorksheetChange = (sheetName: string) => {
    if (file) {
      handleFileUpload(file, sheetName);
    }
  };

  // Step 4: Apply Mapping Template
  const handleApplyTemplate = (templateId: string) => {
    const template = templates.find(t => t.id === templateId);
    if (template) {
      const newMappings = { ...mappings };
      Object.keys(newMappings).forEach(key => {
        newMappings[key] = template.mappings[key] || '';
      });
      setMappings(newMappings);
      setSelectedTemplateId(templateId);
    }
  };

  // Step 4: Save Mapping Template
  const handleSaveTemplate = async () => {
    if (!saveTemplateName.trim()) return;
    setIsSavingTemplate(true);
    try {
      const res = await api.post('/import-mapping-templates', {
        name: saveTemplateName,
        sourceType: file?.name.endsWith('.csv') ? 'CSV' : 'XLSX',
        mappings,
      });
      if (res.success) {
        setSaveTemplateName('');
        await loadTemplates();
      } else {
        alert(res.error?.message || 'Erro ao salvar template.');
      }
    } catch (_) {
      alert('Erro de conexão ao salvar template.');
    } finally {
      setIsSavingTemplate(false);
    }
  };

  // Step 4: Submit mappings for validation
  const handleValidateMappings = async () => {
    if (!jobId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await api.put(`/import-jobs/${jobId}/mapping`, {
        mappings,
        mappingTemplateId: selectedTemplateId || null,
      });

      if (res.success) {
        setValidationSummary(res.data);
        setValidationIssues(res.data.issues || []);
        setStep(5); // Go to validation summary
      } else {
        setError(res.error?.message || 'Falha ao validar colunas.');
      }
    } catch (err: any) {
      setError(err.message || 'Erro de conexão.');
    } finally {
      setLoading(false);
    }
  };

  // Step 6: Confirm and queue import
  const handleConfirmImport = async () => {
    if (!jobId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await api.post(`/import-jobs/${jobId}/confirm`, {
        mode: importMode,
      });

      if (res.success) {
        setProgress(res.data);
        setStep(7); // Go to polling progress bar
      } else {
        setError(res.error?.message || 'Erro ao iniciar importação.');
      }
    } catch (err: any) {
      setError(err.message || 'Erro de conexão ao processar confirmação.');
    } finally {
      setLoading(false);
    }
  };

  // Step 7: Cancel Job
  const handleCancelJob = async () => {
    if (!jobId) return;
    try {
      await api.post(`/import-jobs/${jobId}/cancel`);
      setStep(1);
      setFile(null);
      setJobId(null);
      setValidationSummary(null);
    } catch (_) {}
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      {/* Header and Step Indicator */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-slate-900 pb-4">
        <div className="flex items-center gap-3">
          <Link
            href="/app/employees"
            className="p-2 rounded-lg bg-slate-950 border border-slate-900 text-slate-400 hover:text-white transition-all"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <h1 className="text-2xl font-extrabold text-white flex items-center gap-2">
              <FileSpreadsheet className="w-7 h-7 text-indigo-500" />
              Importador Corporativo V2
            </h1>
            <p className="text-slate-400 text-xs mt-0.5">
              Importação escalável de colaboradores com suporte nativo a XLSX, CSV, mapeamento flexível e fila assíncrona.
            </p>
          </div>
        </div>

        {/* Wizard Steps indicator */}
        <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400">
          <span className={`px-2 py-0.5 rounded ${step === 1 ? 'bg-indigo-600 text-white' : 'bg-slate-900'}`}>1. Envio</span>
          <ChevronRight className="w-3 h-3 text-slate-600" />
          {availableWorksheets.length > 1 && (
            <>
              <span className={`px-2 py-0.5 rounded ${step === 2 ? 'bg-indigo-600 text-white' : 'bg-slate-900'}`}>2. Planilha</span>
              <ChevronRight className="w-3 h-3 text-slate-600" />
            </>
          )}
          <span className={`px-2 py-0.5 rounded ${step === 3 ? 'bg-indigo-600 text-white' : 'bg-slate-900'}`}>3. Visualização</span>
          <ChevronRight className="w-3 h-3 text-slate-600" />
          <span className={`px-2 py-0.5 rounded ${step === 4 ? 'bg-indigo-600 text-white' : 'bg-slate-900'}`}>4. Mapeamento</span>
          <ChevronRight className="w-3 h-3 text-slate-600" />
          <span className={`px-2 py-0.5 rounded ${step === 5 || step === 6 ? 'bg-indigo-600 text-white' : 'bg-slate-900'}`}>5. Validação</span>
          <ChevronRight className="w-3 h-3 text-slate-600" />
          <span className={`px-2 py-0.5 rounded ${step === 7 ? 'bg-indigo-600 text-white' : 'bg-slate-900'}`}>6. Fila</span>
          <ChevronRight className="w-3 h-3 text-slate-600" />
          <span className={`px-2 py-0.5 rounded ${step === 8 ? 'bg-indigo-600 text-white' : 'bg-slate-900'}`}>7. Resultado</span>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-lg bg-red-950/20 border border-red-900/30 text-red-400 text-xs flex gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {/* STEP 1: UPLOAD AREA */}
      {step === 1 && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4">
            <div className="p-12 rounded-xl border border-dashed border-slate-800 bg-slate-900/10 hover:bg-slate-900/20 transition-all flex flex-col items-center justify-center text-center gap-4 relative">
              <input
                type="file"
                accept=".csv, .xlsx"
                disabled={loading}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleFileUpload(f);
                }}
                className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
              />
              <div className="p-4 rounded-full bg-slate-950 border border-slate-900 text-indigo-500">
                {loading ? (
                  <RefreshCw className="w-8 h-8 animate-spin" />
                ) : (
                  <Upload className="w-8 h-8" />
                )}
              </div>
              <div>
                <p className="text-slate-200 font-semibold text-sm">
                  {loading ? 'Processando estrutura...' : 'Selecione ou arraste seu arquivo CSV ou XLSX'}
                </p>
                <p className="text-slate-500 text-xs mt-1">
                  Formatos válidos: .csv (máx 2MB) e .xlsx (máx 10MB). Limite de 5.000 linhas.
                </p>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-slate-950 border border-slate-900 text-slate-400 text-xs space-y-2">
              <h3 className="font-bold text-white uppercase text-[10px] tracking-wider">Instruções Importantes</h3>
              <ul className="list-disc pl-4 space-y-1">
                <li>O arquivo deve conter cabeçalho na primeira linha.</li>
                <li>CPFs serão validados pelo dígito verificador real; CPFs inválidos ou repetidos serão marcados como erro.</li>
                <li>O limite do seu plano de ativos será verificado durante a criação.</li>
              </ul>
            </div>
          </div>

          {/* Templates mapping side info */}
          <div className="space-y-4">
            <div className="p-6 bg-slate-950 border border-slate-900 rounded-xl space-y-3">
              <h3 className="font-bold text-white text-xs flex items-center gap-1.5">
                <Layers className="w-4 h-4 text-indigo-500" />
                Modelos Salvos
              </h3>
              <p className="text-[11px] text-slate-500 leading-relaxed">
                Você pode criar modelos de mapeamento reutilizáveis para planilhas geradas periodicamente por sistemas ERP como TOTVS, Senior, ADP ou SAP.
              </p>
              {templates.length === 0 ? (
                <div className="text-[11px] text-slate-600 bg-slate-900/40 p-3 rounded-lg text-center">
                  Nenhum modelo cadastrado ainda.
                </div>
              ) : (
                <div className="space-y-2">
                  {templates.map((t) => (
                    <div key={t.id} className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 text-[11px] flex justify-between items-center text-slate-300">
                      <span>{t.name}</span>
                      <span className="text-[9px] uppercase px-1.5 py-0.5 rounded bg-slate-950 text-indigo-400 font-bold border border-slate-800">
                        {t.sourceType}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* STEP 2: WORKSHEET SELECTION (XLSX ONLY) */}
      {step === 2 && (
        <div className="p-8 bg-slate-950 border border-slate-900 rounded-xl max-w-md mx-auto text-center space-y-4">
          <Layers className="w-12 h-12 text-indigo-500 mx-auto" />
          <div>
            <h2 className="text-lg font-bold text-white">Múltiplas abas encontradas</h2>
            <p className="text-xs text-slate-400 mt-1">
              Este arquivo Excel contém mais de uma planilha. Selecione qual deseja carregar para importação:
            </p>
          </div>

          <div className="space-y-2 py-3">
            {availableWorksheets.map((sheet) => (
              <button
                key={sheet}
                onClick={() => handleWorksheetChange(sheet)}
                className={`w-full p-3 rounded-lg text-xs font-semibold flex justify-between items-center border transition-all cursor-pointer ${
                  selectedWorksheet === sheet
                    ? 'bg-indigo-600/10 border-indigo-500 text-white'
                    : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white hover:border-slate-700'
                }`}
              >
                <span>{sheet}</span>
                {selectedWorksheet === sheet && <Check className="w-4 h-4 text-indigo-400" />}
              </button>
            ))}
          </div>

          <div className="flex gap-3 justify-center pt-2">
            <button
              onClick={() => setStep(1)}
              className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white"
            >
              Fazer outro upload
            </button>
            <button
              onClick={() => setStep(3)}
              className="px-5 py-2.5 text-xs font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-500"
            >
              Avançar com a selecionada
            </button>
          </div>
        </div>
      )}

      {/* STEP 3: PREVIEW DATA */}
      {step === 3 && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="font-bold text-white text-sm">Visualização Estrutural (Primeiras 10 linhas)</h3>
            <span className="text-[11px] font-bold text-slate-500 bg-slate-900 px-3 py-1 rounded-full border border-slate-800">
              Total de Linhas no arquivo: <strong className="text-white">{totalRows}</strong>
            </span>
          </div>

          <div className="border border-slate-900 rounded-xl overflow-hidden bg-slate-950">
            <div className="overflow-x-auto max-h-96">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-900 text-slate-400 font-bold border-b border-slate-800">
                    <th className="p-3 text-center border-r border-slate-800 shrink-0 w-12 bg-slate-900 sticky left-0">Linha</th>
                    {previewHeaders.map((header) => (
                      <th key={header} className="p-3 whitespace-nowrap">{header}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-900 text-slate-300">
                  {previewRows.map((row, rIdx) => (
                    <tr key={rIdx} className="hover:bg-slate-900/30">
                      <td className="p-3 text-center border-r border-slate-800 bg-slate-900/20 font-bold text-slate-500 sticky left-0">{row.__rowNum || (rIdx + 2)}</td>
                      {previewHeaders.map((header) => (
                        <td key={header} className="p-3 whitespace-nowrap">{row[header] || <span className="text-slate-700 italic">vazio</span>}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              onClick={() => {
                setStep(1);
                setFile(null);
              }}
              className="px-4 py-2 rounded-lg bg-slate-950 border border-slate-900 text-slate-400 text-xs hover:text-white"
            >
              Fazer outro upload
            </button>
            <button
              onClick={() => setStep(4)}
              className="px-5 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition-all shadow-lg"
            >
              Ir para Mapeamento de Colunas
            </button>
          </div>
        </div>
      )}

      {/* STEP 4: MAPPING SETUP */}
      {step === 4 && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6 bg-slate-950 border border-slate-900 p-6 rounded-xl">
              <div>
                <h3 className="font-bold text-white text-sm">Mapeamento de Propriedades</h3>
                <p className="text-[11px] text-slate-500 mt-1">
                  Mapeie as propriedades do banco de dados com as colunas detectadas na planilha enviada.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* 1. Name */}
                <div>
                  <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Nome Completo *</label>
                  <select
                    value={mappings.name}
                    onChange={(e) => setMappings({ ...mappings, name: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-white text-xs focus:ring-1 focus:ring-indigo-500 outline-none"
                  >
                    <option value="">-- Selecione a coluna --</option>
                    {previewHeaders.map((h) => <option key={h} value={h}>{h}</option>)}
                  </select>
                </div>

                {/* 2. CPF */}
                <div>
                  <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">CPF *</label>
                  <select
                    value={mappings.cpf}
                    onChange={(e) => setMappings({ ...mappings, cpf: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-white text-xs focus:ring-1 focus:ring-indigo-500 outline-none"
                  >
                    <option value="">-- Selecione a coluna --</option>
                    {previewHeaders.map((h) => <option key={h} value={h}>{h}</option>)}
                  </select>
                </div>

                {/* 3. Whatsapp */}
                <div>
                  <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">WhatsApp / Celular *</label>
                  <select
                    value={mappings.whatsapp}
                    onChange={(e) => setMappings({ ...mappings, whatsapp: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-white text-xs focus:ring-1 focus:ring-indigo-500 outline-none"
                  >
                    <option value="">-- Selecione a coluna --</option>
                    {previewHeaders.map((h) => <option key={h} value={h}>{h}</option>)}
                  </select>
                </div>

                {/* 4. Email */}
                <div>
                  <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">E-mail (Opcional)</label>
                  <select
                    value={mappings.email}
                    onChange={(e) => setMappings({ ...mappings, email: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-white text-xs focus:ring-1 focus:ring-indigo-500 outline-none"
                  >
                    <option value="">-- Não importar --</option>
                    {previewHeaders.map((h) => <option key={h} value={h}>{h}</option>)}
                  </select>
                </div>

                {/* 5. Setor */}
                <div>
                  <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Setor (Opcional)</label>
                  <select
                    value={mappings.sector}
                    onChange={(e) => setMappings({ ...mappings, sector: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-white text-xs focus:ring-1 focus:ring-indigo-500 outline-none"
                  >
                    <option value="">-- Não importar --</option>
                    {previewHeaders.map((h) => <option key={h} value={h}>{h}</option>)}
                  </select>
                </div>

                {/* 6. Cargo */}
                <div>
                  <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Cargo (Opcional)</label>
                  <select
                    value={mappings.jobTitle}
                    onChange={(e) => setMappings({ ...mappings, jobTitle: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-white text-xs focus:ring-1 focus:ring-indigo-500 outline-none"
                  >
                    <option value="">-- Não importar --</option>
                    {previewHeaders.map((h) => <option key={h} value={h}>{h}</option>)}
                  </select>
                </div>

                {/* 7. Matrícula */}
                <div>
                  <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Matrícula (Opcional)</label>
                  <select
                    value={mappings.registrationNumber}
                    onChange={(e) => setMappings({ ...mappings, registrationNumber: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-white text-xs focus:ring-1 focus:ring-indigo-500 outline-none"
                  >
                    <option value="">-- Não importar --</option>
                    {previewHeaders.map((h) => <option key={h} value={h}>{h}</option>)}
                  </select>
                </div>

                {/* 8. Modelo de trabalho */}
                <div>
                  <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Modelo de Trabalho (Opcional)</label>
                  <select
                    value={mappings.workModel}
                    onChange={(e) => setMappings({ ...mappings, workModel: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-white text-xs focus:ring-1 focus:ring-indigo-500 outline-none"
                  >
                    <option value="">-- Não importar --</option>
                    {previewHeaders.map((h) => <option key={h} value={h}>{h}</option>)}
                  </select>
                </div>

                {/* 9. Gestor */}
                <div>
                  <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Gestor (Opcional)</label>
                  <select
                    value={mappings.managerUserId}
                    onChange={(e) => setMappings({ ...mappings, managerUserId: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-white text-xs focus:ring-1 focus:ring-indigo-500 outline-none"
                  >
                    <option value="">-- Não importar --</option>
                    {previewHeaders.map((h) => <option key={h} value={h}>{h}</option>)}
                  </select>
                  <p className="text-[9px] text-slate-500 mt-1">Busca automática por ID, Nome ou E-mail.</p>
                </div>

                {/* 10. Escala de trabalho */}
                <div>
                  <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Escala de Trabalho (Opcional)</label>
                  <select
                    value={mappings.workScheduleId}
                    onChange={(e) => setMappings({ ...mappings, workScheduleId: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-white text-xs focus:ring-1 focus:ring-indigo-500 outline-none"
                  >
                    <option value="">-- Não importar --</option>
                    {previewHeaders.map((h) => <option key={h} value={h}>{h}</option>)}
                  </select>
                  <p className="text-[9px] text-slate-500 mt-1">Busca automática por ID ou Nome da escala.</p>
                </div>
              </div>

              <div className="flex justify-between items-center pt-4 border-t border-slate-900">
                <button
                  type="button"
                  onClick={() => setStep(3)}
                  className="px-4 py-2 rounded-lg bg-slate-950 border border-slate-900 text-slate-400 text-xs hover:text-white"
                >
                  Voltar para Preview
                </button>
                <button
                  type="button"
                  onClick={handleValidateMappings}
                  disabled={loading || !mappings.name || !mappings.cpf || !mappings.whatsapp}
                  className="px-6 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 disabled:text-slate-500 text-white text-xs font-semibold transition-all shadow-lg"
                >
                  {loading ? 'Validando estrutura...' : 'Validar e Salvar Mapeamento'}
                </button>
              </div>
            </div>

            {/* Template actions sidebar */}
            <div className="space-y-4">
              {/* Load Template */}
              <div className="p-6 bg-slate-950 border border-slate-900 rounded-xl space-y-4">
                <h3 className="font-bold text-white text-xs flex items-center gap-1.5">
                  <ListFilter className="w-4 h-4 text-indigo-500" />
                  Aplicar Modelo Existente
                </h3>
                <p className="text-[11px] text-slate-500">
                  Selecione um modelo previamente salvo para auto-carregar as propriedades:
                </p>
                <select
                  value={selectedTemplateId}
                  onChange={(e) => handleApplyTemplate(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-white text-xs focus:ring-1 focus:ring-indigo-500 outline-none"
                >
                  <option value="">-- Selecione um modelo --</option>
                  {templates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>

              {/* Save Template */}
              <div className="p-6 bg-slate-950 border border-slate-900 rounded-xl space-y-4">
                <h3 className="font-bold text-white text-xs flex items-center gap-1.5">
                  <Settings className="w-4 h-4 text-indigo-500" />
                  Salvar Mapeamento Atual
                </h3>
                <p className="text-[11px] text-slate-500">
                  Salve a configuração atual para reutilizar em uploads futuros da mesma estrutura de arquivo:
                </p>
                <input
                  type="text"
                  placeholder="Ex: Planilha de Admissão TOTVS"
                  value={saveTemplateName}
                  onChange={(e) => setSaveTemplateName(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-white text-xs focus:ring-1 focus:ring-indigo-500 outline-none"
                />
                <button
                  type="button"
                  onClick={handleSaveTemplate}
                  disabled={isSavingTemplate || !saveTemplateName.trim()}
                  className="w-full py-2.5 rounded-lg bg-slate-900 hover:bg-slate-850 border border-slate-850 text-white text-xs font-semibold transition-all"
                >
                  {isSavingTemplate ? 'Salvando...' : 'Salvar Modelo'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* STEP 5: VALIDATION SUMMARY */}
      {step === 5 && validationSummary && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-4 rounded-xl bg-slate-950 border border-slate-900 text-center">
              <div className="text-slate-500 text-[10px] uppercase font-bold">Total Processado</div>
              <div className="text-3xl font-extrabold text-white mt-1">{validationSummary.validRows + validationSummary.invalidRows}</div>
            </div>
            <div className="p-4 rounded-xl bg-slate-950 border border-slate-900 text-center">
              <div className="text-slate-500 text-[10px] uppercase font-bold">Linhas Válidas</div>
              <div className="text-3xl font-extrabold text-emerald-500 mt-1">{validationSummary.validRows}</div>
            </div>
            <div className="p-4 rounded-xl bg-slate-950 border border-slate-900 text-center">
              <div className="text-slate-500 text-[10px] uppercase font-bold">Erros Impedientes</div>
              <div className="text-3xl font-extrabold text-red-500 mt-1">{validationSummary.invalidRows}</div>
            </div>
            <div className="p-4 rounded-xl bg-slate-950 border border-slate-900 text-center">
              <div className="text-slate-500 text-[10px] uppercase font-bold">Severidade Geral</div>
              <div className={`text-xs font-bold uppercase mt-3 px-2 py-1 rounded inline-block ${
                validationSummary.invalidRows > 0 ? 'bg-red-950/20 text-red-400 border border-red-900/30' : 'bg-emerald-950/20 text-emerald-400 border border-emerald-900/30'
              }`}>
                {validationSummary.invalidRows > 0 ? 'Ajustes Necessários' : 'Pronto para Confirmar'}
              </div>
            </div>
          </div>

          {/* Validation issues list */}
          {validationIssues.length > 0 && (
            <div className="p-6 bg-slate-950 border border-slate-900 rounded-xl space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="font-bold text-xs text-red-400 uppercase tracking-wider flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4" />
                  Inconsistências Identificadas ({validationIssues.length})
                </h3>
                <a
                  href={`/api/import-jobs/${jobId}/errors/download`}
                  className="text-[11px] font-bold text-slate-300 hover:text-white flex items-center gap-1 bg-slate-900 px-3 py-1.5 rounded-lg border border-slate-800"
                >
                  <Download className="w-3.5 h-3.5" /> Baixar Planilha de Erros
                </a>
              </div>

              <div className="max-h-80 overflow-y-auto divide-y divide-slate-900 text-xs text-slate-400 pr-2">
                {validationIssues.map((issue: any) => (
                  <div key={issue.id} className="py-2.5 flex items-start justify-between gap-4">
                    <div className="flex items-start gap-2.5">
                      <span className="px-2 py-0.5 rounded bg-slate-900 text-slate-500 text-[10px] font-bold">
                        Linha {issue.rowNumber}
                      </span>
                      <div>
                        <p className="text-slate-200 font-medium">{issue.message}</p>
                        <p className="text-[10px] text-slate-500 mt-0.5">Propriedade: {issue.field || 'geral'}</p>
                      </div>
                    </div>
                    <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded ${
                      issue.severity === 'ERROR' ? 'bg-red-950/20 text-red-400 border border-red-900/30' : 'bg-amber-950/20 text-amber-400 border border-amber-900/30'
                    }`}>
                      {issue.severity}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex justify-end gap-3">
            <button
              onClick={() => setStep(4)}
              className="px-4 py-2 rounded-lg bg-slate-950 border border-slate-900 text-slate-400 text-xs hover:text-white"
            >
              Ajustar Mapeamento
            </button>
            {validationSummary.validRows > 0 && (
              <button
                onClick={() => setStep(6)}
                className="px-5 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition-all shadow-lg"
              >
                Avançar para Configuração Final
              </button>
            )}
          </div>
        </div>
      )}

      {/* STEP 6: IMPORT SUMMARY & CONFIGURATION */}
      {step === 6 && (
        <div className="p-8 bg-slate-950 border border-slate-900 rounded-xl space-y-6 max-w-2xl mx-auto">
          <div className="text-center space-y-2">
            <h2 className="text-lg font-bold text-white">Configurações de Importação</h2>
            <p className="text-xs text-slate-400">
              Escolha a política de persistência no banco de dados para os <strong>{validationSummary?.validRows}</strong> colaboradores válidos:
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 py-2">
            {/* Mode CREATE_ONLY */}
            <button
              onClick={() => setImportMode('CREATE_ONLY')}
              className={`p-4 rounded-xl border text-left space-y-2 transition-all cursor-pointer ${
                importMode === 'CREATE_ONLY'
                  ? 'bg-indigo-600/10 border-indigo-500 text-white'
                  : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white hover:border-slate-700'
              }`}
            >
              <div className="text-xs font-bold uppercase tracking-wider">Apenas Criar</div>
              <p className="text-[10px] text-slate-400 leading-relaxed">
                Importa apenas novos cadastros. Se o CPF já existir, a linha correspondente é ignorada (skip).
              </p>
            </button>

            {/* Mode UPDATE_EXISTING */}
            <button
              onClick={() => setImportMode('UPDATE_EXISTING')}
              className={`p-4 rounded-xl border text-left space-y-2 transition-all cursor-pointer ${
                importMode === 'UPDATE_EXISTING'
                  ? 'bg-indigo-600/10 border-indigo-500 text-white'
                  : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white hover:border-slate-700'
              }`}
            >
              <div className="text-xs font-bold uppercase tracking-wider">Apenas Atualizar</div>
              <p className="text-[10px] text-slate-400 leading-relaxed">
                Atualiza os dados cadastrais de CPFs já cadastrados. Ignora qualquer novo colaborador.
              </p>
            </button>

            {/* Mode UPSERT */}
            <button
              onClick={() => setImportMode('UPSERT')}
              className={`p-4 rounded-xl border text-left space-y-2 transition-all cursor-pointer ${
                importMode === 'UPSERT'
                  ? 'bg-indigo-600/10 border-indigo-500 text-white'
                  : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white hover:border-slate-700'
              }`}
            >
              <div className="text-xs font-bold uppercase tracking-wider">Upsert Completo</div>
              <p className="text-[10px] text-slate-400 leading-relaxed">
                Combina criação e atualização: insere registros novos e atualiza dados dos existentes pelo CPF.
              </p>
            </button>
          </div>

          <div className="p-4 rounded-lg bg-amber-950/20 border border-amber-900/30 text-[11px] text-amber-400 leading-relaxed flex gap-2">
            <AlertTriangle className="w-4.5 h-4.5 shrink-0 mt-0.5" />
            <div>
              <strong>Atenção:</strong> A importação será executada de forma assíncrona. Os dados serão gravados em lotes transacionais de 100 registros. Em caso de falha física, os lotes processados antes da quebra serão mantidos.
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              onClick={() => setStep(5)}
              className="px-4 py-2 rounded-lg bg-slate-950 border border-slate-900 text-slate-400 text-xs hover:text-white"
            >
              Revisar Validação
            </button>
            <button
              onClick={handleConfirmImport}
              disabled={loading}
              className="px-6 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition-all shadow-lg flex items-center gap-1.5"
            >
              <Play className="w-4 h-4 fill-white" /> Confirmar e Enviar para Processamento
            </button>
          </div>
        </div>
      )}

      {/* STEP 7: ASYNC PROCESSING PROGRESS */}
      {step === 7 && progress && (
        <div className="p-8 bg-slate-950 border border-slate-900 rounded-xl max-w-lg mx-auto text-center space-y-6">
          <RefreshCw className="w-12 h-12 text-indigo-500 mx-auto animate-spin" />
          <div>
            <h2 className="text-lg font-bold text-white">Importação em Andamento</h2>
            <p className="text-xs text-slate-400 mt-1">
              Os colaboradores estão sendo analisados e persistidos no banco de dados. Você pode aguardar a conclusão.
            </p>
          </div>

          {/* Progress bar */}
          <div className="space-y-2">
            <div className="flex justify-between text-xs text-slate-400 font-bold px-1">
              <span>Status: <strong className="text-indigo-400">{progress.status}</strong></span>
              <span>{progress.processedRows} / {progress.totalRows}</span>
            </div>
            <div className="w-full h-3.5 bg-slate-900 border border-slate-800 rounded-full overflow-hidden p-0.5">
              <div
                style={{ width: `${progress.percent}%` }}
                className="h-full bg-gradient-to-r from-indigo-500 to-indigo-600 rounded-full transition-all duration-300 animate-pulse"
              ></div>
            </div>
            <div className="text-[10px] text-slate-500 text-right">{progress.percent}% completo</div>
          </div>

          <div className="flex justify-center pt-2">
            <button
              onClick={handleCancelJob}
              className="px-4 py-2 rounded-lg bg-red-950/20 hover:bg-red-900/30 text-red-400 text-xs font-semibold border border-red-900/30 transition-all"
            >
              Cancelar Importação Seguro
            </button>
          </div>
        </div>
      )}

      {/* STEP 8: FINAL RESULTS REPORT */}
      {step === 8 && progress && (
        <div className="p-8 bg-slate-950 border border-slate-900 rounded-xl max-w-xl mx-auto space-y-6">
          <div className="text-center space-y-2">
            {progress.status === 'COMPLETED' ? (
              <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto" />
            ) : progress.status === 'PARTIAL' ? (
              <AlertTriangle className="w-12 h-12 text-amber-500 mx-auto" />
            ) : (
              <XCircle className="w-12 h-12 text-red-500 mx-auto" />
            )}
            <h2 className="text-lg font-bold text-white">
              {progress.status === 'COMPLETED'
                ? 'Importação Concluída!'
                : progress.status === 'PARTIAL'
                ? 'Concluído com Inconsistências'
                : 'Falha Geral na Importação'}
            </h2>
            <p className="text-xs text-slate-400">
              O processamento assíncrono finalizou. Abaixo as estatísticas da execução:
            </p>
          </div>

          {/* Stats grid */}
          <div className="grid grid-cols-3 gap-3 text-center py-2">
            <div className="p-3 bg-slate-900 border border-slate-850 rounded-lg">
              <span className="text-[9px] uppercase font-bold text-slate-500">Novos Criados</span>
              <div className="text-xl font-extrabold text-white mt-0.5">{progress.createdRows || 0}</div>
            </div>
            <div className="p-3 bg-slate-900 border border-slate-850 rounded-lg">
              <span className="text-[9px] uppercase font-bold text-slate-500">Atualizados</span>
              <div className="text-xl font-extrabold text-indigo-400 mt-0.5">{progress.updatedRows || 0}</div>
            </div>
            <div className="p-3 bg-slate-900 border border-slate-850 rounded-lg">
              <span className="text-[9px] uppercase font-bold text-slate-500">Ignorados / Skips</span>
              <div className="text-xl font-extrabold text-slate-400 mt-0.5">{progress.skippedRows || 0}</div>
            </div>
          </div>

          {progress.failedRows > 0 && (
            <div className="p-4 rounded-xl bg-red-950/20 border border-red-900/30 space-y-3">
              <div className="flex justify-between items-center text-xs text-red-400 font-bold">
                <span className="flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4" />
                  Falhas no lote ({progress.failedRows} registros)
                </span>
                <a
                  href={`/api/import-jobs/${jobId}/errors/download`}
                  className="px-3 py-1.5 rounded-lg bg-slate-950 hover:bg-slate-900 text-white text-[11px] font-bold border border-slate-900 flex items-center gap-1"
                >
                  <Download className="w-3.5 h-3.5" /> Baixar Relatório de Erros
                </a>
              </div>
              <p className="text-[10px] text-slate-400 leading-relaxed">
                Algumas linhas continham informações que excederam os limites do plano da empresa ou quebraram regras de negócio no banco (Ex: gestor incompatível, limite excedido).
              </p>
            </div>
          )}

          <div className="flex justify-center gap-3 pt-3 border-t border-slate-900">
            <button
              onClick={() => {
                setStep(1);
                setFile(null);
                setJobId(null);
                setProgress(null);
              }}
              className="px-4 py-2 rounded-lg bg-slate-950 border border-slate-900 text-slate-350 hover:text-white text-xs transition-all cursor-pointer"
            >
              Importar Outra Planilha
            </button>
            <Link
              href="/app/employees"
              className="px-5 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition-all shadow-lg"
            >
              Ir para Lista de Funcionários
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
