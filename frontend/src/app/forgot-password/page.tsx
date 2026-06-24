'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Mail, ShieldAlert, CheckCircle2, ArrowLeft, Bug } from 'lucide-react';
import { api } from '@/lib/api';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [errorRequestId, setErrorRequestId] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [debugToken, setDebugToken] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoading) return;
    setIsLoading(true);
    setError('');
    setErrorRequestId(null);
    setSuccess(false);
    setDebugToken(null);

    try {
      const response = await api.post('/auth/forgot-password', { email }) as any;

      if (response.success) {
        setSuccess(true);
        if (response.debugToken) {
          setDebugToken(response.debugToken);
        }
      } else {
        setError(response.error?.message || 'Erro ao processar solicitação.');
        if (response.error?.requestId) {
          setErrorRequestId(response.error.requestId);
        }
      }
    } catch (err) {
      setError('Erro ao conectar-se ao servidor. Tente novamente mais tarde.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-slate-950 text-slate-100 font-sans justify-center items-center p-6">
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#0f172a_1px,transparent_1px),linear-gradient(to_bottom,#0f172a_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_70%,transparent_100%)] opacity-30 pointer-events-none"></div>

      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-8 relative z-10 shadow-2xl">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-lg bg-indigo-600 flex items-center justify-center font-bold text-xl text-white shadow-lg shadow-indigo-500/20">
            PF
          </div>
          <span className="text-xl font-bold tracking-tight text-white">PresençaFlow <span className="text-indigo-400">RH</span></span>
        </div>

        <div className="mb-6">
          <h2 className="text-2xl font-bold text-white mb-2">Recuperar Senha</h2>
          <p className="text-slate-400 text-sm leading-relaxed">
            Esqueceu seus dados de acesso? Informe seu e-mail corporativo abaixo para iniciarmos a recuperação.
          </p>
        </div>

        {success ? (
          <div className="space-y-6">
            <div className="flex items-start gap-3 p-4 rounded-lg bg-emerald-950/40 border border-emerald-800/60 text-emerald-200 text-sm">
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-white mb-1">Solicitação enviada!</p>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Se o e-mail informado estiver registrado no sistema, enviaremos as instruções para redefinição da senha em instantes.
                </p>
              </div>
            </div>

            {debugToken && (
              <div className="p-4 bg-amber-950/30 border border-amber-800/40 rounded-lg space-y-2">
                <div className="flex items-center gap-2 text-amber-400 text-xs font-semibold">
                  <Bug className="w-4 h-4" />
                  <span>Ambiente de Desenvolvimento / Teste</span>
                </div>
                <p className="text-[11px] text-slate-400">
                  Um token de depuração foi gerado e retornado nesta resposta:
                </p>
                <div className="bg-slate-950 p-2 rounded text-[11px] font-mono break-all border border-slate-800 text-amber-200">
                  {debugToken}
                </div>
                <Link
                  href={`/reset-password?token=${debugToken}`}
                  className="inline-block text-xs font-medium text-amber-400 hover:text-amber-300 underline transition-colors"
                >
                  Redefinir senha com este token &rarr;
                </Link>
              </div>
            )}

            <Link
              href="/login"
              className="flex items-center justify-center gap-2 w-full py-2.5 px-4 rounded-lg bg-slate-850 hover:bg-slate-800 border border-slate-800 text-slate-300 text-sm font-medium transition-all"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Voltar para o Login</span>
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <div className="flex flex-col gap-1 p-4 rounded-lg bg-red-950/50 border border-red-800 text-red-200 text-sm animate-shake">
                <div className="flex items-center gap-3">
                  <ShieldAlert className="w-5 h-5 text-red-400 shrink-0" />
                  <span>{error}</span>
                </div>
                {errorRequestId && (
                  <span className="text-[10px] text-slate-500 font-mono mt-1 pl-8 block">
                    ID da Requisição: {errorRequestId}
                  </span>
                )}
              </div>
            )}

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-slate-300 mb-2">
                E-mail corporativo
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                <input
                  id="email"
                  type="email"
                  required
                  placeholder="exemplo@empresa.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="block w-full pl-10 pr-4 py-2.5 rounded-lg bg-slate-950 border border-slate-800 text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all text-sm"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-2.5 px-4 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-750 disabled:cursor-not-allowed text-white font-medium shadow-lg shadow-indigo-600/10 hover:shadow-indigo-500/20 transition-all text-sm"
            >
              {isLoading ? 'Processando...' : 'Enviar Link de Recuperação'}
            </button>

            <Link
              href="/login"
              className="flex items-center justify-center gap-2 w-full py-2.5 px-4 rounded-lg bg-transparent hover:bg-slate-850 text-slate-400 hover:text-slate-200 text-sm font-medium transition-all"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Voltar para o Login</span>
            </Link>
          </form>
        )}
      </div>
    </div>
  );
}
