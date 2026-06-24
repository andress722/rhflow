'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Lock, ShieldAlert, CheckCircle2, Eye, EyeOff, ShieldCheck } from 'lucide-react';
import { api } from '@/lib/api';
import { getUser, setSession, isAuthenticated } from '@/lib/auth';

export default function ChangePasswordPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState('');
  const [errorRequestId, setErrorRequestId] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!isAuthenticated()) {
      router.push('/login');
      return;
    }
    const currentUser = getUser();
    setUser(currentUser);
  }, [router]);

  // Validation rules helper
  const rules = {
    length: newPassword.length >= 12,
    upper: /[A-Z]/.test(newPassword),
    lower: /[a-z]/.test(newPassword),
    number: /[0-9]/.test(newPassword),
    symbol: /[^A-Za-z0-9]/.test(newPassword),
    different: currentPassword !== newPassword && newPassword.length > 0,
    match: newPassword === confirmPassword && confirmPassword.length > 0,
  };

  const isFormValid =
    rules.length &&
    rules.upper &&
    rules.lower &&
    rules.number &&
    rules.symbol &&
    rules.different &&
    rules.match;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isFormValid) {
      setError('Por favor, atenda a todos os requisitos de segurança para a nova senha.');
      return;
    }
    if (isLoading) return;

    setIsLoading(true);
    setError('');
    setErrorRequestId(null);

    try {
      const response = await api.post('/auth/change-password', {
        currentPassword,
        newPassword,
      });

      if (response.success && response.data) {
        const { token, user: updatedUser } = response.data;
        // Update session with new token and updated user (mustChangePassword = false)
        setSession(token, updatedUser);
        setSuccess(true);
        setTimeout(() => {
          router.push('/app/dashboard');
        }, 3000);
      } else {
        setError(response.error?.message || 'Erro ao alterar a senha. Verifique os dados informados.');
        const errCode = response.error?.code;
        const isExpected = errCode === 'WEAK_PASSWORD' || errCode === 'SAME_PASSWORD' || errCode === 'INVALID_PASSWORD';
        if (response.error?.requestId && !isExpected) {
          setErrorRequestId(response.error.requestId);
        }
      }
    } catch (err) {
      setError('Erro de conexão com o servidor.');
    } finally {
      setIsLoading(false);
    }
  };

  if (!user) {
    return (
      <div className="flex h-screen w-screen bg-slate-950 items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
          <span className="text-sm text-slate-400 font-medium">Carregando dados de acesso...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-slate-950 text-slate-100 font-sans justify-center items-center p-6">
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#0f172a_1px,transparent_1px),linear-gradient(to_bottom,#0f172a_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_70%,transparent_100%)] opacity-30 pointer-events-none"></div>

      <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl p-8 relative z-10 shadow-2xl">
        {success ? (
          <div className="flex flex-col items-center text-center py-8 space-y-4">
            <div className="w-16 h-16 rounded-full bg-emerald-950 border border-emerald-800 flex items-center justify-center mb-2 animate-bounce">
              <ShieldCheck className="w-8 h-8 text-emerald-400" />
            </div>
            <h2 className="text-2xl font-bold text-white">Senha Alterada!</h2>
            <p className="text-slate-400 max-w-sm text-sm">
              Sua senha foi redefinida com sucesso. Redirecionando você para o painel em instantes...
            </p>
            <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mt-4"></div>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-lg bg-indigo-600 flex items-center justify-center font-bold text-xl text-white shadow-lg shadow-indigo-500/20">
                PF
              </div>
              <span className="text-xl font-bold tracking-tight text-white">PresençaFlow <span className="text-indigo-400">RH</span></span>
            </div>

            <div className="mb-6">
              <h2 className="text-2xl font-bold text-white mb-2">Troca de Senha Obrigatória</h2>
              <p className="text-slate-400 text-sm leading-relaxed">
                Por motivos de segurança, altere a senha temporária atribuída ao seu usuário para continuar acessando o sistema.
              </p>
            </div>

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
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Senha Atual / Temporária
                </label>
                <div className="relative">
                  <input
                    type={showCurrent ? 'text' : 'password'}
                    required
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    className="block w-full px-4 py-2.5 rounded-lg bg-slate-950 border border-slate-800 text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                    placeholder="Sua senha temporária"
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrent(!showCurrent)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
                  >
                    {showCurrent ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Nova Senha
                </label>
                <div className="relative">
                  <input
                    type={showNew ? 'text' : 'password'}
                    required
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="block w-full px-4 py-2.5 rounded-lg bg-slate-950 border border-slate-800 text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                    placeholder="Mínimo 12 caracteres"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNew(!showNew)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
                  >
                    {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Confirmar Nova Senha
                </label>
                <div className="relative">
                  <input
                    type={showConfirm ? 'text' : 'password'}
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="block w-full px-4 py-2.5 rounded-lg bg-slate-950 border border-slate-800 text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                    placeholder="Repita a nova senha"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirm(!showConfirm)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
                  >
                    {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Password strength checklist */}
              <div className="p-4 bg-slate-950 rounded-lg border border-slate-800 space-y-2">
                <span className="text-xs font-semibold text-slate-400 block mb-1">Requisitos de Segurança:</span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className={`w-3.5 h-3.5 ${rules.length ? 'text-emerald-400' : 'text-slate-600'}`} />
                    <span className={rules.length ? 'text-slate-200' : 'text-slate-500'}>Mínimo 12 caracteres</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className={`w-3.5 h-3.5 ${rules.upper ? 'text-emerald-400' : 'text-slate-600'}`} />
                    <span className={rules.upper ? 'text-slate-200' : 'text-slate-500'}>Letra maiúscula (A-Z)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className={`w-3.5 h-3.5 ${rules.lower ? 'text-emerald-400' : 'text-slate-600'}`} />
                    <span className={rules.lower ? 'text-slate-200' : 'text-slate-500'}>Letra minúscula (a-z)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className={`w-3.5 h-3.5 ${rules.number ? 'text-emerald-400' : 'text-slate-600'}`} />
                    <span className={rules.number ? 'text-slate-200' : 'text-slate-500'}>Ao menos um número</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className={`w-3.5 h-3.5 ${rules.symbol ? 'text-emerald-400' : 'text-slate-600'}`} />
                    <span className={rules.symbol ? 'text-slate-200' : 'text-slate-500'}>Ao menos um símbolo (@, $, !)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className={`w-3.5 h-3.5 ${rules.different ? 'text-emerald-400' : 'text-slate-600'}`} />
                    <span className={rules.different ? 'text-slate-200' : 'text-slate-500'}>Diferente da senha atual</span>
                  </div>
                </div>
                <div className="flex items-center gap-2 pt-1 border-t border-slate-800 text-xs">
                  <CheckCircle2 className={`w-3.5 h-3.5 ${rules.match ? 'text-emerald-400' : 'text-slate-600'}`} />
                  <span className={rules.match ? 'text-slate-200' : 'text-slate-500'}>Confirmação idêntica</span>
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading || !isFormValid}
                className="w-full py-2.5 px-4 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 disabled:text-slate-500 disabled:cursor-not-allowed text-white font-medium shadow-lg shadow-indigo-600/10 hover:shadow-indigo-500/20 transition-all text-sm mt-2"
              >
                {isLoading ? 'Redefinindo...' : 'Redefinir e Entrar no Sistema'}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
