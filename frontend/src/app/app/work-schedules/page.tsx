'use client';

import React, { useState, useEffect } from 'react';
import { Plus, Search, Edit, ShieldAlert, Calendar, ToggleLeft, AlertCircle } from 'lucide-react';
import { api } from '@/lib/api';
import { getUser } from '@/lib/auth';

const DAYS_OF_WEEK = [
  { value: 'Monday', label: 'Segunda-feira' },
  { value: 'Tuesday', label: 'Terça-feira' },
  { value: 'Wednesday', label: 'Quarta-feira' },
  { value: 'Thursday', label: 'Quinta-feira' },
  { value: 'Friday', label: 'Sexta-feira' },
  { value: 'Saturday', label: 'Sábado' },
  { value: 'Sunday', label: 'Domingo' },
];

export default function WorkSchedulesPage() {
  const [schedules, setSchedules] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  const [searchQuery, setSearchQuery] = useState('');

  // Modal state
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<'schedules' | 'calendar'>('schedules');
  const [currentCalendarMonth, setCurrentCalendarMonth] = useState(new Date());
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');
  const [selectedScheduleId, setSelectedScheduleId] = useState<string | null>(null);

  // Form state
  const [formData, setFormData] = useState<any>({
    name: '',
    workDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
    expectedClockIn: '08:00',
    expectedClockOut: '17:00',
    toleranceMinutes: 10,
    requireRemoteCheckin: false,
    requireRemoteCheckout: false,
    latitude: '',
    longitude: '',
    radiusMeters: 200,
  });

  const [formError, setFormError] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const loggedUser = getUser();
    setCurrentUser(loggedUser);
    fetchData();
  }, []);

  const fetchData = async () => {
    setIsLoading(true);
    setError('');
    try {
      const res = await api.get('/work-schedules');
      if (res.success) {
        setSchedules(res.data || []);
      } else {
        setError(res.error?.message || 'Erro ao carregar jornadas.');
      }
    } catch (err) {
      setError('Erro ao se conectar com o servidor.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenCreateModal = () => {
    setModalMode('create');
    setFormData({
      name: '',
      workDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
      expectedClockIn: '08:00',
      expectedClockOut: '17:00',
      toleranceMinutes: 10,
      requireRemoteCheckin: false,
      requireRemoteCheckout: false,
      latitude: '',
      longitude: '',
      radiusMeters: 200,
    });
    setFormError('');
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (sch: any) => {
    setModalMode('edit');
    setSelectedScheduleId(sch.id);

    // Check if workDays is already parsed, or string
    let parsedDays = sch.workDays;
    if (typeof sch.workDays === 'string') {
      try {
        parsedDays = JSON.parse(sch.workDays);
      } catch {
        parsedDays = [];
      }
    }

    setFormData({
      name: sch.name || '',
      workDays: parsedDays || [],
      expectedClockIn: sch.expectedClockIn || '',
      expectedClockOut: sch.expectedClockOut || '',
      toleranceMinutes: sch.toleranceMinutes ?? 10,
      requireRemoteCheckin: sch.requireRemoteCheckin ?? false,
      requireRemoteCheckout: sch.requireRemoteCheckout ?? false,
      latitude: sch.latitude !== null && sch.latitude !== undefined ? String(sch.latitude) : '',
      longitude: sch.longitude !== null && sch.longitude !== undefined ? String(sch.longitude) : '',
      radiusMeters: sch.radiusMeters ?? 200,
    });
    setFormError('');
    setIsModalOpen(true);
  };

  const handleDayToggle = (day: string) => {
    const currentDays = [...formData.workDays];
    const index = currentDays.indexOf(day);
    if (index > -1) {
      currentDays.splice(index, 1);
    } else {
      currentDays.push(day);
    }
    setFormData({ ...formData, workDays: currentDays });
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    setIsSaving(true);

    try {
      const payload = {
        ...formData,
        latitude: formData.latitude !== '' ? parseFloat(formData.latitude) : null,
        longitude: formData.longitude !== '' ? parseFloat(formData.longitude) : null,
        radiusMeters: formData.radiusMeters !== '' ? parseInt(formData.radiusMeters, 10) : null,
      };
      let res;
      if (modalMode === 'create') {
        res = await api.post('/work-schedules', payload);
      } else {
        res = await api.patch(`/work-schedules/${selectedScheduleId}`, payload);
      }

      if (res.success) {
        setIsModalOpen(false);
        fetchData();
      } else {
        setFormError(res.error?.message || 'Erro ao salvar a jornada.');
      }
    } catch (err) {
      setFormError('Erro de conexão com o servidor.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeactivate = async (id: string, name: string) => {
    if (!confirm(`Tem certeza que deseja inativar a jornada "${name}"?`)) return;

    try {
      const res = await api.patch(`/work-schedules/${id}/deactivate`);
      if (res.success) {
        fetchData();
      } else {
        alert(res.error?.message || 'Erro ao inativar jornada.');
      }
    } catch (err) {
      alert('Erro de conexão com o servidor.');
    }
  };

  const canModify = currentUser && ['ADMIN', 'HR'].includes(currentUser.role);

  const filteredSchedules = schedules.filter((sch) =>
    sch.name.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  const formatWorkDays = (workDaysVal: any) => {
    let days: string[] = [];
    if (typeof workDaysVal === 'string') {
      try {
        days = JSON.parse(workDaysVal);
      } catch {
        return '-';
      }
    } else {
      days = workDaysVal || [];
    }

    const shortDaysMap: Record<string, string> = {
      Monday: 'Seg',
      Tuesday: 'Ter',
      Wednesday: 'Qua',
      Thursday: 'Qui',
      Friday: 'Sex',
      Saturday: 'Sáb',
      Sunday: 'Dom',
    };

    return days.map((d) => shortDaysMap[d] || d).join(', ');
  };

  return (
    <>
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white">Escalas de Trabalho</h1>
          <p className="text-slate-400 text-sm mt-1">
            Defina jornadas de entrada, saída, tolerâncias e obrigatoriedades de check-in operacional.
          </p>
        </div>

        {/* Create button (ADMIN/HR only) */}
        {canModify && (
          <button
            onClick={handleOpenCreateModal}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-sm transition-all shadow-md shadow-indigo-600/15"
          >
            <Plus className="w-4 h-4" />
            <span>Nova Escala</span>
          </button>
        )}
      </div>

      {/* Tab Switcher */}
      <div className="flex border-b border-slate-800 gap-6 mb-6">
        <button
          onClick={() => setActiveTab('schedules')}
          className={`pb-3 text-sm font-semibold transition-all border-b-2 cursor-pointer ${
            activeTab === 'schedules'
              ? 'border-indigo-500 text-white'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          Jornadas & Regras
        </button>
        <button
          onClick={() => setActiveTab('calendar')}
          className={`pb-3 text-sm font-semibold transition-all border-b-2 cursor-pointer ${
            activeTab === 'calendar'
              ? 'border-indigo-500 text-white'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          Calendário de Escalas (Shift Planner)
        </button>
      </div>

      {activeTab === 'schedules' && (
        <>
          {/* Filter and search bar */}
      <div className="flex flex-col md:flex-row gap-4 p-5 rounded-xl border border-slate-800 bg-slate-900 shadow-lg">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            type="text"
            placeholder="Buscar escala por nome..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="block w-full pl-10 pr-4 py-2 rounded-lg bg-slate-950 border border-slate-800 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all text-sm"
          />
        </div>
      </div>

      {/* Table Card */}
      <div className="rounded-xl border border-slate-800 bg-slate-900 overflow-hidden shadow-xl">
        {isLoading ? (
          <div className="py-20 flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
            <span className="text-sm text-slate-400">Carregando escalas...</span>
          </div>
        ) : error ? (
          <div className="py-16 text-center text-slate-400 flex flex-col items-center gap-3">
            <ShieldAlert className="w-12 h-12 text-red-500" />
            <p className="text-sm">{error}</p>
          </div>
        ) : filteredSchedules.length === 0 ? (
          <div className="py-20 text-center text-slate-500">
            Nenhuma escala de trabalho correspondente.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-400 border-collapse">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-900/50 text-slate-500 font-semibold text-xs uppercase tracking-wider">
                  <th className="px-6 py-3.5">Nome</th>
                  <th className="px-6 py-3.5">Dias da Semana</th>
                  <th className="px-6 py-3.5">Entrada / Saída</th>
                  <th className="px-6 py-3.5">Tolerância</th>
                  <th className="px-6 py-3.5">Check-in Remoto</th>
                  <th className="px-6 py-3.5">Status</th>
                  {canModify && <th className="px-6 py-3.5 text-right">Ações</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filteredSchedules.map((sch) => (
                  <tr key={sch.id} className="hover:bg-slate-800/20 transition-colors">
                    <td className="px-6 py-4 font-semibold text-slate-200">{sch.name}</td>
                    <td className="px-6 py-4 text-xs font-medium text-slate-300">
                      <span className="flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                        {formatWorkDays(sch.workDays)}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-slate-200 font-mono text-xs">
                      {sch.expectedClockIn}h - {sch.expectedClockOut}h
                    </td>
                    <td className="px-6 py-4 text-slate-300">{sch.toleranceMinutes} min</td>
                    <td className="px-6 py-4">
                      {sch.requireRemoteCheckin || sch.requireRemoteCheckout ? (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">Obrigatório</span>
                      ) : (
                        <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-800 text-slate-500 border border-slate-700">Desabilitado</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      {sch.isActive ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">Ativo</span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-800 text-slate-500 border border-slate-700">Inativo</span>
                      )}
                    </td>
                    {canModify && (
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleOpenEditModal(sch)}
                            className="p-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
                            title="Editar"
                          >
                            <Edit className="w-3.5 h-3.5" />
                          </button>
                          {sch.isActive && (
                            <button
                              onClick={() => handleDeactivate(sch.id, sch.name)}
                              className="p-1.5 rounded bg-red-950/20 hover:bg-red-900/30 text-red-400 hover:text-red-300 transition-colors border border-red-800/20"
                              title="Inativar"
                            >
                              <ToggleLeft className="w-3.5 h-3.5" />
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
      </>
      )}

      {activeTab === 'calendar' && (
        <div className="space-y-6 animate-fadeIn">
          {/* Calendar Controller Header */}
          <div className="p-4 rounded-xl border border-slate-800 bg-slate-900 shadow-lg flex items-center justify-between">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">
              Calendário Mensal de Escalas (Shift Planner)
            </h3>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setCurrentCalendarMonth(new Date(currentCalendarMonth.getFullYear(), currentCalendarMonth.getMonth() - 1, 1))}
                className="px-3 py-1.5 rounded bg-slate-850 hover:bg-slate-750 border border-slate-800 text-slate-350 font-bold text-xs transition-colors cursor-pointer"
              >
                &larr; Mês Anterior
              </button>
              <span className="text-sm font-extrabold text-white min-w-[120px] text-center capitalize">
                {currentCalendarMonth.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}
              </span>
              <button
                onClick={() => setCurrentCalendarMonth(new Date(currentCalendarMonth.getFullYear(), currentCalendarMonth.getMonth() + 1, 1))}
                className="px-3 py-1.5 rounded bg-slate-850 hover:bg-slate-750 border border-slate-800 text-slate-350 font-bold text-xs transition-colors cursor-pointer"
              >
                Próximo Mês &rarr;
              </button>
            </div>
          </div>

          {/* Calendar Grid */}
          <div className="rounded-xl border border-slate-800 bg-slate-900 overflow-hidden shadow-xl p-4 space-y-2">
            <div className="grid grid-cols-7 gap-2 text-center text-xs font-bold text-slate-500 uppercase tracking-wider border-b border-slate-800 pb-2">
              <div>Dom</div>
              <div>Seg</div>
              <div>Ter</div>
              <div>Qua</div>
              <div>Qui</div>
              <div>Sex</div>
              <div>Sáb</div>
            </div>

            <div className="grid grid-cols-7 gap-2">
              {(() => {
                const year = currentCalendarMonth.getFullYear();
                const month = currentCalendarMonth.getMonth();
                const firstDay = new Date(year, month, 1);
                const firstDayOfWeek = firstDay.getDay();
                const totalDays = new Date(year, month + 1, 0).getDate();
                const days = [];

                for (let i = firstDayOfWeek - 1; i >= 0; i--) {
                  const prevDate = new Date(year, month, -i);
                  days.push({ date: prevDate, isCurrentMonth: false });
                }

                for (let i = 1; i <= totalDays; i++) {
                  days.push({ date: new Date(year, month, i), isCurrentMonth: true });
                }

                const totalGrid = Math.ceil(days.length / 7) * 7;
                const remaining = totalGrid - days.length;
                for (let i = 1; i <= remaining; i++) {
                  days.push({ date: new Date(year, month + 1, i), isCurrentMonth: false });
                }

                return days.map(({ date, isCurrentMonth }, idx) => {
                  const dayOfWeekEnglish = date.toLocaleDateString('en-US', { weekday: 'long' });
                  const activeSchedules = schedules.filter((s) => {
                    const days = s.workDays || [];
                    return days.includes(dayOfWeekEnglish);
                  });

                  return (
                    <div
                      key={idx}
                      className={`min-h-[100px] p-2 rounded-lg border flex flex-col justify-between transition-colors ${
                        isCurrentMonth
                          ? 'bg-slate-950/40 border-slate-850 hover:bg-slate-950/70'
                          : 'bg-slate-900/20 border-slate-900 text-slate-650'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className={`text-xs font-bold ${isCurrentMonth ? 'text-white' : 'text-slate-600'}`}>
                          {date.getDate()}
                        </span>
                        {date.toDateString() === new Date().toDateString() && (
                          <span className="px-1.5 py-0.5 rounded bg-indigo-500/20 border border-indigo-500/30 text-indigo-400 text-[8px] font-bold uppercase">
                            Hoje
                          </span>
                        )}
                      </div>

                      <div className="flex-1 mt-2 space-y-1.5 overflow-y-auto max-h-[70px]">
                        {activeSchedules.map((sch) => (
                          <div
                            key={sch.id}
                            className="px-1.5 py-1 rounded bg-indigo-950/30 border border-indigo-500/20 text-[9px] font-semibold text-indigo-300 leading-tight"
                            title={`${sch.name}: ${sch.expectedClockIn} - ${sch.expectedClockOut}`}
                          >
                            <p className="truncate">{sch.name}</p>
                            <p className="text-[8px] text-slate-500 font-mono">{sch.expectedClockIn} - {sch.expectedClockOut}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                });
              })()}
            </div>
          </div>
        </div>
      )}

      {/* Modal - Create/Edit Work Schedule */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm transition-opacity">
          <div className="relative w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
            <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
              <h2 className="text-xl font-bold text-white">
                {modalMode === 'create' ? 'Cadastrar Nova Escala' : 'Editar Escala'}
              </h2>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-200 text-sm font-medium transition-colors"
              >
                Fechar
              </button>
            </div>

            <form onSubmit={handleSave} className="flex-1 overflow-y-auto p-6 space-y-6">
              {formError && (
                <div className="flex items-center gap-3 p-4 rounded-lg bg-red-950/50 border border-red-800 text-red-200 text-sm">
                  <AlertCircle className="w-5 h-5 text-red-400 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Nome da Escala</label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="block w-full px-4 py-2 rounded-lg bg-slate-950 border border-slate-800 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all text-sm"
                    placeholder="Ex: Escala Administrativa 8-17"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-3">Dias da Semana</label>
                  <div className="flex flex-wrap gap-2">
                    {DAYS_OF_WEEK.map((day) => {
                      const isSelected = formData.workDays.includes(day.value);
                      return (
                        <button
                          type="button"
                          key={day.value}
                          onClick={() => handleDayToggle(day.value)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                            isSelected
                              ? 'bg-indigo-600 border-indigo-500 text-white'
                              : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                          }`}
                        >
                          {day.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">Entrada Esperada</label>
                    <input
                      type="text"
                      required
                      value={formData.expectedClockIn}
                      onChange={(e) => setFormData({ ...formData, expectedClockIn: e.target.value })}
                      className="block w-full px-4 py-2 rounded-lg bg-slate-950 border border-slate-800 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all text-sm font-mono"
                      placeholder="HH:MM"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">Saída Esperada</label>
                    <input
                      type="text"
                      required
                      value={formData.expectedClockOut}
                      onChange={(e) => setFormData({ ...formData, expectedClockOut: e.target.value })}
                      className="block w-full px-4 py-2 rounded-lg bg-slate-950 border border-slate-800 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all text-sm font-mono"
                      placeholder="HH:MM"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">Tolerância (minutos)</label>
                    <input
                      type="number"
                      required
                      min={0}
                      value={formData.toleranceMinutes}
                      onChange={(e) => setFormData({ ...formData, toleranceMinutes: parseInt(e.target.value, 10) || 0 })}
                      className="block w-full px-4 py-2 rounded-lg bg-slate-950 border border-slate-800 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all text-sm font-mono"
                    />
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-800 space-y-4">
                  <h4 className="text-sm font-bold text-white">Configurações para Trabalho Remoto</h4>

                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold text-slate-300">Exigir Check-in Remoto</p>
                      <p className="text-xs text-slate-500">Funcionário deve confirmar presença no início da jornada pelo WhatsApp</p>
                    </div>
                    <input
                      type="checkbox"
                      checked={formData.requireRemoteCheckin}
                      onChange={(e) => setFormData({ ...formData, requireRemoteCheckin: e.target.checked })}
                      className="w-4 h-4 rounded border-slate-800 bg-slate-950 text-indigo-600 focus:ring-indigo-500/20"
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold text-slate-300">Exigir Check-out Remoto</p>
                      <p className="text-xs text-slate-500">Funcionário deve confirmar saída no término da jornada pelo WhatsApp</p>
                    </div>
                    <input
                      type="checkbox"
                      checked={formData.requireRemoteCheckout}
                      onChange={(e) => setFormData({ ...formData, requireRemoteCheckout: e.target.checked })}
                      className="w-4 h-4 rounded border-slate-800 bg-slate-950 text-indigo-600 focus:ring-indigo-500/20"
                    />
                  </div>
                  </div>

                  {/* Geofencing Fields */}
                  <div className="pt-4 border-t border-slate-800 space-y-4 animate-fadeIn">
                    <h4 className="text-sm font-bold text-white">Cerca Geográfica (Geofencing)</h4>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="block text-xs font-semibold text-slate-400 uppercase">Latitude</label>
                        <input
                          type="number"
                          step="any"
                          placeholder="-23.55052"
                          value={formData.latitude}
                          onChange={(e) => setFormData({ ...formData, latitude: e.target.value })}
                          className="block w-full px-4 py-2 rounded-lg bg-slate-950 border border-slate-800 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm font-mono"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="block text-xs font-semibold text-slate-400 uppercase">Longitude</label>
                        <input
                          type="number"
                          step="any"
                          placeholder="-46.633308"
                          value={formData.longitude}
                          onChange={(e) => setFormData({ ...formData, longitude: e.target.value })}
                          className="block w-full px-4 py-2 rounded-lg bg-slate-950 border border-slate-800 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm font-mono"
                        />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label className="block text-xs font-semibold text-slate-400 uppercase">Raio Limite (metros)</label>
                      <input
                        type="number"
                        placeholder="200"
                        value={formData.radiusMeters}
                        onChange={(e) => setFormData({ ...formData, radiusMeters: e.target.value })}
                        className="block w-full px-4 py-2 rounded-lg bg-slate-950 border border-slate-800 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm font-mono"
                      />
                      <p className="text-[10px] text-slate-500 leading-normal">
                        Raio de tolerância para validar a resposta do check-in remoto. Se o colaborador responder fora do perímetro, a ocorrência correspondente indicará o desvio.
                      </p>
                    </div>
                  </div>
                </div>

              <div className="pt-6 border-t border-slate-800 flex items-center justify-end gap-3">
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
    </>
  );
}
