'use client';

import React, { useState, useEffect } from 'react';
import { Bell, Plus, Trash2, Save, Clock, Zap, ShieldAlert, CheckCircle2, AlertTriangle, X, PlayCircle, ToggleLeft, ToggleRight } from 'lucide-react';
import { api } from '@/lib/api';
import { getUser } from '@/lib/auth';

interface EventCatalogEntry {
  eventType: string;
  status: string;
  aggregateType: string;
  description: string;
}

interface PolicyStep {
  id?: string;
  stepOrder: number;
  delayMinutes: number;
  recipientType: string;
  recipientReference?: string | null;
  channels: string[];
  fallbackMode: 'PARALLEL' | 'SEQUENTIAL';
  stopOnAcknowledgment: boolean;
  stopOnResolution: boolean;
}

interface Policy {
  id: string;
  name: string;
  eventType: string;
  isActive: boolean;
  priority: 'LOW' | 'NORMAL' | 'HIGH' | 'CRITICAL';
  acknowledgmentRequired: boolean;
  maxEscalationLevel: number;
  quietHoursBehavior: 'DEFER' | 'ALLOW_HIGH_PRIORITY' | 'IGNORE';
  steps: PolicyStep[];
}

const RECIPIENT_TYPES = ['EMPLOYEE', 'DIRECT_MANAGER', 'HR', 'ADMIN', 'SPECIFIC_USER', 'ROLE', 'REQUESTER', 'EVENT_ACTOR'];
const CHANNELS = ['IN_APP', 'WEB_PUSH', 'WHATSAPP', 'EMAIL'];

function emptyStep(order: number): PolicyStep {
  return { stepOrder: order, delayMinutes: 0, recipientType: 'ADMIN', channels: ['IN_APP'], fallbackMode: 'PARALLEL', stopOnAcknowledgment: true, stopOnResolution: true };
}

function emptyPolicy(): Omit<Policy, 'id'> {
  return {
    name: '',
    eventType: '',
    isActive: true,
    priority: 'NORMAL',
    acknowledgmentRequired: false,
    maxEscalationLevel: 1,
    quietHoursBehavior: 'DEFER',
    steps: [emptyStep(1)],
  };
}

