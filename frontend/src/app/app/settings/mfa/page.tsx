'use client';

import React, { useState, useEffect } from 'react';
import { ShieldAlert, Key, CheckCircle, Info, Lock, Copy, Check } from 'lucide-react';
import { api } from '@/lib/api';

export default function MfaPage() {
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false);
  const [setupMode, setSetupMode] = useState(false);
  const [secret, setSecret] = useState('PF5X Y3K7 Z9W2 A4B6 C8D1');
  const [verificationCode, setVerificationCode] = useState('');
  const [isCopied, setIsCopied] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  const handleCopySecret = () => {
    navigator.clipboard.writeText(secret);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  const handleEnableSetup = () => {
    setSetupMode(true);
    setVerificationCode('');
    setErrorMessage('');
  };

  const handleVerifyAndEnable = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    if (verificationCode.length !== 6 || !/^\d+$/.test(verificationCode)) {
      setErrorMessage('Por favor, digite um código de 6 dígitos numéricos válido.');
      return;
    }

    // Simulate verification
    setTwoFactorEnabled(true);
    setSetupMode(false);
    setSuccessMessage('Autenticação em Duas Etapas (2FA) ativada com sucesso!');
    setTimeout(() => setSuccessMessage(''), 5000);
  };

  const handleDisableMfa = () => {
    if (confirm('Tem certeza que deseja desativar o 2FA? Sua conta ficará menos protegida.')) {
      setTwoFactorEnabled(false);
      setSuccessMessage('2FA desativado com sucesso.');
      setTimeout(() => setSuccessMessage(''), 4000);
    }
  };

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-white flex items-center gap-2">
          <ShieldAlert className="w-8 h-8 text-indigo-500" />
          <span>Segurança (MFA)</span>
        </h1>
        <p className="text-slate-400 text-sm mt-1">
          Proteja sua conta administrativa do RH ativando a Autenticação Multifator.
        </p>
      </div>

      {successMessage && (
        <div className="flex items-center gap-3 p-4 rounded-lg bg-emerald-950/50 border border-emerald-800 text-emerald-200 text-sm">
          <CheckCircle className="w-5 h-5 text-emerald-400 shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      {errorMessage && (
        <div className="flex items-center gap-3 p-4 rounded-lg bg-red-950/50 border border-red-800 text-red-200 text-sm">
          <Info className="w-5 h-5 text-red-450 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Main configuration panel */}
      <div className="p-6 rounded-xl border border-slate-800 bg-slate-900 shadow-lg space-y-6">
        <div className="flex items-start gap-4">
          <div className={`p-3 rounded-lg shrink-0 ${twoFactorEnabled ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'}`}>
            <Lock className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white">Status do 2FA</h3>
            <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">
              Exija um código temporário de 6 dígitos gerado no aplicativo do seu celular (ex: Google Authenticator) além da senha ao efetuar o login.
            </p>
            <div className="mt-3.5 flex items-center gap-2">
              <span className={`px-2 py-0.5 rounded text-[10px] font-bold border uppercase ${
                twoFactorEnabled 
                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' 
                  : 'bg-slate-800 text-slate-400 border-slate-700'
              }`}>
                {twoFactorEnabled ? 'Ativo' : 'Inativo'}
              </span>
            </div>
          </div>
        </div>

        {!setupMode && (
          <div className="pt-4 border-t border-slate-800 flex justify-end">
            {twoFactorEnabled ? (
              <button
                type="button"
                onClick={handleDisableMfa}
                className="px-4 py-2 rounded-lg bg-red-950/40 hover:bg-red-900/30 text-red-400 hover:text-red-300 text-xs font-bold border border-red-800/30 transition-colors cursor-pointer"
              >
                Desativar 2FA
              </button>
            ) : (
              <button
                type="button"
                onClick={handleEnableSetup}
                className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-md shadow-indigo-600/10 transition-colors cursor-pointer"
              >
                Configurar 2FA
              </button>
            )}
          </div>
        )}

        {/* 2FA Setup Form */}
        {setupMode && (
          <div className="pt-6 border-t border-slate-800 space-y-6">
            <h4 className="text-sm font-bold text-white flex items-center gap-2">
              <Key className="w-4 h-4 text-indigo-400" />
              <span>Configuração da Verificação em Duas Etapas</span>
            </h4>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
              {/* Fake QR Code */}
              <div className="flex flex-col items-center justify-center p-4 bg-white rounded-xl border border-slate-300 w-fit mx-auto">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 100 100"
                  className="w-36 h-36 text-slate-900"
                  fill="currentColor"
                >
                  <rect width="100" height="100" fill="white" />
                  <path d="M10,10 h20 v20 h-20 z M15,15 h10 v10 h-10 z M18,18 h4 v4 h-4 z" />
                  <path d="M70,10 h20 v20 h-20 z M75,15 h10 v10 h-10 z M78,18 h4 v4 h-4 z" />
                  <path d="M10,70 h20 v20 h-20 z M15,75 h10 v10 h-10 z M18,78 h4 v4 h-4 z" />
                  <path d="M40,10 h10 v10 h-10 z M42,12 h6 v6 h-6 z" />
                  <path d="M55,10 h10 v15 h-10 z" />
                  <path d="M40,30 h15 v5 h-15 z M50,45 h20 v10 h-20 z" />
                  <path d="M10,40 h15 v10 h-15 z M35,60 h20 v20 h-20 z" />
                  <path d="M60,60 h30 v30 h-30 z M65,65 h20 v20 h-20 z" />
                </svg>
                <span className="text-[10px] text-slate-500 font-medium mt-2">Escaneie com o app de autenticação</span>
              </div>

              {/* Secret key and text */}
              <div className="space-y-4">
                <p className="text-xs text-slate-400 leading-relaxed">
                  1. Escaneie o QR Code ao lado ou digite a chave secreta abaixo no seu aplicativo (como Google Authenticator, Authy ou Microsoft Authenticator).
                </p>
                
                <div className="flex items-center justify-between p-3 rounded-lg bg-slate-950 border border-slate-800">
                  <div>
                    <p className="text-[9px] text-slate-500 font-semibold uppercase">Chave Secreta</p>
                    <p className="text-xs font-mono font-bold text-white tracking-wider mt-0.5">{secret}</p>
                  </div>
                  <button
                    type="button"
                    onClick={handleCopySecret}
                    className="p-2 rounded bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer border border-slate-800"
                    title="Copiar chave"
                  >
                    {isCopied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>

                <p className="text-xs text-slate-400 leading-relaxed">
                  2. Digite o código de 6 dígitos gerado pelo seu aplicativo para confirmar a ativação:
                </p>

                <form onSubmit={handleVerifyAndEnable} className="flex gap-3">
                  <input
                    type="text"
                    required
                    maxLength={6}
                    value={verificationCode}
                    onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, ''))}
                    placeholder="000000"
                    className="block w-36 px-4 py-2 rounded-lg bg-slate-950 border border-slate-850 text-white placeholder-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all text-center font-mono text-sm tracking-widest font-bold"
                  />
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow transition-all cursor-pointer shrink-0"
                  >
                    Confirmar e Ativar
                  </button>
                </form>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-800 flex justify-end">
              <button
                type="button"
                onClick={() => setSetupMode(false)}
                className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-750 text-slate-300 text-xs font-semibold transition-colors cursor-pointer"
              >
                Cancelar
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
