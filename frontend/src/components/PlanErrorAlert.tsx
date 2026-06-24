'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { ShieldAlert, CreditCard, X } from 'lucide-react';
import { getUser } from '@/lib/auth';

interface PlanErrorAlertProps {
  error: string | null;
  onClose: () => void;
}

export default function PlanErrorAlert({ error, onClose }: PlanErrorAlertProps) {
  const router = useRouter();
  if (!error) return null;

  const user = getUser();
  const role = user?.role || 'VIEWER';
  const isAllowedToUpgrade = ['ADMIN', 'HR'].includes(role);

  let title = 'Acesso Restrito';
  let message = 'Você não possui permissão para realizar esta operação.';
  let showBillingCta = false;

  if (error === 'PLAN_LIMIT_EXCEEDED') {
    title = 'Limite do Plano Atingido';
    message = 'Sua empresa atingiu o limite de uso mensal contratado para este recurso no plano atual.';
    showBillingCta = true;
  } else if (error === 'PLAN_FEATURE_DISABLED') {
    title = 'Recurso Bloqueado pelo Plano';
    message = 'Este módulo avançado não está disponível no plano atual de sua empresa.';
    showBillingCta = true;
  } else if (error === 'FEATURE_DISABLED') {
    title = 'Recurso Desativado';
    message = 'Este recurso está desativado nas configurações operacionais internas da empresa.';
  } else if (error === 'FORBIDDEN') {
    title = 'Acesso Negado';
    message = 'Seu perfil de usuário não possui permissão para executar esta ação administrativa.';
  }

  const handleCta = () => {
    onClose();
    router.push('/app/billing');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm transition-all animate-fade-in">
      <div className="relative w-full max-w-md bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-2xl p-6 space-y-6">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute right-4 top-4 text-slate-400 hover:text-slate-200 transition-colors"
          title="Fechar"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Warning Icon & Title */}
        <div className="flex flex-col items-center text-center space-y-3">
          <div className="w-12 h-12 rounded-full bg-rose-500/10 border border-rose-500/20 flex items-center justify-center">
            <ShieldAlert className="w-6 h-6 text-rose-500" />
          </div>
          <h3 className="text-xl font-bold text-white tracking-tight">{title}</h3>
          <p className="text-sm text-slate-400 leading-relaxed">{message}</p>
        </div>

        {/* Action Section */}
        <div className="pt-4 border-t border-slate-800/80 flex flex-col gap-3">
          {showBillingCta && isAllowedToUpgrade ? (
            <button
              onClick={handleCta}
              className="w-full py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold flex items-center justify-center gap-2 shadow transition-all cursor-pointer"
            >
              <CreditCard className="w-4 h-4" />
              <span>Ver Plano e Uso / Upgrade</span>
            </button>
          ) : showBillingCta ? (
            <div className="p-3 bg-slate-950/50 border border-slate-850 rounded-lg text-[11px] text-slate-450 text-center leading-relaxed font-medium">
              Entre em contato com o administrador da empresa para solicitar o upgrade do plano.
            </div>
          ) : null}

          <button
            onClick={onClose}
            className="w-full py-2 rounded-lg bg-slate-800 hover:bg-slate-750 text-slate-300 text-xs font-semibold transition-all cursor-pointer"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}
