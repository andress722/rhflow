'use client';

import React, { useState, useEffect } from 'react';
import { Plus, Search, Filter, Edit, ShieldAlert, UserX, Check, AlertCircle } from 'lucide-react';
import { api } from '@/lib/api';
import { getUser } from '@/lib/auth';
import PlanErrorAlert from '@/components/PlanErrorAlert';

export default function EmployeesPage() {
  const [employees, setEmployees] = useState<any[]>([]);
  const [schedules, setSchedules] = useState<any[]>([]);
  const [managers, setManagers] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [planError, setPlanError] = useState<string | null>(null);

  // Search and filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [sectorFilter, setSectorFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  // Modal state
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    fullName: '',
    cpf: '',
    whatsapp: '',
    email: '',
    sector: '',
    jobTitle: '',
    workModel: 'PRESENTIAL',
    workScheduleId: '',
    managerUserId: '',
  });

  const [formError, setFormError] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const loggedUser = getUser();
    setCurrentUser(loggedUser);
    fetchData(loggedUser);
  }, []);

  const fetchData = async (userObj: any) => {
    setIsLoading(true);
    setError('');
    try {
      // 1. Fetch employees
      const empRes = await api.get('/employees');
      if (empRes.success) {
        setEmployees(empRes.data || []);
      } else {
        setError(empRes.error?.message || 'Erro ao carregar funcionários.');
      }

      // 2. Fetch scales & managers (only needed for ADMIN/HR who can edit/create)
      if (userObj && ['ADMIN', 'HR'].includes(userObj.role)) {
        const schRes = await api.get('/work-schedules');
        if (schRes.success) {
          setSchedules(schRes.data || []);
        }

        const usersRes = await api.get('/users');
        if (usersRes.success) {
          // Filter to show only MANAGER users
          const mgs = (usersRes.data || []).filter((u: any) => u.role === 'MANAGER');
          setManagers(mgs);
        }
      }
    } catch (err) {
      setError('Erro ao carregar dados do servidor.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenCreateModal = () => {
    setModalMode('create');
    setFormData({
      fullName: '',
      cpf: '',
      whatsapp: '',
      email: '',
      sector: '',
      jobTitle: '',
      workModel: 'PRESENTIAL',
      workScheduleId: '',
      managerUserId: '',
    });
    setFormError('');
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (emp: any) => {
    setModalMode('edit');
    setSelectedEmployeeId(emp.id);
    setFormData({
      fullName: emp.fullName || '',
      cpf: emp.cpf || '',
      whatsapp: emp.whatsapp || '',
      email: emp.email || '',
      sector: emp.sector || '',
      jobTitle: emp.jobTitle || '',
      workModel: emp.workModel || 'PRESENTIAL',
      workScheduleId: emp.workScheduleId || '',
      managerUserId: emp.managerUserId || '',
    });
    setFormError('');
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    setIsSaving(true);

    try {
      let res;
      if (modalMode === 'create') {
        res = await api.post('/employees', formData);
      } else {
        res = await api.patch(`/employees/${selectedEmployeeId}`, formData);
      }

      if (res.success) {
        setIsModalOpen(false);
        fetchData(currentUser);
      } else {
        const errCode = res.error?.code || res.error || (res as any).error;
        if (['PLAN_LIMIT_EXCEEDED', 'PLAN_FEATURE_DISABLED', 'FEATURE_DISABLED', 'FORBIDDEN'].includes(errCode)) {
          setPlanError(errCode);
        } else {
          setFormError(res.error?.message || 'Ocorreu um erro ao salvar o funcionário.');
        }
      }
    } catch (err) {
      setFormError('Erro de conexão com o servidor.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeactivate = async (id: string, name: string) => {
    if (!confirm(`Tem certeza que deseja inativar o funcionário ${name}?`)) return;

    try {
      const res = await api.patch(`/employees/${id}/deactivate`);
      if (res.success) {
        fetchData(currentUser);
      } else {
        const errCode = res.error?.code || res.error || (res as any).error;
        if (['PLAN_LIMIT_EXCEEDED', 'PLAN_FEATURE_DISABLED', 'FEATURE_DISABLED', 'FORBIDDEN'].includes(errCode)) {
          setPlanError(errCode);
        } else {
          alert(res.error?.message || 'Erro ao inativar funcionário.');
        }
      }
    } catch (err) {
      alert('Erro de conexão com o servidor.');
    }
  };

  // 6. MANAGER e 7. VIEWER não podem criar, editar ou inativar
  const canModify = currentUser && ['ADMIN', 'HR'].includes(currentUser.role);

  // Filter logic
  const filteredEmployees = employees.filter((emp) => {
    const matchesSearch =
      emp.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      emp.cpf.includes(searchQuery) ||
      (emp.sector && emp.sector.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesSector = !sectorFilter || emp.sector === sectorFilter;
    const matchesStatus = !statusFilter || emp.status === statusFilter;

    return matchesSearch && matchesSector && matchesStatus;
  });

  // Extract unique sectors for filter dropdown
  const sectors = Array.from(new Set(employees.map((emp) => emp.sector).filter(Boolean)));

  const maskCpf = (cpf: string) => {
    if (!cpf) return '';
    // Show only first 3 and last 2 digits, mask the rest
    // e.g. 123.***.***-45
    const clean = cpf.replace(/\D/g, '');
    if (clean.length !== 11) return cpf;
    return `${clean.substring(0, 3)}.***.***-${clean.substring(9, 11)}`;
  };

  const getWorkModelBadge = (model: string) => {
    switch (model) {
      case 'PRESENTIAL':
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">Presencial</span>;
      case 'REMOTE':
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/20">Remoto</span>;
      case 'HYBRID':
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-500/10 text-purple-400 border border-purple-500/20">Híbrido</span>;
      default:
        return model;
    }
  };

  return (
    <>
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white">Funcionários</h1>
          <p className="text-slate-400 text-sm mt-1">
            {currentUser?.role === 'MANAGER'
              ? 'Visualize a lista de funcionários sob sua supervisão direta.'
              : 'Gerencie o cadastro de funcionários, escalas e vínculos de gestão.'}
          </p>
        </div>

        {/* Create button (ADMIN/HR only) */}
        {canModify && (
          <button
            onClick={handleOpenCreateModal}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-sm transition-all shadow-md shadow-indigo-600/15"
          >
            <Plus className="w-4 h-4" />
            <span>Novo Funcionário</span>
          </button>
        )}
      </div>

      {/* Filter and search bar */}
      <div className="flex flex-col md:flex-row gap-4 p-5 rounded-xl border border-slate-800 bg-slate-900 shadow-lg">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            type="text"
            placeholder="Buscar por nome, CPF ou setor..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="block w-full pl-10 pr-4 py-2 rounded-lg bg-slate-950 border border-slate-800 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all text-sm"
          />
        </div>
        <div className="flex gap-4">
          <div className="relative">
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
            <select
              value={sectorFilter}
              onChange={(e) => setSectorFilter(e.target.value)}
              className="block w-40 pl-9 pr-8 py-2 rounded-lg bg-slate-950 border border-slate-800 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all text-sm appearance-none cursor-pointer"
            >
              <option value="">Todos Setores</option>
              {sectors.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
          <div className="relative">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="block w-36 px-4 py-2 rounded-lg bg-slate-950 border border-slate-800 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all text-sm appearance-none cursor-pointer"
            >
              <option value="">Todos Status</option>
              <option value="ACTIVE">Ativos</option>
              <option value="INACTIVE">Inativos</option>
            </select>
          </div>
        </div>
      </div>

      {/* Table Card */}
      <div className="rounded-xl border border-slate-800 bg-slate-900 overflow-hidden shadow-xl">
        {isLoading ? (
          <div className="py-20 flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
            <span className="text-sm text-slate-400">Carregando lista...</span>
          </div>
        ) : error ? (
          <div className="py-16 text-center text-slate-400 flex flex-col items-center gap-3">
            <ShieldAlert className="w-12 h-12 text-red-500" />
            <p className="text-sm">{error}</p>
          </div>
        ) : filteredEmployees.length === 0 ? (
          <div className="py-20 text-center text-slate-500">
            Nenhum funcionário cadastrado ou correspondente aos filtros.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-400 border-collapse">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-900/50 text-slate-500 font-semibold text-xs uppercase tracking-wider">
                  <th className="px-6 py-3.5">Nome</th>
                  <th className="px-6 py-3.5">CPF</th>
                  <th className="px-6 py-3.5">WhatsApp</th>
                  <th className="px-6 py-3.5">Setor / Cargo</th>
                  <th className="px-6 py-3.5">Modelo</th>
                  <th className="px-6 py-3.5">Escala / Gestor</th>
                  <th className="px-6 py-3.5">Status</th>
                  {canModify && <th className="px-6 py-3.5 text-right">Ações</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filteredEmployees.map((emp) => (
                  <tr key={emp.id} className="hover:bg-slate-800/20 transition-colors">
                    <td className="px-6 py-4 font-semibold text-slate-200">{emp.fullName}</td>
                    {/* 15. CPF deve aparecer mascarado em tabelas */}
                    <td className="px-6 py-4 text-xs font-mono">{maskCpf(emp.cpf)}</td>
                    <td className="px-6 py-4">{emp.whatsapp}</td>
                    <td className="px-6 py-4 text-sm">
                      <p className="text-slate-200">{emp.sector || '-'}</p>
                      <p className="text-xs text-slate-500">{emp.jobTitle || '-'}</p>
                    </td>
                    <td className="px-6 py-4">{getWorkModelBadge(emp.workModel)}</td>
                    <td className="px-6 py-4 text-sm">
                      <p className="text-indigo-400 font-medium">{emp.workSchedule?.name || 'Sem Escala'}</p>
                      <p className="text-xs text-slate-500">Supervisor: {emp.manager?.name || 'Nenhum'}</p>
                    </td>
                    <td className="px-6 py-4">
                      {emp.status === 'ACTIVE' ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">Ativo</span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-800 text-slate-500 border border-slate-700">Inativo</span>
                      )}
                    </td>
                    {canModify && (
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleOpenEditModal(emp)}
                            className="p-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
                            title="Editar"
                          >
                            <Edit className="w-3.5 h-3.5" />
                          </button>
                          {emp.status === 'ACTIVE' && (
                            <button
                              onClick={() => handleDeactivate(emp.id, emp.fullName)}
                              className="p-1.5 rounded bg-red-950/20 hover:bg-red-900/30 text-red-400 hover:text-red-300 transition-colors border border-red-800/20"
                              title="Inativar"
                            >
                              <UserX className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal - Create/Edit Employee */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm transition-opacity">
          <div className="relative w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
            {/* Modal header */}
            <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
              <h2 className="text-xl font-bold text-white">
                {modalMode === 'create' ? 'Cadastrar Funcionário' : 'Editar Funcionário'}
              </h2>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-200 text-sm font-medium transition-colors"
              >
                Fechar
              </button>
            </div>

            {/* Modal content */}
            <form onSubmit={handleSave} className="flex-1 overflow-y-auto p-6 space-y-6">
              {formError && (
                <div className="flex items-center gap-3 p-4 rounded-lg bg-red-950/50 border border-red-800 text-red-200 text-sm">
                  <AlertCircle className="w-5 h-5 text-red-400 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Nome Completo</label>
                  <input
                    type="text"
                    required
                    value={formData.fullName}
                    onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                    className="block w-full px-4 py-2 rounded-lg bg-slate-950 border border-slate-800 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all text-sm"
                    placeholder="Ex: João da Silva"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">CPF</label>
                  <input
                    type="text"
                    required
                    maxLength={14}
                    value={formData.cpf}
                    onChange={(e) => setFormData({ ...formData, cpf: e.target.value })}
                    className="block w-full px-4 py-2 rounded-lg bg-slate-950 border border-slate-800 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all text-sm font-mono"
                    placeholder="Apenas números ou formatado"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">WhatsApp</label>
                  <input
                    type="text"
                    required
                    value={formData.whatsapp}
                    onChange={(e) => setFormData({ ...formData, whatsapp: e.target.value })}
                    className="block w-full px-4 py-2 rounded-lg bg-slate-950 border border-slate-800 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all text-sm"
                    placeholder="Ex: 11999998888"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">E-mail (Opcional)</label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="block w-full px-4 py-2 rounded-lg bg-slate-950 border border-slate-800 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all text-sm"
                    placeholder="joao@empresa.com"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Setor</label>
                  <input
                    type="text"
                    value={formData.sector}
                    onChange={(e) => setFormData({ ...formData, sector: e.target.value })}
                    className="block w-full px-4 py-2 rounded-lg bg-slate-950 border border-slate-800 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all text-sm"
                    placeholder="Ex: Vendas, T.I."
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Cargo</label>
                  <input
                    type="text"
                    value={formData.jobTitle}
                    onChange={(e) => setFormData({ ...formData, jobTitle: e.target.value })}
                    className="block w-full px-4 py-2 rounded-lg bg-slate-950 border border-slate-800 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all text-sm"
                    placeholder="Ex: Analista Comercial"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Modelo de Trabalho</label>
                  <select
                    value={formData.workModel}
                    onChange={(e) => setFormData({ ...formData, workModel: e.target.value })}
                    className="block w-full px-4 py-2 rounded-lg bg-slate-950 border border-slate-800 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all text-sm"
                  >
                    <option value="PRESENTIAL">Presencial</option>
                    <option value="REMOTE">Remoto</option>
                    <option value="HYBRID">Híbrido</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Escala de Trabalho (Jornada)</label>
                  <select
                    value={formData.workScheduleId}
                    onChange={(e) => setFormData({ ...formData, workScheduleId: e.target.value })}
                    className="block w-full px-4 py-2 rounded-lg bg-slate-950 border border-slate-800 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all text-sm"
                  >
                    <option value="">Selecione uma Escala...</option>
                    {schedules.map((sch) => (
                      <option key={sch.id} value={sch.id}>{sch.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Gestor Responsável</label>
                  <select
                    value={formData.managerUserId}
                    onChange={(e) => setFormData({ ...formData, managerUserId: e.target.value })}
                    className="block w-full px-4 py-2 rounded-lg bg-slate-950 border border-slate-800 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all text-sm"
                  >
                    <option value="">Selecione um Gestor...</option>
                    {managers.map((mg) => (
                      <option key={mg.id} value={mg.id}>{mg.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Modal footer */}
              <div className="pt-4 border-t border-slate-800 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-medium transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium shadow-md shadow-indigo-600/10 transition-colors"
                >
                  {isSaving ? 'Salvando...' : 'Salvar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      <PlanErrorAlert error={planError} onClose={() => setPlanError(null)} />
    </>
  );
}
