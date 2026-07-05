'use client';

import React, { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { getUser } from '@/lib/auth';
import {
  Layers,
  ArrowLeft,
  Trash2,
  Calendar,
  Layers3,
  ShieldAlert,
} from 'lucide-react';
import Link from 'next/link';

export default function MappingTemplatesPage() {
  const [user, setUser] = useState<any>(null);
  const [templates, setTemplates] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    setUser(getUser());
    loadTemplates();
  }, []);

  const loadTemplates = async () => {
    setLoading(true);
    try {
      const res = await api.get('/import-mapping-templates');
      if (res.success) {
        setTemplates(res.data);
      }
    } catch (_) {
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Deseja realmente excluir este modelo de mapeamento?')) return;
    try {
      const res = await api.delete(`/import-mapping-templates/${id}`);
      if (res.success) {
        setTemplates(templates.filter(t => t.id !== id));
      } else {
        alert(res.error?.message || 'Falha ao excluir modelo.');
      }
    } catch (_) {
      alert('Erro de conexão ao excluir modelo.');
    }
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
          Sua conta não possui permissão administrativa (ADMIN/HR) para gerenciar modelos de importação.
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

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-12">
      <div className="flex items-center gap-3 border-b border-slate-900 pb-4">
        <Link
          href="/app/employees/import/v2"
          className="p-2 rounded-lg bg-slate-950 border border-slate-900 text-slate-400 hover:text-white transition-all"
        >
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div>
          <h1 className="text-2xl font-extrabold text-white flex items-center gap-2">
            <Layers className="w-7 h-7 text-indigo-500" />
            Modelos de Mapeamento
          </h1>
          <p className="text-slate-400 text-xs mt-0.5">
            Gerencie as predefinições de cabeçalhos salvas para importações rápidas no Importador V2.
          </p>
        </div>
      </div>

      {loading ? (
        <div className="py-12 flex justify-center">
          <div className="w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
        </div>
      ) : templates.length === 0 ? (
        <div className="p-12 text-center rounded-xl bg-slate-950 border border-slate-900 space-y-3">
          <Layers3 className="w-12 h-12 text-slate-600 mx-auto" />
          <h3 className="text-sm font-bold text-white">Nenhum modelo salvo</h3>
          <p className="text-xs text-slate-500 max-w-xs mx-auto leading-relaxed">
            Você pode salvar novos modelos durante o passo de Mapeamento de Propriedades no Importador V2.
          </p>
          <div className="pt-2">
            <Link
              href="/app/employees/import/v2"
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-lg transition-all"
            >
              Criar Primeiro Modelo
            </Link>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {templates.map((template) => (
            <div key={template.id} className="p-5 rounded-xl bg-slate-950 border border-slate-900 flex justify-between items-start gap-4">
              <div className="space-y-2">
                <div>
                  <h3 className="font-bold text-sm text-white">{template.name}</h3>
                  <span className="text-[9px] uppercase font-bold px-2 py-0.5 rounded bg-slate-900 border border-slate-850 text-indigo-400 inline-block mt-1">
                    Origem: {template.sourceType}
                  </span>
                </div>
                <div className="text-[10px] text-slate-500 flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5" />
                  Salvo em: {new Date(template.createdAt).toLocaleDateString()}
                </div>
                <div className="pt-2">
                  <p className="text-[10px] text-slate-400 font-bold uppercase">Mapeamentos:</p>
                  <div className="text-[10px] text-slate-500 mt-1 flex flex-wrap gap-1.5">
                    {Object.keys(template.mappings).filter(k => template.mappings[k]).map(key => (
                      <span key={key} className="bg-slate-900 px-1.5 py-0.5 rounded border border-slate-850">
                        {key} → {template.mappings[key]}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              <button
                onClick={() => handleDelete(template.id)}
                className="p-2 rounded-lg bg-red-950/20 text-red-400 hover:bg-red-900/20 border border-red-900/30 transition-all cursor-pointer"
                title="Excluir Modelo"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
