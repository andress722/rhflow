'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Eye, EyeOff, Lock, Mail, ShieldAlert } from 'lucide-react';
import { api } from '@/lib/api';
import { setSession, isAuthenticated } from '@/lib/auth';

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [errorRequestId, setErrorRequestId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated()) {
      router.push('/app/dashboard');
    }
    const queryError = searchParams?.get('error');
    if (queryError === '401') {
      setError('Sessão expirada. Faça login novamente.');
    }
  }, [router, searchParams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoading) return;
    setIsLoading(true);
    setError('');
    setErrorRequestId(null);

    try {
      const response = await api.post('/auth/login', { email, password });

      if (response.success && response.data) {
        const { token, user } = response.data;
        setSession(token, user);
        if (user.mustChangePassword) {
          router.push('/change-password');
        } else {
          router.push('/app/dashboard');
        }
      } else {
        setError(response.error?.message || 'E-mail ou senha incorretos.');
        const errCode = response.error?.code;
        if (response.error?.requestId && errCode !== 'INVALID_CREDENTIALS') {
          setErrorRequestId(response.error.requestId);
        }
      }
    } catch (err) {
      setError('Erro ao se conectar com o servidor. Tente novamente mais tarde.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-slate-950 text-slate-100 font-sans">
      {/* Side Brand panel */}
      <div className="hidden lg:flex lg:w-1/2 bg-slate-900 justify-center items-center relative p-12 overflow-hidden border-r border-slate-800">
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#0f172a_1px,transparent_1px),linear-gradient(to_bottom,#0f172a_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] opacity-40"></div>
        <div className="relative z-10 max-w-md">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-lg bg-indigo-600 flex items-center justify-center font-bold text-xl text-white shadow-lg shadow-indigo-500/20">
              PF
            </div>
            <span className="text-2xl font-bold tracking-tight text-white">PresençaFlow <span className="text-indigo-400">RH</span></span>
          </div>
          <h1 className="text-4xl font-extrabold tracking-tight text-white mb-4">
            Automatize faltas, atestados e presença via WhatsApp.
          </h1>
          <p className="text-slate-400 text-lg leading-relaxed">
            Painel operacional para RH e gestores acompanharem ocorrências, analisarem atestados médicos e organizarem escalas em tempo real.
          </p>
        </div>
      </div>

      {/* Form panel */}
      <div className="w-full lg:w-1/2 flex flex-col justify-center px-6 py-12 sm:px-16 lg:px-24">
        <div className="mx-auto w-full max-w-md">
          <div className="lg:hidden flex items-center gap-2 mb-8">
            <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center font-bold text-lg text-white">
              PF
            </div>
            <span className="text-xl font-bold text-white">PresençaFlow RH</span>
          </div>

          <div className="mb-8">
            <h2 className="text-3xl font-bold tracking-tight text-white">Acesse o Painel</h2>
            <p className="mt-2 text-sm text-slate-400">
              Insira suas credenciais para entrar no sistema de gestão.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
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
                  placeholder="admin@presencaflow.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="block w-full pl-10 pr-4 py-2.5 rounded-lg bg-slate-900 border border-slate-800 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all text-sm"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label htmlFor="password" className="block text-sm font-medium text-slate-300">
                  Senha
                </label>
                <Link href="/forgot-password" className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors">
                  Esqueceu a senha?
                </Link>
              </div>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="block w-full pl-10 pr-10 py-2.5 rounded-lg bg-slate-900 border border-slate-800 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all text-sm"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-2.5 px-4 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-700/50 disabled:cursor-not-allowed text-white font-medium shadow-lg shadow-indigo-600/10 hover:shadow-indigo-500/20 transition-all text-sm"
            >
              {isLoading ? 'Entrando...' : 'Entrar no sistema'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen bg-slate-950 text-slate-100 font-sans items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
          <span className="text-sm text-slate-400 font-medium">Carregando formulário...</span>
        </div>
      </div>
    }>
      <LoginForm />
    </Suspense>
  );
}