export default function NotificationPoliciesPage() {
  const [user, setUser] = useState<any>(null);
  const [catalog, setCatalog] = useState<EventCatalogEntry[]>([]);
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [editing, setEditing] = useState<Policy | (Omit<Policy, 'id'> & { id?: string }) | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  const [testResult, setTestResult] = useState<{ policyId: string; data: any } | null>(null);
  const [testing, setTesting] = useState(false);

  // Quiet hours (company-level, distinct from the legacy per-preference quiet hours in /app/settings/notifications)
  const [quietHours, setQuietHours] = useState({ timezone: 'America/Sao_Paulo', startTime: '22:00', endTime: '07:00', daysOfWeek: [0, 1, 2, 3, 4, 5, 6], isActive: false });
  const [quietHoursSaving, setQuietHoursSaving] = useState(false);
  const [quietHoursMsg, setQuietHoursMsg] = useState('');

  useEffect(() => {
    setUser(getUser());
    fetchAll();
  }, []);

  const fetchAll = async () => {
    setLoading(true);
    setError('');
    try {
      const [catalogRes, policiesRes, quietHoursRes]: any[] = await Promise.all([
        api.get('/notification-policies/event-catalog'),
        api.get('/notification-policies'),
        api.get('/notification-quiet-hours'),
      ]);
      if (catalogRes.success) setCatalog(catalogRes.data);
      if (policiesRes.success) setPolicies(policiesRes.data);
      if (quietHoursRes.success && quietHoursRes.data) {
        setQuietHours({
          timezone: quietHoursRes.data.timezone,
          startTime: quietHoursRes.data.startTime,
          endTime: quietHoursRes.data.endTime,
          daysOfWeek: quietHoursRes.data.daysOfWeek,
          isActive: quietHoursRes.data.isActive,
        });
      }
      if (!catalogRes.success || !policiesRes.success) {
        setError('Erro ao carregar políticas de notificação.');
      }
    } catch (err) {
      setError('Erro de conexão ao servidor.');
    } finally {
      setLoading(false);
    }
  };

  const saveQuietHours = async () => {
    setQuietHoursSaving(true);
    setQuietHoursMsg('');
    try {
      const res: any = await api.put('/notification-quiet-hours', quietHours);
      if (res.success) {
        setQuietHoursMsg('Horário de silêncio salvo.');
      } else {
        setQuietHoursMsg(res.error?.message || 'Erro ao salvar.');
      }
    } catch {
      setQuietHoursMsg('Erro de conexão.');
    } finally {
      setQuietHoursSaving(false);
    }
  };

  const toggleDay = (day: number) => {
    setQuietHours((prev) => ({
      ...prev,
      daysOfWeek: prev.daysOfWeek.includes(day) ? prev.daysOfWeek.filter((d) => d !== day) : [...prev.daysOfWeek, day].sort(),
    }));
  };

  const openCreate = () => setEditing(emptyPolicy());
  const openEdit = (policy: Policy) => setEditing({ ...policy, steps: policy.steps.map((s) => ({ ...s })) });
  const closeEditor = () => {
    setEditing(null);
    setSaveError('');
  };

  const addStep = () => {
    if (!editing) return;
    setEditing({ ...editing, steps: [...editing.steps, emptyStep(editing.steps.length + 1)] });
  };

  const removeStep = (index: number) => {
    if (!editing) return;
    const steps = editing.steps.filter((_, i) => i !== index).map((s, i) => ({ ...s, stepOrder: i + 1 }));
    setEditing({ ...editing, steps });
  };

  const updateStep = (index: number, patch: Partial<PolicyStep>) => {
    if (!editing) return;
    const steps = editing.steps.map((s, i) => (i === index ? { ...s, ...patch } : s));
    setEditing({ ...editing, steps });
  };

  const toggleChannel = (index: number, channel: string) => {
    if (!editing) return;
    const step = editing.steps[index];
    const channels = step.channels.includes(channel) ? step.channels.filter((c) => c !== channel) : [...step.channels, channel];
    updateStep(index, { channels });
  };

  const handleSave = async () => {
    if (!editing) return;
    setSaving(true);
    setSaveError('');
    try {
      const isNew = !('id' in editing) || !editing.id;
      const payload = {
        name: editing.name,
        eventType: editing.eventType,
        priority: editing.priority,
        acknowledgmentRequired: editing.acknowledgmentRequired,
        maxEscalationLevel: editing.maxEscalationLevel,
        quietHoursBehavior: editing.quietHoursBehavior,
        steps: editing.steps,
      };
      const res: any = isNew
        ? await api.post('/notification-policies', payload)
        : await api.patch(`/notification-policies/${(editing as Policy).id}`, payload);

      if (res.success) {
        closeEditor();
        fetchAll();
      } else {
        setSaveError(res.error?.message || 'Erro ao salvar política.');
      }
    } catch {
      setSaveError('Erro de conexão ao salvar.');
    } finally {
      setSaving(false);
    }
  };

  const handleDisable = async (policyId: string) => {
    if (!confirm('Desativar esta política? Ela para de disparar novos alertas, mas o histórico é preservado.')) return;
    const res: any = await api.delete(`/notification-policies/${policyId}`);
    if (res.success) fetchAll();
  };

  const handleTest = async (policyId: string) => {
    setTesting(true);
    setTestResult(null);
    try {
      const res: any = await api.post(`/notification-policies/${policyId}/test`, { dryRun: true, context: {} });
      if (res.success) {
        setTestResult({ policyId, data: res.data });
      } else {
        setTestResult({ policyId, data: { warnings: [res.error?.message || 'Erro ao testar.'] } });
      }
    } finally {
      setTesting(false);
    }
  };

  if (user && !['ADMIN', 'HR'].includes(user.role)) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-10 text-center">
        <ShieldAlert className="w-10 h-10 text-rose-500 mx-auto mb-3" />
        <p className="text-sm font-bold text-white">Acesso restrito a ADMIN/HR.</p>
      </div>
    );
  }

  const dayLabels = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
          <Zap className="w-6 h-6 text-indigo-500" />
          Políticas de Notificação e Escalonamento
        </h1>
        <p className="text-sm text-slate-400 mt-1">
          Configure quem é avisado, por quais canais e com qual escalonamento para cada evento operacional.
        </p>
      </div>

      {/* Quiet Hours Card */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-slate-100 flex items-center gap-2">
            <Clock className="w-4.5 h-4.5 text-indigo-400" />
            Horário de Silêncio (Quiet Hours) da Empresa
          </h2>
          <button
            type="button"
            onClick={() => setQuietHours((prev) => ({ ...prev, isActive: !prev.isActive }))}
            className="text-slate-400 hover:text-white cursor-pointer"
          >
            {quietHours.isActive ? <ToggleRight className="w-8 h-8 text-indigo-500" /> : <ToggleLeft className="w-8 h-8 text-slate-600" />}
          </button>
        </div>
        <p className="text-xs text-slate-400">
          Define o piso organizacional: notificações de prioridade NORMAL/LOW são adiadas durante este período, salvo se a política do evento marcar "Ignorar Silêncio" ou "Permitir Alta Prioridade".
        </p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div>
            <label className="text-[10px] text-slate-400 font-bold block mb-1">Fuso horário</label>
            <input value={quietHours.timezone} onChange={(e) => setQuietHours({ ...quietHours, timezone: e.target.value })} className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200" />
          </div>
          <div>
            <label className="text-[10px] text-slate-400 font-bold block mb-1">Início</label>
            <input type="time" value={quietHours.startTime} onChange={(e) => setQuietHours({ ...quietHours, startTime: e.target.value })} className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200" />
          </div>
          <div>
            <label className="text-[10px] text-slate-400 font-bold block mb-1">Fim</label>
            <input type="time" value={quietHours.endTime} onChange={(e) => setQuietHours({ ...quietHours, endTime: e.target.value })} className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200" />
          </div>
        </div>
        <div>
          <label className="text-[10px] text-slate-400 font-bold block mb-1.5">Dias em que o início se aplica</label>
          <div className="flex gap-1.5 flex-wrap">
            {dayLabels.map((label, day) => (
              <button
                key={day}
                type="button"
                onClick={() => toggleDay(day)}
                className={`px-2.5 py-1.5 rounded-lg text-[10px] font-bold border cursor-pointer transition-colors ${
                  quietHours.daysOfWeek.includes(day) ? 'bg-indigo-600 border-indigo-500 text-white' : 'bg-slate-950 border-slate-800 text-slate-400'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center justify-end gap-3">
          {quietHoursMsg && <span className="text-xs text-slate-400">{quietHoursMsg}</span>}
          <button
            onClick={saveQuietHours}
            disabled={quietHoursSaving}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-xs font-bold text-white rounded-lg flex items-center gap-1.5 cursor-pointer"
          >
            <Save className="w-3.5 h-3.5" />
            {quietHoursSaving ? 'Salvando...' : 'Salvar Horário de Silêncio'}
          </button>
        </div>
      </div>

      {/* Policies List */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-slate-100 flex items-center gap-2">
            <Bell className="w-4.5 h-4.5 text-indigo-400" />
            Políticas por Evento
          </h2>
          <button onClick={openCreate} className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-xs font-bold text-white rounded-lg flex items-center gap-1.5 cursor-pointer">
            <Plus className="w-3.5 h-3.5" />
            Nova Política
          </button>
        </div>

        {loading ? (
          <div className="py-10 text-center text-slate-500 text-xs">Carregando políticas...</div>
        ) : error ? (
          <div className="py-10 text-center text-rose-400 text-xs">{error}</div>
        ) : policies.length === 0 ? (
          <div className="py-10 text-center text-slate-500 text-xs italic">Nenhuma política configurada ainda. Eventos sem política não geram alertas automáticos.</div>
        ) : (
          <div className="border border-slate-800 rounded-lg overflow-hidden">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-950/60 border-b border-slate-800 text-slate-400 font-semibold">
                  <th className="p-3">Nome</th>
                  <th className="p-3">Evento</th>
                  <th className="p-3">Prioridade</th>
                  <th className="p-3">Passos</th>
                  <th className="p-3">Status</th>
                  <th className="p-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-slate-300">
                {policies.map((policy) => (
                  <React.Fragment key={policy.id}>
                    <tr className="hover:bg-slate-950/10">
                      <td className="p-3 font-semibold text-slate-200">{policy.name}</td>
                      <td className="p-3 text-slate-400 font-mono text-[11px]">{policy.eventType}</td>
                      <td className="p-3">{policy.priority}</td>
                      <td className="p-3">{policy.steps.length}</td>
                      <td className="p-3">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${policy.isActive ? 'bg-emerald-500/10 text-emerald-400' : 'bg-slate-700/30 text-slate-500'}`}>
                          {policy.isActive ? 'Ativa' : 'Desativada'}
                        </span>
                      </td>
                      <td className="p-3 text-right space-x-2 whitespace-nowrap">
                        <button onClick={() => handleTest(policy.id)} disabled={testing} className="text-slate-400 hover:text-indigo-400 cursor-pointer" title="Testar (dry-run, não envia nada real)">
                          <PlayCircle className="w-4 h-4 inline" />
                        </button>
                        <button onClick={() => openEdit(policy)} className="text-slate-400 hover:text-white cursor-pointer text-[11px] font-bold">
                          Editar
                        </button>
                        {policy.isActive && (
                          <button onClick={() => handleDisable(policy.id)} className="text-slate-400 hover:text-rose-400 cursor-pointer" title="Desativar">
                            <Trash2 className="w-4 h-4 inline" />
                          </button>
                        )}
                      </td>
                    </tr>
                    {testResult?.policyId === policy.id && (
                      <tr>
                        <td colSpan={6} className="p-3 bg-slate-950/40">
                          <div className="text-[11px] space-y-1">
                            <p className="font-bold text-indigo-400">Resultado do teste (dry-run — nenhuma mensagem real foi enviada):</p>
                            {testResult.data.warnings?.length > 0 && (
                              <ul className="text-amber-400 list-disc pl-4">
                                {testResult.data.warnings.map((w: string, i: number) => <li key={i}>{w}</li>)}
                              </ul>
                            )}
                            {testResult.data.steps?.map((s: any, i: number) => (
                              <p key={i} className="text-slate-400">
                                Passo {s.stepOrder}: {s.resolvedRecipientCount} destinatário(s) resolvido(s) via {s.recipientType}, canais: {s.channels.join(', ')}
                              </p>
                            ))}
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Editor Modal */}
      {editing && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6 space-y-5">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-white">{'id' in editing && editing.id ? 'Editar Política' : 'Nova Política'}</h2>
              <button onClick={closeEditor} className="text-slate-400 hover:text-white cursor-pointer"><X className="w-5 h-5" /></button>
            </div>

            {saveError && (
              <div className="bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs rounded-lg p-3 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" /> {saveError}
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] text-slate-400 font-bold block mb-1">Nome da política</label>
                <input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200" />
              </div>
              <div>
                <label className="text-[10px] text-slate-400 font-bold block mb-1">Evento</label>
                <select
                  value={editing.eventType}
                  onChange={(e) => setEditing({ ...editing, eventType: e.target.value })}
                  disabled={'id' in editing && Boolean(editing.id)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 disabled:opacity-50"
                >
                  <option value="">Selecione...</option>
                  {catalog.map((e) => <option key={e.eventType} value={e.eventType}>{e.eventType}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[10px] text-slate-400 font-bold block mb-1">Prioridade</label>
                <select value={editing.priority} onChange={(e) => setEditing({ ...editing, priority: e.target.value as any })} className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200">
                  <option value="LOW">LOW</option>
                  <option value="NORMAL">NORMAL</option>
                  <option value="HIGH">HIGH</option>
                  <option value="CRITICAL">CRITICAL</option>
                </select>
              </div>
              <div>
                <label className="text-[10px] text-slate-400 font-bold block mb-1">Comportamento de silêncio</label>
                <select value={editing.quietHoursBehavior} onChange={(e) => setEditing({ ...editing, quietHoursBehavior: e.target.value as any })} className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200">
                  <option value="DEFER">Adiar (respeita horário de silêncio)</option>
                  <option value="ALLOW_HIGH_PRIORITY">Permitir se HIGH/CRITICAL</option>
                  <option value="IGNORE">Ignorar sempre</option>
                </select>
              </div>
              <div>
                <label className="text-[10px] text-slate-400 font-bold block mb-1">Nível máximo de escalonamento</label>
                <input type="number" min={1} value={editing.maxEscalationLevel} onChange={(e) => setEditing({ ...editing, maxEscalationLevel: parseInt(e.target.value, 10) || 1 })} className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200" />
              </div>
              <div className="flex items-center gap-2 mt-5">
                <input type="checkbox" checked={editing.acknowledgmentRequired} onChange={(e) => setEditing({ ...editing, acknowledgmentRequired: e.target.checked })} className="cursor-pointer" />
                <label className="text-xs text-slate-300">Exige confirmação (ACK) explícita</label>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold text-slate-200">Passos de Escalonamento</h3>
                <button onClick={addStep} className="text-[11px] font-bold text-indigo-400 hover:text-indigo-300 cursor-pointer flex items-center gap-1">
                  <Plus className="w-3.5 h-3.5" /> Adicionar passo
                </button>
              </div>

              {editing.steps.map((step, index) => (
                <div key={index} className="bg-slate-950 border border-slate-800 rounded-lg p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-indigo-400">Passo {step.stepOrder}</span>
                    {editing.steps.length > 1 && (
                      <button onClick={() => removeStep(index)} className="text-slate-500 hover:text-rose-400 cursor-pointer"><Trash2 className="w-3.5 h-3.5" /></button>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[10px] text-slate-400 font-bold block mb-1">Atraso desde o passo anterior (minutos)</label>
                      <input type="number" min={0} value={step.delayMinutes} onChange={(e) => updateStep(index, { delayMinutes: parseInt(e.target.value, 10) || 0 })} className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200" />
                    </div>
                    <div>
                      <label className="text-[10px] text-slate-400 font-bold block mb-1">Destinatário</label>
                      <select value={step.recipientType} onChange={(e) => updateStep(index, { recipientType: e.target.value, recipientReference: null })} className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200">
                        {RECIPIENT_TYPES.map((rt) => <option key={rt} value={rt}>{rt}</option>)}
                      </select>
                    </div>
                    {(step.recipientType === 'SPECIFIC_USER' || step.recipientType === 'ROLE') && (
                      <div className="col-span-2">
                        <label className="text-[10px] text-slate-400 font-bold block mb-1">{step.recipientType === 'SPECIFIC_USER' ? 'ID do usuário' : 'Nome do papel (ADMIN/HR/MANAGER/VIEWER)'}</label>
                        <input value={step.recipientReference ?? ''} onChange={(e) => updateStep(index, { recipientReference: e.target.value })} className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200" />
                      </div>
                    )}
                    <div className="col-span-2">
                      <label className="text-[10px] text-slate-400 font-bold block mb-1.5">Canais</label>
                      <div className="flex gap-1.5 flex-wrap">
                        {CHANNELS.map((ch) => (
                          <button key={ch} type="button" onClick={() => toggleChannel(index, ch)} className={`px-2.5 py-1 rounded-lg text-[10px] font-bold border cursor-pointer ${step.channels.includes(ch) ? 'bg-indigo-600 border-indigo-500 text-white' : 'bg-slate-900 border-slate-800 text-slate-400'}`}>
                            {ch}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <label className="text-[10px] text-slate-400 font-bold block mb-1">Modo de fallback entre canais</label>
                      <select value={step.fallbackMode} onChange={(e) => updateStep(index, { fallbackMode: e.target.value as any })} className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200">
                        <option value="PARALLEL">Paralelo (todos ao mesmo tempo)</option>
                        <option value="SEQUENTIAL">Sequencial (só cai pro próximo se o anterior falhar de forma permanente)</option>
                      </select>
                    </div>
                    <div className="flex flex-col justify-end gap-1.5">
                      <label className="flex items-center gap-1.5 text-[10px] text-slate-300">
                        <input type="checkbox" checked={step.stopOnAcknowledgment} onChange={(e) => updateStep(index, { stopOnAcknowledgment: e.target.checked })} className="cursor-pointer" />
                        Confirmação (ACK) interrompe este passo
                      </label>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button onClick={closeEditor} className="px-4 py-2 text-xs font-bold text-slate-400 hover:text-white cursor-pointer">Cancelar</button>
              <button onClick={handleSave} disabled={saving || !editing.name || !editing.eventType} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-xs font-bold text-white rounded-lg flex items-center gap-1.5 cursor-pointer">
                <Save className="w-3.5 h-3.5" />
                {saving ? 'Salvando...' : 'Salvar Política'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
