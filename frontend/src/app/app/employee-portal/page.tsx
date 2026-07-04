'use client';

import React, { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import {
  Clock,
  Calendar,
  User,
  ArrowRight,
  TrendingUp,
  PlusCircle,
  FileText,
  Activity,
  AlertCircle
} from 'lucide-react';

export default function EmployeePortalPage() {
  const [profile, setProfile] = useState<any>(null);
  const [timesheet, setTimesheet] = useState<any[]>([]);
  const [hourBank, setHourBank] = useState<any>({ balance: 0, transactions: [] });
  const [leaves, setLeaves] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // New leave request form state
  const [showLeaveForm, setShowLeaveForm] = useState(false);
  const [leaveForm, setLeaveForm] = useState({
    startDate: '',
    endDate: '',
    type: 'FERIAS',
    justification: ''
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const profRes = await api.get('/employee-portal/me');
      if (!profRes.success) {
        setError(profRes.error?.message || 'Nenhum colaborador associado a esta conta de usuário.');
        setLoading(false);
        return;
      }
      setProfile(profRes.data);

      // Fetch other data in parallel
      const [timeRes, bankRes, leaveRes] = await Promise.all([
        api.get('/employee-portal/timesheet'),
        api.get('/employee-portal/hour-bank'),
        api.get('/employee-portal/leaves')
      ]);

      if (timeRes.success) setTimesheet(timeRes.data);
      if (bankRes.success) setHourBank(bankRes.data);
      if (leaveRes.success) setLeaves(leaveRes.data);

    } catch (err) {
      setError('Erro ao carregar dados do portal do colaborador.');
    } finally {
      setLoading(false);
    }
  };

  const handleLeaveSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;

    try {
      const response = await api.post('/leaves', {
        employeeId: profile.id,
        startDate: new Date(leaveForm.startDate).toISOString(),
        endDate: new Date(leaveForm.endDate).toISOString(),
        type: leaveForm.type,
        justification: leaveForm.justification
      });

      if (response.success) {
        setShowLeaveForm(false);
        setLeaveForm({ startDate: '', endDate: '', type: 'FERIAS', justification: '' });
        // Refresh leaves list
        const leavesRes = await api.get('/employee-portal/leaves');
        if (leavesRes.success) setLeaves(leavesRes.data);
      }
    } catch (err) {
      console.error('Error submitting leave request:', err);
    }
  };

  if (loading) {
    return (
      <div className="py-24 text-center">
        <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
        <p className="text-slate-400 text-sm">Carregando painel pessoal...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <div className="w-16 h-16 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center mb-4">
          <AlertCircle className="w-8 h-8 text-indigo-400" />
        </div>
        <h2 className="text-lg font-bold text-white mb-2">Portal Pessoal Indisponível</h2>
        <p className="text-slate-400 text-xs max-w-sm">{error}</p>
        <p className="text-slate-500 text-[10px] mt-2 max-w-xs leading-relaxed">
          Para acessar, certifique-se de que o e-mail cadastrado na sua conta de usuário seja idêntico ao e-mail cadastrado no seu cadastro de Funcionário.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Profile Header */}
      <div className="p-6 bg-slate-900 border border-slate-800 rounded-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-indigo-600/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 text-xl font-bold">
            {profile?.fullName?.[0] || 'U'}
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight">{profile?.fullName}</h1>
            <p className="text-xs text-slate-400 mt-0.5">{profile?.jobTitle || 'Colaborador'} • Setor: {profile?.sector || '-'}</p>
          </div>
        </div>
        <div className="text-right">
          <span className="text-[10px] uppercase font-bold text-slate-500 block">Status de Cadastro</span>
          <span className="inline-block px-2.5 py-1 rounded-full text-[10px] font-bold mt-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/10">
            {profile?.status === 'ACTIVE' ? 'Ativo' : profile?.status}
          </span>
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Columns - Timesheet & Hour Bank */}
        <div className="lg:col-span-2 space-y-6">
          {/* Timesheet Section */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-xl">
            <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
              <h3 className="font-bold text-white text-sm flex items-center gap-2">
                <Calendar className="w-4 h-4 text-indigo-400" />
                Histórico de Marcações (Mês Atual)
              </h3>
              <span className="text-[10px] text-slate-500 font-medium">Atualizado em tempo real</span>
            </div>

            {timesheet.length === 0 ? (
              <div className="py-12 text-center text-slate-500 text-xs">
                Nenhum registro de check-in para este período.
              </div>
            ) : (
              <div className="overflow-x-auto text-xs text-left">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="border-b border-slate-800 text-slate-500 font-semibold uppercase tracking-wider text-[10px] bg-slate-950/20">
                      <th className="px-6 py-3">Data</th>
                      <th className="px-6 py-3">Horário</th>
                      <th className="px-6 py-3">Precisão / Método</th>
                      <th className="px-6 py-3">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 text-slate-350">
                    {timesheet.map((row) => (
                      <tr key={row.id} className="hover:bg-slate-800/10">
                        <td className="px-6 py-3.5 font-medium text-slate-200">
                          {new Date(row.checkinDate).toLocaleDateString('pt-BR')}
                        </td>
                        <td className="px-6 py-3.5 font-mono">
                          {row.respondedAt ? new Date(row.respondedAt).toLocaleTimeString('pt-BR') : '-'}
                        </td>
                        <td className="px-6 py-3.5">
                          {row.accuracyMeters ? `${Math.round(row.accuracyMeters)}m` : '-'} (GPS)
                        </td>
                        <td className="px-6 py-3.5">
                          <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${
                            row.status === 'CONFIRMED' ? 'bg-emerald-500/10 text-emerald-400' :
                            row.status === 'LATE' ? 'bg-amber-500/10 text-amber-400' : 'bg-slate-800 text-slate-400'
                          }`}>
                            {row.status === 'CONFIRMED' ? 'Confirmado' : row.status === 'LATE' ? 'Atrasado' : row.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Hour Bank Transactions Section */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-xl">
            <div className="px-6 py-4 border-b border-slate-800">
              <h3 className="font-bold text-white text-sm flex items-center gap-2">
                <Clock className="w-4 h-4 text-indigo-400" />
                Histórico do Banco de Horas
              </h3>
            </div>

            {hourBank.transactions.length === 0 ? (
              <div className="py-12 text-center text-slate-500 text-xs">
                Nenhuma transação registrada no banco de horas.
              </div>
            ) : (
              <div className="p-4 space-y-3">
                {hourBank.transactions.map((tx: any) => (
                  <div key={tx.id} className="p-3 bg-slate-950/40 rounded-lg flex items-center justify-between text-xs border border-slate-800/40">
                    <div>
                      <p className="text-slate-300 font-semibold">{tx.description || 'Compensação'}</p>
                      <p className="text-[10px] text-slate-500 mt-0.5">{new Date(tx.date).toLocaleDateString('pt-BR')}</p>
                    </div>
                    <span className={`font-mono font-bold ${tx.amountMinutes >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {tx.amountMinutes >= 0 ? `+${tx.amountMinutes}` : tx.amountMinutes} min
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Column - Balance Card & Leaves */}
        <div className="space-y-6">
          {/* Balance card */}
          <div className="p-6 bg-slate-900 border border-slate-800 rounded-xl shadow-xl flex flex-col justify-between">
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-500 block">Saldo do Banco de Horas</span>
              <div className="text-4xl font-extrabold text-white tracking-tight mt-1 flex items-baseline gap-1">
                {hourBank.balance}
                <span className="text-xs text-slate-500 font-semibold">minutos</span>
              </div>
              <p className="text-[10px] text-slate-500 mt-2">Equivale a aproximadamente {Math.round(hourBank.balance / 60)}h</p>
            </div>
          </div>

          {/* Leaves Section */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-white text-sm flex items-center gap-2">
                <FileText className="w-4 h-4 text-indigo-400" />
                Afastamentos e Férias
              </h3>
              {!showLeaveForm && (
                <button
                  onClick={() => setShowLeaveForm(true)}
                  className="text-xs font-semibold text-indigo-400 hover:text-indigo-350 transition-colors flex items-center gap-1 cursor-pointer"
                >
                  <PlusCircle className="w-3.5 h-3.5" />
                  Solicitar
                </button>
              )}
            </div>

            {showLeaveForm && (
              <form onSubmit={handleLeaveSubmit} className="p-4 bg-slate-950/40 rounded-lg space-y-3 border border-slate-800/80">
                <h4 className="text-xs font-bold text-slate-300">Nova Solicitação</h4>
                
                <div>
                  <label className="text-[9px] uppercase font-bold text-slate-500 block mb-1">Tipo de Afastamento</label>
                  <select
                    value={leaveForm.type}
                    onChange={e => setLeaveForm({ ...leaveForm, type: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded px-2 py-1.5 text-white text-xs"
                  >
                    <option value="FERIAS">Férias</option>
                    <option value="LICENCA_MEDICA">Licença Médica</option>
                    <option value="FOLGA_COMPENSATORIA">Folga Compensatória</option>
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[9px] uppercase font-bold text-slate-500 block mb-1">Início</label>
                    <input
                      type="date"
                      required
                      value={leaveForm.startDate}
                      onChange={e => setLeaveForm({ ...leaveForm, startDate: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-800 rounded px-2 py-1 text-white text-xs"
                    />
                  </div>
                  <div>
                    <label className="text-[9px] uppercase font-bold text-slate-500 block mb-1">Fim</label>
                    <input
                      type="date"
                      required
                      value={leaveForm.endDate}
                      onChange={e => setLeaveForm({ ...leaveForm, endDate: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-800 rounded px-2 py-1 text-white text-xs"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[9px] uppercase font-bold text-slate-500 block mb-1">Justificativa</label>
                  <textarea
                    rows={2}
                    value={leaveForm.justification}
                    onChange={e => setLeaveForm({ ...leaveForm, justification: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded px-2 py-1 text-white text-xs resize-none"
                    placeholder="Opcional..."
                  />
                </div>

                <div className="flex justify-end gap-2 pt-1 text-[10px]">
                  <button
                    type="button"
                    onClick={() => setShowLeaveForm(false)}
                    className="px-3 py-1 rounded bg-slate-900 border border-slate-800 text-slate-350 hover:text-white cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="px-3 py-1 rounded bg-indigo-600 hover:bg-indigo-500 text-white font-bold cursor-pointer"
                  >
                    Enviar
                  </button>
                </div>
              </form>
            )}

            {leaves.length === 0 ? (
              <div className="py-6 text-center text-slate-500 text-xs">
                Nenhum afastamento ou férias programadas.
              </div>
            ) : (
              <div className="space-y-3">
                {leaves.map((lv) => (
                  <div key={lv.id} className="p-3 bg-slate-950/40 rounded-lg text-xs border border-slate-800/40 flex items-center justify-between">
                    <div>
                      <p className="font-bold text-slate-300">
                        {lv.type === 'FERIAS' ? 'Férias' : lv.type === 'LICENCA_MEDICA' ? 'Licença Médica' : lv.type}
                      </p>
                      <p className="text-[9px] text-slate-500 mt-0.5">
                        {new Date(lv.startDate).toLocaleDateString('pt-BR')} até {new Date(lv.endDate).toLocaleDateString('pt-BR')}
                      </p>
                    </div>
                    <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${
                      lv.status === 'APPROVED' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/10' :
                      lv.status === 'REJECTED' ? 'bg-rose-500/10 text-rose-400 border border-rose-500/10' :
                      'bg-slate-800 text-slate-400'
                    }`}>
                      {lv.status === 'APPROVED' ? 'Aprovado' : lv.status === 'REJECTED' ? 'Rejeitado' : 'Pendente'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
