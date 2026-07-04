'use client';

import React, { useState, useEffect } from 'react';
import { ShieldCheck, Search, Filter, Clock, Info } from 'lucide-react';
import { api } from '@/lib/api';

const ACTION_LABELS: Record<string, string> = {
  EMPLOYEE_CREATE: 'Cadastro de Funcionário',
  EMPLOYEE_UPDATE: 'Edição de Funcionário',
  EMPLOYEE_DEACTIVATE: 'Inativação de Funcionário',
  EMPLOYEE_ACTIVATE: 'Reativação de Funcionário',
};

export default function AuditLogsPage() {
  const [logs, setLogs] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Filters
  const [actionFilter, setActionFilter] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    fetchLogs();
  }, [actionFilter, fromDate, toDate, page]);

  const fetchLogs = async () => {
    setIsLoading(true);
    setError('');
    try {
      const queryParams = new URLSearchParams();
      queryParams.append('page', String(page));
      queryParams.append('limit', '20');
      if (actionFilter) queryParams.append('action', actionFilter);
      if (fromDate) queryParams.append('from', fromDate);
      if (toDate) queryParams.append('to', toDate);

      const res = await api.get(`/audit-logs?${queryParams.toString()}`);
      if (res.success && res.data) {
        setLogs(res.data.logs || []);
        setTotalPages(res.data.pagination?.pages || 1);
      } else {
        setError(res.error?.message || 'Erro ao carregar logs de auditoria.');
      }
    } catch (err) {
      setError('Erro de conexão ao buscar logs de auditoria.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-white flex items-center gap-2">
          <ShieldCheck className="w-8 h-8 text-indigo-500" />
          <span>Logs de Auditoria</span>
        </h1>
        <p className="text-slate-400 text-sm mt-1">
          Histórico e rastreamento de ações críticas e modificações realizadas no sistema.
        </p>
      </div>

      {/* Filters Bar */}
      <div className="flex flex-col md:flex-row gap-4 p-5 rounded-xl border border-slate-800 bg-slate-900 shadow-lg">
        <div className="flex-1">
          <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase">Ação Realizada</label>
          <select
            value={actionFilter}
            onChange={(e) => { setActionFilter(e.target.value); setPage(1); }}
            className="block w-full px-4 py-2 rounded-lg bg-slate-950 border border-slate-800 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all text-sm cursor-pointer"
          >
            <option value="">Todas as Ações</option>
            <option value="EMPLOYEE_CREATE">Cadastro de Funcionário</option>
            <option value="EMPLOYEE_UPDATE">Edição de Funcionário</option>
            <option value="EMPLOYEE_DEACTIVATE">Inativação de Funcionário</option>
            <option value="EMPLOYEE_ACTIVATE">Reativação de Funcionário</option>
          </select>
        </div>

        <div className="w-full md:w-48">
          <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase">De Date</label>
          <input
            type="date"
            value={fromDate}
            onChange={(e) => { setFromDate(e.target.value); setPage(1); }}
            className="block w-full px-4 py-2 rounded-lg bg-slate-950 border border-slate-800 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all text-sm"
          />
        </div>

        <div className="w-full md:w-48">
          <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase">Até Date</label>
          <input
            type="date"
            value={toDate}
            onChange={(e) => { setToDate(e.target.value); setPage(1); }}
            className="block w-full px-4 py-2 rounded-lg bg-slate-950 border border-slate-800 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all text-sm"
          />
        </div>
      </div>

      {/* Main Table */}
      <div className="rounded-xl border border-slate-800 bg-slate-900 overflow-hidden shadow-xl">
        {isLoading ? (
          <div className="py-24 flex flex-col items-center justify-center gap-3">
            <div className="w-8 h-8 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
            <span className="text-sm text-slate-400">Carregando logs de auditoria...</span>
          </div>
        ) : error ? (
          <div className="py-20 text-center text-red-400 text-sm">{error}</div>
        ) : logs.length === 0 ? (
          <div className="py-24 text-center text-slate-500 text-sm">
            Nenhum log de auditoria encontrado.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-400 border-collapse">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-900/50 text-slate-500 font-semibold text-xs uppercase tracking-wider">
                  <th className="px-6 py-3.5">Data / Hora</th>
                  <th className="px-6 py-3.5">Usuário Responsável</th>
                  <th className="px-6 py-3.5">Ação</th>
                  <th className="px-6 py-3.5">Tipo do Objeto</th>
                  <th className="px-6 py-3.5">Detalhes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {logs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-800/10 transition-colors">
                    <td className="px-6 py-4 font-mono text-xs text-slate-300">
                      {new Date(log.createdAt).toLocaleString('pt-BR')}
                    </td>
                    <td className="px-6 py-4 text-sm font-semibold text-slate-200">
                      {log.user?.name || 'Sistema (SYSTEM)'}
                      <span className="block text-[10px] text-slate-500 font-normal mt-0.5">{log.user?.email || '-'}</span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded text-[10px] font-bold border ${
                        log.action === 'EMPLOYEE_DEACTIVATE' ? 'bg-rose-500/10 text-rose-400 border-rose-500/20' :
                        log.action === 'EMPLOYEE_ACTIVATE' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                        log.action === 'EMPLOYEE_CREATE' ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20' :
                        'bg-slate-800 text-slate-350 border-slate-700'
                      }`}>
                        {ACTION_LABELS[log.action] || log.action}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-xs font-mono text-slate-400">{log.entity || '-'}</td>
                    <td className="px-6 py-4 text-xs leading-relaxed text-slate-350">
                      {log.metadata && typeof log.metadata === 'object' ? (
                        <div className="space-y-1 bg-slate-950/45 p-2 rounded border border-slate-850 max-w-sm">
                          {Object.entries(log.metadata).map(([key, val]: any) => (
                            <p key={key}>
                              <strong>{key}:</strong> {String(val)}
                            </p>
                          ))}
                        </div>
                      ) : (
                        '-'
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            onClick={() => setPage((p) => Math.max(p - 1, 1))}
            disabled={page === 1}
            className="px-3 py-1.5 rounded bg-slate-900 border border-slate-800 text-xs font-medium text-slate-300 disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
          >
            Anterior
          </button>
          <span className="text-xs text-slate-400">
            Página {page} de {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(p + 1, totalPages))}
            disabled={page === totalPages}
            className="px-3 py-1.5 rounded bg-slate-900 border border-slate-800 text-xs font-medium text-slate-300 disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
          >
            Próxima
          </button>
        </div>
      )}
    </div>
  );
}
