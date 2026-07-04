'use client';

import React, { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import {
  ShieldCheck,
  AlertTriangle,
  FileCheck2,
  Lock,
  Cpu,
  RefreshCw,
  Terminal,
} from 'lucide-react';

export default function ComplianceAdminPanel() {
  const [overview, setOverview] = useState<any>(null);
  const [capabilities, setCapabilities] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  // AFD validator form
  const [afdText, setAfdText] = useState('');
  const [validationResult, setValidationResult] = useState<any>(null);
  const [isValidating, setIsValidating] = useState(false);

  useEffect(() => {
    fetchComplianceData();
  }, []);

  const fetchComplianceData = async () => {
    setIsLoading(true);
    try {
      const overviewRes: any = await api.get('/admin/compliance/overview');
      const capRes: any = await api.get('/admin/compliance/biometrics/capabilities');
      if (overviewRes.success) setOverview(overviewRes.data);
      if (capRes.success) setCapabilities(capRes.data);
    } catch (err) {
      console.error('Error fetching compliance data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleValidateAfd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!afdText.trim()) return;

    setIsValidating(true);
    setValidationResult(null);
    try {
      const res: any = await api.post('/admin/compliance/afd/validate', {
        afdContent: afdText,
      });
      if (res.success) {
        setValidationResult(res.data);
      }
    } catch (err) {
      alert('Erro ao enviar validador AFD.');
    } finally {
      setIsValidating(false);
    }
  };

  if (isLoading) {
    return (
      <div className="py-20 flex flex-col items-center gap-3">
        <div className="w-8 h-8 border-3 border-indigo-650 border-t-transparent rounded-full animate-spin"></div>
        <span className="text-xs text-slate-400 font-semibold">Carregando painel de compliance regulatório...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white flex items-center gap-3">
            <ShieldCheck className="w-8 h-8 text-indigo-500" />
            Painel Geral de Compliance & Auditoria
          </h1>
          <p className="text-slate-450 text-sm mt-1">
            Auditoria técnica interna de assinaturas, biometria facial, e conformidade com Portaria 671 MTE / LGPD.
          </p>
        </div>
        <button
          onClick={fetchComplianceData}
          className="p-2 rounded bg-slate-800 hover:bg-slate-750 text-slate-400 hover:text-white transition-all cursor-pointer"
          title="Recarregar Indicadores"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Compliance Alerts */}
      {overview?.alerts?.length > 0 && (
        <div className="p-4 rounded-xl bg-amber-950/20 border border-amber-500/20 text-amber-300 space-y-2.5 animate-fadeIn">
          <div className="flex gap-2 items-start">
            <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <h4 className="text-xs font-bold text-white uppercase">Alertas de Governança Pendentes</h4>
              <ul className="text-[11px] list-disc list-inside text-slate-400 space-y-1">
                {overview.alerts.includes('BIOMETRIC_POLICY_MISSING') && (
                  <li><strong>BIOMETRIC_POLICY_MISSING</strong>: Empresa com biometria habilitada sem definição legal de base declarada.</li>
                )}
                {overview.alerts.includes('BIOMETRIC_NO_ALTERNATIVE_METHOD') && (
                  <li><strong>BIOMETRIC_NO_ALTERNATIVE_METHOD</strong>: Falta de especificação de método de ponto alternativo.</li>
                )}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Grid of compliance cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-xl space-y-3">
          <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Classificação de Jornada</h4>
          <div className="p-2.5 rounded bg-slate-950/50 border border-slate-850 font-mono text-[10px] text-amber-400">
            {overview?.timeTracking?.classificationStatus || 'PENDING'}
          </div>
          <p className="text-[10px] text-slate-500 leading-normal">
            Sistema operacional de presença com exportação AFD. Não certificado/homologado como REP-P ou REP-A autonomamente.
          </p>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-xl space-y-3">
          <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Assinaturas Eletrônicas</h4>
          <div className="p-2.5 rounded bg-slate-950/50 border border-slate-850 font-mono text-[10px] text-indigo-400">
            {overview?.signatures?.evidenceModelVersion || 'PENDING'}
          </div>
          <p className="text-[10px] text-slate-500 leading-normal">
            Aceite simples do espelho de ponto em conformidade com evidências eletrônicas (IP/User-Agent e Hash SHA-256).
          </p>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-xl space-y-3">
          <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Segurança Companion IA</h4>
          <div className="p-2.5 rounded bg-slate-950/50 border border-slate-850 font-mono text-[10px] text-emerald-400">
            Prompt Guard: {overview?.ai?.promptInjectionTestsStatus || 'PENDING'}
          </div>
          <p className="text-[10px] text-slate-500 leading-normal">
            Camada determinística ativa contra Prompt Injection e vazamento de dados confidenciais (secrets/CPFs/CIDs).
          </p>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-xl space-y-3">
          <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Parâmetros Biométricos</h4>
          <div className="p-2.5 rounded bg-slate-950/50 border border-slate-850 font-mono text-[10px] text-indigo-450">
            Matching: Ativo | Liveness: Inativo
          </div>
          <p className="text-[10px] text-slate-500 leading-normal">
            Reconhecimento facial por MobileFaceNet (v1.4.2) com limiar de score padrão de 80.0%.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* AFD Validator block */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-xl space-y-4">
          <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
            <FileCheck2 className="w-4 h-4 text-indigo-400" />
            Validador Estrutural de Arquivo AFD
          </h3>

          <form onSubmit={handleValidateAfd} className="space-y-3">
            <textarea
              placeholder="Cole o conteúdo de texto da exportação AFD aqui..."
              value={afdText}
              onChange={(e) => setAfdText(e.target.value)}
              rows={8}
              className="w-full p-3 rounded-lg bg-slate-950 border border-slate-800 text-[10px] text-slate-350 font-mono focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
            <button
              type="submit"
              disabled={isValidating || !afdText.trim()}
              className="w-full py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs transition-colors cursor-pointer disabled:opacity-50"
            >
              {isValidating ? 'Validando Arquivo...' : 'Executar Validação Técnica'}
            </button>
          </form>

          {validationResult && (
            <div className="p-4 rounded-lg bg-slate-950 border border-slate-850 space-y-2.5 animate-fadeIn">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-300">Resultado Técnico:</span>
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                  validationResult.valid ? 'bg-emerald-500/10 text-emerald-450 border border-emerald-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'
                }`}>
                  {validationResult.valid ? 'ESTRUTURALMENTE VÁLIDO' : 'ESTRUTURA INVÁLIDA'}
                </span>
              </div>
              
              {validationResult.errors?.length > 0 && (
                <div className="space-y-1">
                  <p className="text-[10px] font-bold text-red-400">Erros Localizados:</p>
                  <ul className="text-[9px] list-disc list-inside text-slate-450 space-y-0.5">
                    {validationResult.errors.map((err: string, i: number) => (
                      <li key={i}>{err}</li>
                    ))}
                  </ul>
                </div>
              )}

              {validationResult.warnings?.length > 0 && (
                <div className="space-y-1">
                  <p className="text-[10px] font-bold text-amber-400">Alertas/Avisos:</p>
                  <ul className="text-[9px] list-disc list-inside text-slate-450 space-y-0.5">
                    {validationResult.warnings.map((warn: string, i: number) => (
                      <li key={i}>{warn}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Biometrics capabilities info block */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-xl space-y-4">
          <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
            <Cpu className="w-4 h-4 text-emerald-400" />
            Parâmetros do Modelo Biométrico
          </h3>

          <div className="divide-y divide-slate-850">
            <div className="flex justify-between py-2.5">
              <span className="text-xs text-slate-400">Nome do Modelo:</span>
              <span className="text-xs font-mono font-bold text-slate-200">{capabilities?.modelName}</span>
            </div>
            <div className="flex justify-between py-2.5">
              <span className="text-xs text-slate-400">Versão:</span>
              <span className="text-xs font-mono font-bold text-slate-200">{capabilities?.modelVersion}</span>
            </div>
            <div className="flex justify-between py-2.5">
              <span className="text-xs text-slate-400">Face Matching (Comparação):</span>
              <span className="text-xs font-bold text-emerald-400">ATIVO (SIMULADO)</span>
            </div>
            <div className="flex justify-between py-2.5">
              <span className="text-xs text-slate-400">Detecção de Prova de Vida (Liveness):</span>
              <span className="text-xs font-bold text-red-400">NÃO INTEGRADO</span>
            </div>
            <div className="flex justify-between py-2.5">
              <span className="text-xs text-slate-400">Anti-Spoofing (Anti-Foto):</span>
              <span className="text-xs font-bold text-red-400">NÃO INTEGRADO</span>
            </div>
            <div className="flex justify-between py-2.5">
              <span className="text-xs text-slate-400">Limiar de Precisão:</span>
              <span className="text-xs font-mono font-bold text-slate-200">{capabilities?.threshold}%</span>
            </div>
            <div className="flex justify-between py-2.5">
              <span className="text-xs text-slate-400">Métrica FAR (Falso Aceite):</span>
              <span className="text-xs font-mono font-bold text-slate-500">NÃO AVALIADO</span>
            </div>
            <div className="flex justify-between py-2.5">
              <span className="text-xs text-slate-400">Métrica FRR (Falso Rejeito):</span>
              <span className="text-xs font-mono font-bold text-slate-500">NÃO AVALIADO</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
