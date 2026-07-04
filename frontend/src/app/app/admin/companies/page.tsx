'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import {
  Building2,
  Search,
  Plus,
  Shield,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Copy,
  Check,
  Power,
  RefreshCw,
} from 'lucide-react';

export default function AdminCompaniesPage() {
  const [companies, setCompanies] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Diagnostics states
  const [diagnosingCompanyId, setDiagnosingCompanyId] = useState<string | null>(null);
  const [diagnosticsData, setDiagnosticsData] = useState<any | null>(null);
  const [diagnosticsLoading, setDiagnosticsLoading] = useState(false);

  // Onboard form modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formErrorRequestId, setFormErrorRequestId] = useState<string | null>(null);
  
  // Created credentials modal state
  const [onboardResult, setOnboardResult] = useState<any | null>(null);
  const [copied, setCopied] = useState(false);

  // Form inputs
  const [legalName, setLegalName] = useState('');
  const [tradeName, setTradeName] = useState('');
  const [cnpj, setCnpj] = useState('');
  const [adminName, setAdminName] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [planCode, setPlanCode] = useState('PRO');

  const fetchCompanies = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.get('/admin/companies');
      if (response.success) {
        setCompanies(response.data || []);
      } else {
        setError(response.error?.message || 'Erro ao carregar lista de empresas.');
      }
    } catch (err) {
      setError('Erro de rede ao carregar empresas.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCompanies();
  }, []);

  const handleDeactivate = async (id: string) => {
    if (!confirm('Tem certeza de que deseja DESATIVAR esta empresa? Todos os usuários perderão o acesso.')) return;
    try {
      const response = await api.post(`/admin/companies/${id}/deactivate`);
      if (response.success) {
        fetchCompanies();
      } else {
        alert(response.error?.message || 'Erro ao desativar empresa.');
      }
    } catch (err) {
      alert('Erro de rede ao desativar empresa.');
    }
  };

  const handleReactivate = async (id: string) => {
    if (!confirm('Tem certeza de que deseja REATIVAR esta empresa?')) return;
    try {
      const response = await api.post(`/admin/companies/${id}/reactivate`);
      if (response.success) {
        fetchCompanies();
      } else {
        alert(response.error?.message || 'Erro ao reativar empresa.');
      }
    } catch (err) {
      alert('Erro de rede ao reativar empresa.');
    }
  };

  const handleDiagnose = async (id: string) => {
    setDiagnosingCompanyId(id);
    setDiagnosticsLoading(true);
    setDiagnosticsData(null);
    try {
      const response = await api.get(`/admin/go-live/readiness/${id}`);
      if (response.success) {
        setDiagnosticsData(response.data);
      } else {
        alert(response.error?.message || 'Erro ao obter diagnóstico de go-live.');
        setDiagnosingCompanyId(null);
      }
    } catch (err) {
      alert('Erro de rede ao buscar diagnóstico.');
      setDiagnosingCompanyId(null);
    } finally {
      setDiagnosticsLoading(false);
    }
  };

  const handleOnboardSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setFormError(null);
    setFormErrorRequestId(null);

    const payload = {
      company: {
        legalName,
        tradeName,
        cnpj,
      },
      adminUser: {
        name: adminName,
        email: adminEmail,
      },
      planCode,
    };

    try {
      const response = await api.post('/admin/companies/onboard', payload);
      if (response.success) {
        setOnboardResult(response.data);
        setIsModalOpen(false);
        // Clear fields
        setLegalName('');
        setTradeName('');
        setCnpj('');
        setAdminName('');
        setAdminEmail('');
        setPlanCode('PRO');
        fetchCompanies();
      } else {
        setFormError(response.error?.message || 'Erro ao cadastrar empresa.');
        if (response.error?.requestId) {
          setFormErrorRequestId(response.error.requestId);
        }
      }
    } catch (err) {
      setFormError('Erro de rede ao cadastrar empresa.');
    } finally {
      setSubmitting(false);
    }
  };

  const copyToClipboard = () => {
    if (!onboardResult?.tempPassword) return;
    navigator.clipboard.writeText(onboardResult.tempPassword);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Filter companies client-side
  const filteredCompanies = companies.filter((c: any) => {
    const term = search.toLowerCase().trim();
    if (!term) return true;
    return (
      c.name?.toLowerCase().includes(term) ||
      c.legalName?.toLowerCase().includes(term) ||
      c.cnpj?.includes(term)
    );
  });

  return (
    <div className="space-y-6">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight flex items-center gap-3">
            <Shield className="w-8 h-8 text-indigo-500" />
            Painel Plataforma
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            Gerenciamento global de clientes, onboarding comercial e controle de acessos corporativos.
          </p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold bg-indigo-600 hover:bg-indigo-500 text-white transition-all shadow-lg shadow-indigo-600/10 cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          Onboard Nova Empresa
        </button>
      </div>

      {/* Main Alerts or Result Credentials Display */}
      {onboardResult && (
        <div className="p-6 rounded-xl bg-slate-900 border border-indigo-500/30 space-y-4">
          <div className="flex items-start gap-3 text-indigo-400">
            <CheckCircle2 className="w-6 h-6 shrink-0 mt-0.5" />
            <div>
              <h3 className="font-bold text-white text-lg">Empresa Onboardada com Sucesso!</h3>
              <p className="text-slate-400 text-sm mt-0.5">
                Os dados operacionais, assinatura {onboardResult.company.subscription?.plan?.code || planCode} e canal do WhatsApp simulado foram criados no banco de dados.
              </p>
            </div>
          </div>

          <div className="p-4 rounded-lg bg-indigo-950/40 border border-indigo-800/40 space-y-3">
            <div className="flex items-center gap-2 text-indigo-300 font-semibold text-sm">
              <AlertTriangle className="w-4 h-4 text-amber-500" />
              <span>Cuidado: Senha temporária do administrador (copie agora, não será exibida novamente)</span>
            </div>

            <div className="flex items-center justify-between gap-4 p-3 rounded bg-slate-950 font-mono text-white text-lg tracking-wider border border-slate-800">
              <span>{onboardResult.tempPassword}</span>
              <button
                onClick={copyToClipboard}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold font-sans transition-all cursor-pointer"
              >
                {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? 'Copiado!' : 'Copiar'}</span>
              </button>
            </div>
            
            <div className="text-xs text-slate-500">
              Administrador: <strong className="text-slate-300">{onboardResult.admin.name}</strong> ({onboardResult.admin.email})
            </div>
          </div>

          <div className="flex justify-end">
            <button
              onClick={() => setOnboardResult(null)}
              className="px-4 py-2 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-semibold transition-all cursor-pointer"
            >
              Fechar Aviso
            </button>
          </div>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="flex gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-3 w-4 h-4 text-slate-500" />
          <input
            type="text"
            placeholder="Buscar por Nome Fantasia, Razão Social ou CNPJ..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-slate-900 border border-slate-800 text-white text-sm focus:outline-none focus:border-indigo-500 transition-colors"
          />
        </div>
        <button
          onClick={fetchCompanies}
          className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 hover:bg-slate-800 text-slate-400 hover:text-white transition-all cursor-pointer"
          title="Recarregar"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Companies List Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
        {loading ? (
          <div className="py-12 flex flex-col items-center justify-center gap-3">
            <div className="w-8 h-8 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
            <span className="text-slate-400 text-sm">Carregando lista de empresas...</span>
          </div>
        ) : error ? (
          <div className="py-12 text-center text-red-400">
            <AlertTriangle className="w-8 h-8 mx-auto mb-2 text-red-500" />
            <p className="text-sm font-medium">{error}</p>
          </div>
        ) : filteredCompanies.length === 0 ? (
          <div className="py-12 text-center text-slate-500">
            <Building2 className="w-8 h-8 mx-auto mb-2 text-slate-600" />
            <p className="text-sm">Nenhuma empresa encontrada com os critérios informados.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-950/50 text-slate-400 text-xs font-semibold tracking-wider">
                  <th className="px-6 py-4">Empresa (Trade / Legal)</th>
                  <th className="px-6 py-4">CNPJ</th>
                  <th className="px-6 py-4">Plano Ativo</th>
                  <th className="px-6 py-4">Funcionários</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 text-sm text-slate-300">
                {filteredCompanies.map((c) => {
                  const plan = c.subscription?.plan?.name || 'Sem plano';
                  const planCode = c.subscription?.plan?.code || 'STARTER';
                  const activeCount = c._count?.employees ?? 0;
                  const maxCount = c.subscription?.plan?.maxEmployees ?? 5;

                  return (
                    <tr key={c.id} className="hover:bg-slate-950/30 transition-colors">
                      <td className="px-6 py-4">
                        <div className="font-semibold text-slate-100">{c.name}</div>
                        <div className="text-xs text-slate-500 truncate max-w-xs">{c.legalName || 'N/A'}</div>
                      </td>
                      <td className="px-6 py-4 font-mono text-slate-400">
                        {c.cnpj ? c.cnpj.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5') : 'N/A'}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex px-2 py-0.5 rounded text-xs font-semibold ${
                          planCode === 'BUSINESS'
                            ? 'bg-purple-950/40 text-purple-400 border border-purple-800/40'
                            : planCode === 'PRO'
                            ? 'bg-indigo-950/40 text-indigo-400 border border-indigo-800/40'
                            : 'bg-slate-950 text-slate-400 border border-slate-800'
                        }`}>
                          {plan}
                        </span>
                      </td>
                      <td className="px-6 py-4 font-medium text-slate-400">
                        {activeCount} / <span className="text-slate-600">{maxCount}</span>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center gap-1.5 text-xs font-semibold ${
                          c.isActive ? 'text-emerald-400' : 'text-red-400'
                        }`}>
                          {c.isActive ? (
                            <>
                              <CheckCircle2 className="w-3.5 h-3.5" /> Ativo
                            </>
                          ) : (
                            <>
                              <XCircle className="w-3.5 h-3.5" /> Desativada
                            </>
                          )}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right flex justify-end gap-2">
                        <Link
                          href={`/app/admin/pilot-feedback?companyId=${c.id}`}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded bg-slate-950 hover:bg-slate-850 text-slate-350 border border-slate-800 text-xs font-semibold transition-all cursor-pointer"
                        >
                          Feedbacks
                        </Link>
                        <Link
                          href={`/app/admin/pilot-backlog?companyId=${c.id}`}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded bg-slate-950 hover:bg-slate-850 text-slate-350 border border-slate-800 text-xs font-semibold transition-all cursor-pointer"
                        >
                          Backlog
                        </Link>
                        <button
                          onClick={() => handleDiagnose(c.id)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded bg-indigo-950/20 hover:bg-indigo-950/40 text-indigo-400 border border-indigo-900/30 hover:border-indigo-800/50 text-xs font-semibold transition-all cursor-pointer"
                        >
                          Diagnóstico
                        </button>
                        {c.isActive ? (
                          <button
                            onClick={() => handleDeactivate(c.id)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded bg-red-950/20 hover:bg-red-950/40 text-red-400 border border-red-900/30 hover:border-red-800/50 text-xs font-semibold transition-all cursor-pointer"
                          >
                            <Power className="w-3 h-3" />
                            Desativar
                          </button>
                        ) : (
                          <button
                            onClick={() => handleReactivate(c.id)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded bg-emerald-950/20 hover:bg-emerald-950/40 text-emerald-400 border border-emerald-900/30 hover:border-emerald-800/50 text-xs font-semibold transition-all cursor-pointer"
                          >
                            <Power className="w-3 h-3" />
                            Reativar
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Onboard Form Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="w-full max-w-xl bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <Building2 className="w-5 h-5 text-indigo-500" />
                Onboard Nova Empresa
              </h2>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-white transition-colors cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleOnboardSubmit}>
              <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
                {formError && (
                  <div className="flex flex-col gap-1 p-3 rounded-lg bg-red-950/30 border border-red-900/40 text-red-400 text-xs">
                    <div className="flex gap-2 items-start">
                      <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                      <span>{formError}</span>
                    </div>
                    {formErrorRequestId && (
                      <span className="text-[10px] text-slate-500 font-mono mt-1 pl-6 block">
                        ID da Requisição: {formErrorRequestId}
                      </span>
                    )}
                  </div>
                )}

                <div className="space-y-3">
                  <h4 className="text-xs font-bold text-indigo-400 uppercase tracking-wider">Dados da Empresa</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-xs text-slate-400 font-semibold">Nome Fantasia (Trade Name) *</label>
                      <input
                        type="text"
                        required
                        value={tradeName}
                        onChange={(e) => setTradeName(e.target.value)}
                        placeholder="Ex: Minha Empresa Corp"
                        className="w-full px-3 py-2 rounded bg-slate-950 border border-slate-800 text-white text-sm focus:outline-none focus:border-indigo-500"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs text-slate-400 font-semibold">Razão Social (Legal Name) *</label>
                      <input
                        type="text"
                        required
                        value={legalName}
                        onChange={(e) => setLegalName(e.target.value)}
                        placeholder="Ex: Minha Empresa S.A."
                        className="w-full px-3 py-2 rounded bg-slate-950 border border-slate-800 text-white text-sm focus:outline-none focus:border-indigo-500"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-xs text-slate-400 font-semibold">CNPJ *</label>
                      <input
                        type="text"
                        required
                        value={cnpj}
                        onChange={(e) => setCnpj(e.target.value)}
                        placeholder="Ex: 00.000.000/0000-00"
                        className="w-full px-3 py-2 rounded bg-slate-950 border border-slate-800 text-white text-sm focus:outline-none focus:border-indigo-500"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs text-slate-400 font-semibold">Plano SaaS Comercial *</label>
                      <select
                        value={planCode}
                        onChange={(e) => setPlanCode(e.target.value)}
                        className="w-full px-3 py-2 rounded bg-slate-950 border border-slate-800 text-slate-300 text-sm focus:outline-none focus:border-indigo-500"
                      >
                        <option value="STARTER">Starter (Máx 5 func)</option>
                        <option value="PRO">Pro (Máx 25 func)</option>
                        <option value="BUSINESS">Business (Máx 150 func)</option>
                      </select>
                    </div>
                  </div>
                </div>

                <div className="border-t border-slate-800/60 pt-4 space-y-3">
                  <h4 className="text-xs font-bold text-indigo-400 uppercase tracking-wider">Administrador Inicial</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-xs text-slate-400 font-semibold">Nome Completo *</label>
                      <input
                        type="text"
                        required
                        value={adminName}
                        onChange={(e) => setAdminName(e.target.value)}
                        placeholder="Ex: Ana Silva"
                        className="w-full px-3 py-2 rounded bg-slate-950 border border-slate-800 text-white text-sm focus:outline-none focus:border-indigo-500"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs text-slate-400 font-semibold">E-mail Corporativo *</label>
                      <input
                        type="email"
                        required
                        value={adminEmail}
                        onChange={(e) => setAdminEmail(e.target.value)}
                        placeholder="Ex: admin@minhaempresa.com"
                        className="w-full px-3 py-2 rounded bg-slate-950 border border-slate-800 text-white text-sm focus:outline-none focus:border-indigo-500"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="px-6 py-4 border-t border-slate-800 bg-slate-950/40 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-all cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 rounded bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition-all cursor-pointer disabled:opacity-50"
                >
                  {submitting ? 'Processando...' : 'Salvar e Gerar Credenciais'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Diagnóstico Go-Live Modal */}
      {diagnosingCompanyId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <Building2 className="w-5 h-5 text-indigo-500" />
                Diagnóstico de Prontidão Go-Live
              </h2>
              <button
                onClick={() => setDiagnosingCompanyId(null)}
                className="text-slate-400 hover:text-white transition-colors cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto">
              {diagnosticsLoading ? (
                <div className="py-12 flex flex-col items-center justify-center gap-3">
                  <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
                  <span className="text-sm text-slate-400">Analisando infraestrutura de banco e configurações...</span>
                </div>
              ) : diagnosticsData ? (
                <div className="space-y-6">
                  {/* Status header */}
                  <div className="flex items-center justify-between bg-slate-950/40 p-4 border border-slate-800 rounded-xl">
                    <div>
                      <span className="text-xs text-slate-500 font-semibold uppercase tracking-wider block">Status da Implantação</span>
                      {diagnosticsData.goLiveReady ? (
                        <span className="text-emerald-400 font-bold text-lg flex items-center gap-1.5 mt-0.5">
                          <CheckCircle2 className="w-5 h-5 text-emerald-450" />
                          <span>PRONTO PARA GO-LIVE</span>
                        </span>
                      ) : (
                        <span className="text-red-400 font-bold text-lg flex items-center gap-1.5 mt-0.5">
                          <XCircle className="w-5 h-5 text-red-450" />
                          <span>BLOQUEADO OPERACIONAL</span>
                        </span>
                      )}
                    </div>
                    <div className="text-right">
                      <span className="text-xs text-slate-500 font-semibold uppercase tracking-wider block">Score Onboarding</span>
                      <span className="text-indigo-400 font-extrabold text-2xl block mt-0.5">{diagnosticsData.onboardingScore}%</span>
                    </div>
                  </div>

                  {/* Checklist items */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-slate-950/20 border border-slate-850 p-4 rounded-xl space-y-3">
                      <h3 className="text-sm font-bold text-slate-200">Requisitos Mínimos (GO)</h3>
                      <div className="space-y-2 text-xs">
                        <div className="flex justify-between items-center py-1 border-b border-slate-850">
                          <span className="text-slate-450">Cadastro da Empresa Ativo</span>
                          {diagnosticsData.companyActive ? (
                            <span className="text-emerald-400 flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5" /> Sim</span>
                          ) : (
                            <span className="text-red-400 flex items-center gap-1"><XCircle className="w-3.5 h-3.5" /> Não</span>
                          )}
                        </div>
                        <div className="flex justify-between items-center py-1 border-b border-slate-850">
                          <span className="text-slate-450">Usuário Administrador Ativo</span>
                          {diagnosticsData.adminUserExists ? (
                            <span className="text-emerald-400 flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5" /> Configurado</span>
                          ) : (
                            <span className="text-red-400 flex items-center gap-1"><XCircle className="w-3.5 h-3.5" /> Ausente</span>
                          )}
                        </div>
                        <div className="flex justify-between items-center py-1 border-b border-slate-850">
                          <span className="text-slate-450">Colaboradores Cadastrados</span>
                          {diagnosticsData.activeEmployees > 0 ? (
                            <span className="text-emerald-400 flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5" /> {diagnosticsData.activeEmployees} ativos</span>
                          ) : (
                            <span className="text-red-400 flex items-center gap-1"><XCircle className="w-3.5 h-3.5" /> Nenhum</span>
                          )}
                        </div>
                        <div className="flex justify-between items-center py-1">
                          <span className="text-slate-450">Jornadas/Escalas de Trabalho</span>
                          {diagnosticsData.schedulesConfigured ? (
                            <span className="text-emerald-400 flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5" /> Ativas</span>
                          ) : (
                            <span className="text-red-400 flex items-center gap-1"><XCircle className="w-3.5 h-3.5" /> Ausente</span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="bg-slate-950/20 border border-slate-850 p-4 rounded-xl space-y-3">
                      <h3 className="text-sm font-bold text-slate-200">Recomendações e Integrações</h3>
                      <div className="space-y-2 text-xs">
                        <div className="flex justify-between items-center py-1 border-b border-slate-850">
                          <span className="text-slate-450">Conexão WhatsApp</span>
                          <span className={`${diagnosticsData.whatsappStatus === 'CONNECTED' || diagnosticsData.whatsappStatus === 'SIMULATION' ? 'text-emerald-400' : 'text-amber-400'} font-semibold`}>
                            {diagnosticsData.whatsappStatus}
                          </span>
                        </div>
                        <div className="flex justify-between items-center py-1 border-b border-slate-850">
                          <span className="text-slate-450">Gestores Associados</span>
                          {diagnosticsData.managersAssigned ? (
                            <span className="text-emerald-400 flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5" /> Vinculados</span>
                          ) : (
                            <span className="text-amber-400 flex items-center gap-1"><AlertTriangle className="w-3.5 h-3.5" /> Nenhum</span>
                          )}
                        </div>
                        <div className="flex justify-between items-center py-1 border-b border-slate-850">
                          <span className="text-slate-450">Faturamento Manual Comercial</span>
                          {diagnosticsData.billingConfigured ? (
                            <span className="text-emerald-400 flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5" /> Definido</span>
                          ) : (
                            <span className="text-amber-400 flex items-center gap-1"><AlertTriangle className="w-3.5 h-3.5" /> Pendente</span>
                          )}
                        </div>
                        <div className="flex justify-between items-center py-1">
                          <span className="text-slate-450">Score de Saúde da Empresa</span>
                          <span className="text-indigo-400 font-bold">{diagnosticsData.healthScore}% (7d)</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Blocking issues list */}
                  {diagnosticsData.blockingIssues.length > 0 && (
                    <div className="bg-red-950/20 border border-red-900/40 rounded-xl p-4 space-y-2">
                      <h4 className="text-xs font-bold text-red-400 uppercase tracking-wider flex items-center gap-1.5">
                        <AlertTriangle className="w-4 h-4" />
                        <span>Impedimentos Críticos de Go-Live ({diagnosticsData.blockingIssues.length})</span>
                      </h4>
                      <ul className="list-disc pl-5 text-xs text-red-300/80 space-y-1">
                        {diagnosticsData.blockingIssues.map((issue: string, idx: number) => (
                          <li key={idx}>{issue}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Warnings list */}
                  {diagnosticsData.warnings.length > 0 && (
                    <div className="bg-amber-950/20 border border-amber-900/40 rounded-xl p-4 space-y-2">
                      <h4 className="text-xs font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                        <AlertTriangle className="w-4 h-4" />
                        <span>Alertas e Recomendações de Qualidade ({diagnosticsData.warnings.length})</span>
                      </h4>
                      <ul className="list-disc pl-5 text-xs text-amber-300/80 space-y-1">
                        {diagnosticsData.warnings.map((warn: string, idx: number) => (
                          <li key={idx}>{warn}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              ) : (
                <div className="py-12 text-center text-slate-500">Falha ao buscar telemetria de diagnóstico.</div>
              )}
            </div>

            <div className="px-6 py-4 border-t border-slate-800 bg-slate-950/40 flex justify-end">
              <button
                type="button"
                onClick={() => setDiagnosingCompanyId(null)}
                className="px-4 py-2 rounded bg-indigo-650 hover:bg-indigo-600 text-white text-xs font-semibold transition-all cursor-pointer"
              >
                Fechar Diagnóstico
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
