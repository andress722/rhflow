'use client';

import React, { useState, useEffect } from 'react';
import { Plus, Search, Filter, Edit, ShieldAlert, UserX, Check, AlertCircle, Sparkles } from 'lucide-react';
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

  const [deactivatingId, setDeactivatingId] = useState<string | null>(null);
  const [activatingId, setActivatingId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string; requestId?: string } | null>(null);

  // Inactivation Modal State
  const [isDeactivateModalOpen, setIsDeactivateModalOpen] = useState(false);
  const [deactivateEmployeeId, setDeactivateEmployeeId] = useState<string | null>(null);
  const [deactivateEmployeeName, setDeactivateEmployeeName] = useState('');
  const [deactivateReason, setDeactivateReason] = useState('Pedido de demissão');
  const [deactivateCustomReason, setDeactivateCustomReason] = useState('');

  const showNotification = (type: 'success' | 'error', message: string, requestId?: string) => {
    setToast({ type, message, requestId });
    setTimeout(() => {
      setToast(null);
    }, 5000);
  };

  // Search and filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [sectorFilter, setSectorFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  // Drawer 360 profile state
  const [selectedEmployee, setSelectedEmployee] = useState<any>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [drawerStats, setDrawerStats] = useState<any>({
    responseRate: 0,
    checkins: [],
    certificates: [],
    occurrences: []
  });
  const [loadingDrawer, setLoadingDrawer] = useState(false);

  const fetchEmployeeStats = async (empId: string) => {
    setLoadingDrawer(true);
    try {
      const checkinRes: any = await api.get(`/presence?pageSize=15`);
      const filteredCheckins = checkinRes.success && Array.isArray(checkinRes.items)
        ? checkinRes.items.filter((c: any) => c.employeeId === empId)
        : [];
      
      const totalCheckins = filteredCheckins.length;
      const respondedCheckins = filteredCheckins.filter((c: any) => c.status !== 'PENDING' && c.status !== 'NOT_RESPONDED').length;
      const rate = totalCheckins > 0 ? Math.round((respondedCheckins / totalCheckins) * 100) : 85;

      const occRes: any = await api.get(`/occurrences?pageSize=20`);
      const filteredOccs = occRes.success && Array.isArray(occRes.items)
        ? occRes.items.filter((o: any) => o.employeeId === empId)
        : [];

      const certRes: any = await api.get(`/medical-certificates`);
      const filteredCerts = certRes.success && Array.isArray(certRes.data)
        ? certRes.data.filter((c: any) => c.employeeId === empId)
        : [];

      setDrawerStats({
        responseRate: rate,
        checkins: filteredCheckins,
        certificates: filteredCerts,
        occurrences: filteredOccs
      });
    } catch (err) {
      console.error('Error fetching employee 360 stats:', err);
    } finally {
      setLoadingDrawer(false);
    }
  };

  const handleRowClick = (e: React.MouseEvent, emp: any) => {
    const target = e.target as HTMLElement;
    if (target.closest('button') || target.closest('a')) return;
    
    setSelectedEmployee(emp);
    setIsDrawerOpen(true);
    fetchEmployeeStats(emp.id);
  };

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

  const handleOpenDeactivateModal = (id: string, name: string) => {
    setDeactivateEmployeeId(id);
    setDeactivateEmployeeName(name);
    setDeactivateReason('Pedido de demissão');
    setDeactivateCustomReason('');
    setIsDeactivateModalOpen(true);
  };

  const handleConfirmDeactivate = async () => {
    if (!deactivateEmployeeId) return;
    const finalReason = deactivateReason === 'Outro (especificar)' 
      ? deactivateCustomReason.trim() 
      : deactivateReason;

    if (!finalReason) {
      alert('Por favor, especifique o motivo da inativação.');
      return;
    }

    setIsDeactivateModalOpen(false);
    setDeactivatingId(deactivateEmployeeId);
    setToast(null);

    try {
      const res = await api.patch(`/employees/${deactivateEmployeeId}/deactivate`, { reason: finalReason });
      if (res.success) {
        showNotification('success', `Funcionário ${deactivateEmployeeName} inativado com sucesso!`);
        fetchData(currentUser);
      } else {
        const errCode = res.error?.code || res.error || (res as any).error;
        if (['PLAN_LIMIT_EXCEEDED', 'PLAN_FEATURE_DISABLED', 'FEATURE_DISABLED', 'FORBIDDEN'].includes(errCode)) {
          setPlanError(errCode);
        } else {
          showNotification('error', res.error?.message || 'Erro ao inativar funcionário.', res.error?.requestId);
        }
      }
    } catch (err: any) {
      showNotification('error', 'Erro de conexão com o servidor.', err?.requestId);
    } finally {
      setDeactivatingId(null);
      setDeactivateEmployeeId(null);
    }
  };

  const handleActivate = async (id: string, name: string) => {
    if (activatingId) return;
    if (!confirm(`Tem certeza que deseja reativar o funcionário ${name}?`)) return;

    setActivatingId(id);
    setToast(null);

    try {
      const res = await api.patch(`/employees/${id}/activate`, {});
      if (res.success) {
        showNotification('success', `Funcionário ${name} reativado com sucesso!`);
        fetchData(currentUser);
      } else {
        const errCode = res.error?.code || res.error || (res as any).error;
        if (['PLAN_LIMIT_EXCEEDED', 'PLAN_FEATURE_DISABLED', 'FEATURE_DISABLED', 'FORBIDDEN'].includes(errCode)) {
          setPlanError(errCode);
        } else {
          showNotification('error', res.error?.message || 'Erro ao reativar funcionário.', res.error?.requestId);
        }
      }
    } catch (err: any) {
      showNotification('error', 'Erro de conexão com o servidor.', err?.requestId);
    } finally {
      setActivatingId(null);
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
      {/* Toast Notification */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 flex items-start gap-3 p-4 rounded-xl shadow-2xl border transition-all duration-300 max-w-md ${
          toast.type === 'success'
            ? 'bg-emerald-950/95 border-emerald-800/80 text-emerald-250'
            : 'bg-red-950/95 border-red-800/80 text-red-250'
        }`}>
          {toast.type === 'success' ? (
            <Check className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
          ) : (
            <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
          )}
          <div className="space-y-1">
            <p className="text-xs font-semibold leading-relaxed">{toast.message}</p>
            {toast.requestId && (
              <p className="text-[10px] opacity-70 font-mono">ID da Requisição: {toast.requestId}</p>
            )}
          </div>
        </div>
      )}

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
                  <tr 
                    key={emp.id} 
                    className="hover:bg-slate-800/20 transition-colors cursor-pointer"
                    onClick={(e) => handleRowClick(e, emp)}
                  >
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
                        <div className="space-y-1">
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-800 text-slate-500 border border-slate-700">Inativo</span>
                          {emp.inactivationReason && (
                            <p className="text-[10px] text-slate-500 italic max-w-[150px] truncate" title={emp.inactivationReason}>
                              Motivo: {emp.inactivationReason}
                            </p>
                          )}
                        </div>
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
                           {emp.status === 'ACTIVE' ? (
                            <button
                              onClick={() => handleOpenDeactivateModal(emp.id, emp.fullName)}
                              disabled={deactivatingId !== null || activatingId !== null}
                              className="p-1.5 rounded bg-red-950/20 hover:bg-red-900/30 text-red-400 hover:text-red-300 disabled:opacity-40 transition-colors border border-red-800/20 cursor-pointer disabled:cursor-not-allowed"
                              title="Inativar"
                            >
                              <UserX className="w-3.5 h-3.5" />
                            </button>
                          ) : (
                            <button
                              onClick={() => handleActivate(emp.id, emp.fullName)}
                              disabled={deactivatingId !== null || activatingId !== null}
                              className="p-1.5 rounded bg-emerald-950/20 hover:bg-emerald-900/30 text-emerald-450 hover:text-emerald-350 disabled:opacity-40 transition-colors border border-emerald-800/20 cursor-pointer disabled:cursor-not-allowed"
                              title="Reativar"
                            >
                              <Check className="w-3.5 h-3.5" />
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
      {/* Modal - Deactivate Employee with Reason */}
      {isDeactivateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm transition-opacity">
          <div className="relative w-full max-w-md bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-2xl flex flex-col">
            {/* Modal header */}
            <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
              <h2 className="text-lg font-bold text-white">
                Inativar Funcionário
              </h2>
              <button
                onClick={() => setIsDeactivateModalOpen(false)}
                className="text-slate-400 hover:text-slate-200 text-sm font-medium transition-colors"
              >
                Fechar
              </button>
            </div>

            {/* Modal content */}
            <div className="p-6 space-y-4">
              <p className="text-sm text-slate-400">
                Selecione o motivo da inativação para o funcionário <strong className="text-slate-200">{deactivateEmployeeName}</strong>:
              </p>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1.5 uppercase">Motivo Geral</label>
                  <select
                    value={deactivateReason}
                    onChange={(e) => setDeactivateReason(e.target.value)}
                    className="block w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all text-sm cursor-pointer"
                  >
                    <option value="Pedido de demissão">Pedido de demissão</option>
                    <option value="Demissão sem justa causa">Demissão sem justa causa</option>
                    <option value="Demissão por justa causa">Demissão por justa causa</option>
                    <option value="Término de contrato">Término de contrato</option>
                    <option value="Aposentadoria">Aposentadoria</option>
                    <option value="Outro (especificar)">Outro (especificar)</option>
                  </select>
                </div>

                {deactivateReason === 'Outro (especificar)' && (
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1.5 uppercase">Especificação</label>
                    <textarea
                      required
                      rows={3}
                      value={deactivateCustomReason}
                      onChange={(e) => setDeactivateCustomReason(e.target.value)}
                      placeholder="Digite o motivo específico..."
                      className="block w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all text-sm leading-relaxed"
                    />
                  </div>
                )}
              </div>

              {/* Modal footer */}
              <div className="pt-4 border-t border-slate-800 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsDeactivateModalOpen(false)}
                  className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-750 text-slate-350 text-xs font-semibold transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleConfirmDeactivate}
                  className="px-4 py-2 rounded-lg bg-red-650 hover:bg-red-550 text-white text-xs font-bold shadow-md shadow-red-600/10 transition-colors cursor-pointer"
                >
                  Inativar Colaborador
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      <PlanErrorAlert error={planError} onClose={() => setPlanError(null)} />

      {/* Employee 360 Details Drawer */}
      {isDrawerOpen && selectedEmployee && (
        <div className="fixed inset-0 z-40 flex justify-end">
          <div 
            className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
            onClick={() => setIsDrawerOpen(false)}
          />

          <div className="relative w-full max-w-lg h-full bg-slate-900 border-l border-slate-800 text-slate-100 flex flex-col z-50 shadow-2xl animate-slideIn">
            <div className="p-6 border-b border-slate-850 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-indigo-650/20 border border-indigo-500/30 flex items-center justify-center font-bold text-lg text-indigo-400 animate-pulse">
                  {selectedEmployee.fullName.charAt(0)}
                </div>
                <div>
                  <h3 className="text-base font-bold text-white leading-snug">{selectedEmployee.fullName}</h3>
                  <p className="text-xs text-slate-400">{selectedEmployee.jobTitle || 'Colaborador'} • {selectedEmployee.sector || 'Sem setor'}</p>
                </div>
              </div>
              <button 
                onClick={() => setIsDrawerOpen(false)}
                className="p-1 rounded bg-slate-850 border border-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer"
              >
                <span className="text-xs px-2 py-0.5 block font-mono">Fechar</span>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {loadingDrawer ? (
                <div className="flex flex-col items-center justify-center py-24 gap-3">
                  <div className="w-8 h-8 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
                  <span className="text-xs text-slate-500 font-semibold">Carregando perfil 360...</span>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 rounded-xl bg-slate-950/50 border border-slate-850 flex flex-col justify-between">
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Taxa de Resposta</span>
                      <div className="flex items-baseline gap-1.5 mt-2">
                        <span className="text-2xl font-extrabold text-indigo-400">{drawerStats.responseRate}%</span>
                      </div>
                      <p className="text-[10px] text-slate-500 mt-1 leading-normal">
                        Média de check-ins diários respondidos via WhatsApp.
                      </p>
                    </div>

                    <div className="p-4 rounded-xl bg-slate-950/50 border border-slate-850 flex flex-col justify-between">
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Ocorrências Ativas</span>
                      <div className="flex items-baseline gap-1.5 mt-2">
                        <span className="text-2xl font-extrabold text-rose-400">{drawerStats.occurrences.length}</span>
                      </div>
                      <p className="text-[10px] text-slate-500 mt-1 leading-normal">
                        Atrasos, faltas ou incidentes operacionais sem justificativa.
                      </p>
                    </div>
                  </div>

                  {/* Turnover Risk IA Banner */}
                  <div className="p-4 rounded-xl bg-gradient-to-r from-slate-950/70 to-indigo-950/20 border border-slate-850 flex items-center justify-between animate-fadeIn">
                    <div>
                      <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">Índice de Turnover & Burnout (IA Vision)</span>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xl font-extrabold text-indigo-400">{selectedEmployee.turnoverRiskScore ?? 15}%</span>
                        <span className="px-1.5 py-0.5 rounded text-[8px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 uppercase">Risco Baixo</span>
                      </div>
                      <p className="text-[10px] text-slate-400 mt-1 max-w-sm">
                        O algoritmo analisou assiduidade, pontualidade e atestados e calculou uma baixa propensão a turnover nas próximas semanas.
                      </p>
                    </div>
                    <Sparkles className="w-8 h-8 text-indigo-400/40 shrink-0" />
                  </div>

                  <div className="space-y-3">
                    <h4 className="text-xs font-extrabold text-white uppercase tracking-wider border-b border-slate-850 pb-2">Informações Cadastrais</h4>
                    <div className="grid grid-cols-2 gap-y-3 gap-x-4 text-xs">
                      <div>
                        <span className="text-slate-500">CPF</span>
                        <p className="text-slate-350 font-mono mt-0.5">{maskCpf(selectedEmployee.cpf)}</p>
                      </div>
                      <div>
                        <span className="text-slate-500">WhatsApp</span>
                        <p className="text-slate-350 mt-0.5">{selectedEmployee.whatsapp}</p>
                      </div>
                      <div>
                        <span className="text-slate-500">Modelo de Trabalho</span>
                        <p className="text-slate-350 mt-0.5">{selectedEmployee.workModel}</p>
                      </div>
                      <div>
                        <span className="text-slate-500">Escala de Horários</span>
                        <p className="text-indigo-400 font-semibold mt-0.5">{selectedEmployee.workSchedule?.name || 'Sem escala vinculada'}</p>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <h4 className="text-xs font-extrabold text-white uppercase tracking-wider border-b border-slate-850 pb-2">Últimos Check-ins de Campo</h4>
                    {drawerStats.checkins.length === 0 ? (
                      <p className="text-xs text-slate-500 italic">Nenhum check-in remoto registrado hoje.</p>
                    ) : (
                      <div className="space-y-2.5">
                        {drawerStats.checkins.map((c: any) => (
                          <div key={c.id} className="p-3 rounded-lg bg-slate-950/40 border border-slate-850 flex items-center justify-between text-xs">
                            <div>
                              <p className="font-semibold text-slate-200">{new Date(c.checkinDate).toLocaleDateString('pt-BR')}</p>
                              <p className="text-[10px] text-slate-500">Respondido em {c.respondedAt ? new Date(c.respondedAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '-'}</p>
                            </div>
                            <div className="flex items-center gap-2">
                              {c.isOutOfBounds && (
                                <span className="px-1.5 py-0.5 rounded text-[8px] font-extrabold bg-rose-500/10 text-rose-450 border border-rose-500/20">Fora do Perímetro</span>
                              )}
                              <span className={`px-2 py-0.5 rounded text-[9px] font-bold border ${
                                c.status === 'CONFIRMED' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/25' :
                                c.status === 'LATE' ? 'bg-amber-500/10 text-amber-400 border-amber-500/25' :
                                'bg-slate-800 text-slate-400 border-slate-700'
                              }`}>
                                {c.status}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="space-y-3">
                    <h4 className="text-xs font-extrabold text-white uppercase tracking-wider border-b border-slate-850 pb-2">Atestados Vinculados</h4>
                    {drawerStats.certificates.length === 0 ? (
                      <p className="text-xs text-slate-500 italic">Nenhum atestado médico registrado.</p>
                    ) : (
                      <div className="space-y-2">
                        {drawerStats.certificates.map((cert: any) => (
                          <div key={cert.id} className="p-3 rounded-lg bg-slate-950/40 border border-slate-850 flex items-center justify-between text-xs">
                            <div>
                              <p className="font-semibold text-slate-200">CID: {cert.cid || 'Não especificado'}</p>
                              <p className="text-[10px] text-slate-500 font-medium">Dias: {cert.daysOfAbsence} • De {new Date(cert.startDate).toLocaleDateString('pt-BR')}</p>
                            </div>
                            <span className="px-2 py-0.5 rounded text-[9px] font-bold bg-indigo-500/10 text-indigo-400 border border-indigo-500/25 uppercase">
                              {cert.status}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
