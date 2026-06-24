import React from 'react';
import { WifiOff, RefreshCw } from 'lucide-react';

interface OfflineAlertProps {
  onRetry?: () => void;
  message?: string;
}

export function OfflineAlert({ onRetry, message }: OfflineAlertProps) {
  return (
    <div className="flex flex-col items-center justify-center p-8 py-16 text-center bg-slate-900/60 border border-slate-800 rounded-xl max-w-md mx-auto shadow-2xl space-y-6">
      <div className="w-16 h-16 rounded-full bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-500 animate-pulse">
        <WifiOff className="w-8 h-8" />
      </div>
      <div className="space-y-2">
        <h3 className="text-lg font-bold text-white">Servidor Indisponível</h3>
        <p className="text-sm text-slate-400 leading-relaxed">
          {message || 'Não conseguimos estabelecer uma conexão com o servidor. Verifique sua conexão ou tente novamente mais tarde.'}
        </p>
      </div>
      {onRetry && (
        <button
          onClick={onRetry}
          className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white shadow transition-all cursor-pointer"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Tentar Conectar
        </button>
      )}
    </div>
  );
}
