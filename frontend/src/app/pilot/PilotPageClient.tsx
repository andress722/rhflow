'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { trackEvent } from '@/lib/analytics';
import {
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  Building2,
  User,
  Mail,
  MessageSquare,
  HelpCircle,
  Users
} from 'lucide-react';

export default function PilotPageClient() {
  // Input fields state
  const [name, setName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [role, setRole] = useState('');
  const [email, setEmail] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [employeeCount, setEmployeeCount] = useState('');
  const [mainPain, setMainPain] = useState('Atestados');
  
  // Campaign and UTM states
  const [utmSource, setUtmSource] = useState('');
  const [utmMedium, setUtmMedium] = useState('');
  const [utmCampaign, setUtmCampaign] = useState('');
  const [utmContent, setUtmContent] = useState('');
  const [utmTerm, setUtmTerm] = useState('');
  const [referrer, setReferrer] = useState('');
  const [landingPath, setLandingPath] = useState('');
  const [sourceQuery, setSourceQuery] = useState('Formulário Piloto');

  // Honeypot field (must remain empty)
  const [websiteUrl, setWebsiteUrl] = useState('');

  // UX states
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Client-side validations
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [formStartedTracked, setFormStartedTracked] = useState(false);

  // Capture UTM parameters and referrers safely on component mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const searchParams = new URLSearchParams(window.location.search);
      setUtmSource(searchParams.get('utm_source') || '');
      setUtmMedium(searchParams.get('utm_medium') || '');
      setUtmCampaign(searchParams.get('utm_campaign') || '');
      setUtmContent(searchParams.get('utm_content') || '');
      setUtmTerm(searchParams.get('utm_term') || '');
      setSourceQuery(searchParams.get('source') || 'Formulário Piloto');
      
      setReferrer(document.referrer || '');
      setLandingPath(window.location.pathname || '/pilot');

      trackEvent('landing_viewed', { path: window.location.pathname });
    }
  }, []);

  const handleInputChange = (setter: React.Dispatch<React.SetStateAction<string>>) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setter(e.target.value);
    if (!formStartedTracked) {
      trackEvent('pilot_form_started');
      setFormStartedTracked(true);
    }
  };

  const validate = () => {
    const errors: Record<string, string> = {};
    if (!name.trim()) errors.name = 'Nome é obrigatório';
    if (!companyName.trim()) errors.companyName = 'Nome da empresa é obrigatório';
    
    if (!email.trim()) {
      errors.email = 'E-mail é obrigatório';
    } else {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        errors.email = 'Insira um e-mail válido';
      }
    }

    if (employeeCount) {
      const count = parseInt(employeeCount, 10);
      if (isNaN(count) || count < 1 || count > 100000) {
        errors.employeeCount = 'O número de funcionários deve ser entre 1 e 100.000';
      }
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return; // Prevent double submit
    
    trackEvent('pilot_cta_clicked');
    trackEvent('pilot_form_submitted', { companyName: companyName.trim() });

    if (!validate()) return;

    setLoading(true);
    setError(null);

    const payload = {
      name: name.trim(),
      companyName: companyName.trim(),
      role: role.trim() || undefined,
      email: email.trim().toLowerCase(),
      whatsapp: whatsapp.trim() || undefined,
      employeeCount: employeeCount ? parseInt(employeeCount, 10) : undefined,
      mainPain: mainPain || undefined,
      websiteUrl: websiteUrl.trim() || undefined, // honeypot
      
      // Campaign sources
      utmSource: utmSource || undefined,
      utmMedium: utmMedium || undefined,
      utmCampaign: utmCampaign || undefined,
      utmContent: utmContent || undefined,
      utmTerm: utmTerm || undefined,
      referrer: referrer || undefined,
      landingPath: landingPath || undefined,
      source: sourceQuery || undefined,
    };

    try {
      const response = await api.post('/public/pilot-leads', payload);
      if (response.success) {
        trackEvent('lead_created_success', { companyName: companyName.trim() });
        setSuccess(true);
      } else {
        trackEvent('lead_created_error', { code: response.error?.code });
        setError(response.error?.message || 'Erro ao enviar candidatura. Tente novamente.');
      }
    } catch (err) {
      trackEvent('lead_created_error', { code: 'NETWORK_ERROR' });
      setError('Erro de rede ao enviar solicitação. Verifique sua conexão.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl p-8 shadow-xl space-y-6">
      {success ? (
        /* Success State */
        <div className="text-center py-8 space-y-4">
          <div className="w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center justify-center mx-auto mb-2 animate-bounce">
            <CheckCircle2 className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-bold text-white">Solicitação Recebida!</h2>
          <p className="text-sm text-slate-400 leading-relaxed max-w-md mx-auto">
            Agradecemos seu interesse no PresençaFlow. Nossa equipe comercial analisará suas informações e entrará em contato em breve para estruturar o piloto comercial da sua empresa.
          </p>
          <div className="pt-4">
            <Link
              href="/"
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-semibold rounded-lg transition-colors border border-slate-700"
            >
              Voltar para Home
            </Link>
          </div>
        </div>
      ) : (
        /* Form State */
        <div className="space-y-6">
          <div className="space-y-2">
            <h1 className="text-xl font-bold text-white">Candidatura ao Piloto Comercial</h1>
            <p className="text-xs text-slate-400">
              Preencha as informações da sua empresa abaixo. Em breve entraremos em contato.
            </p>
          </div>

          {error && (
            <div className="p-3.5 bg-red-950/20 border border-red-800/40 rounded-lg flex items-start gap-2.5 text-red-400 text-xs">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Honeypot field (hidden from users) */}
            <div className="hidden" aria-hidden="true">
              <label htmlFor="websiteUrl">Website URL (Não preencher)</label>
              <input
                id="websiteUrl"
                type="text"
                value={websiteUrl}
                onChange={(e) => setWebsiteUrl(e.target.value)}
                tabIndex={-1}
                autoComplete="off"
              />
            </div>

            {/* Name */}
            <div className="space-y-1">
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Nome Completo</label>
              <div className="relative">
                <User className="absolute left-3 top-2.5 w-4 h-4 text-slate-500" />
                <input
                  type="text"
                  placeholder="Seu nome..."
                  value={name}
                  onChange={handleInputChange(setName)}
                  className={`w-full pl-9 pr-4 py-2 text-xs bg-slate-950 border rounded-lg text-slate-100 placeholder-slate-600 focus:outline-none focus:border-indigo-500 ${
                    validationErrors.name ? 'border-red-800/80 focus:border-red-800' : 'border-slate-800'
                  }`}
                />
              </div>
              {validationErrors.name && <p className="text-[10px] text-red-400 font-semibold">{validationErrors.name}</p>}
            </div>

            {/* Company Name */}
            <div className="space-y-1">
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Nome da Empresa</label>
              <div className="relative">
                <Building2 className="absolute left-3 top-2.5 w-4 h-4 text-slate-500" />
                <input
                  type="text"
                  placeholder="Nome fantasia ou Razão Social..."
                  value={companyName}
                  onChange={handleInputChange(setCompanyName)}
                  className={`w-full pl-9 pr-4 py-2 text-xs bg-slate-950 border rounded-lg text-slate-100 placeholder-slate-600 focus:outline-none focus:border-indigo-500 ${
                    validationErrors.companyName ? 'border-red-800/80 focus:border-red-800' : 'border-slate-800'
                  }`}
                />
              </div>
              {validationErrors.companyName && <p className="text-[10px] text-red-400 font-semibold">{validationErrors.companyName}</p>}
            </div>

            {/* Role (Optional) */}
            <div className="space-y-1">
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Seu Cargo (Opcional)</label>
              <div className="relative">
                <User className="absolute left-3 top-2.5 w-4 h-4 text-slate-500" />
                <input
                  type="text"
                  placeholder="EX: Gerente de RH, Diretor..."
                  value={role}
                  onChange={handleInputChange(setRole)}
                  className="w-full pl-9 pr-4 py-2 text-xs bg-slate-950 border border-slate-800 rounded-lg text-slate-100 placeholder-slate-600 focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Email */}
              <div className="space-y-1">
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">E-mail Corporativo</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-2.5 w-4 h-4 text-slate-500" />
                  <input
                    type="email"
                    placeholder="seuemail@empresa.com..."
                    value={email}
                    onChange={handleInputChange(setEmail)}
                    className={`w-full pl-9 pr-4 py-2 text-xs bg-slate-950 border rounded-lg text-slate-100 placeholder-slate-600 focus:outline-none focus:border-indigo-500 ${
                      validationErrors.email ? 'border-red-800/80 focus:border-red-800' : 'border-slate-800'
                    }`}
                  />
                </div>
                {validationErrors.email && <p className="text-[10px] text-red-400 font-semibold">{validationErrors.email}</p>}
              </div>

              {/* WhatsApp (Optional) */}
              <div className="space-y-1">
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">WhatsApp (Opcional)</label>
                <div className="relative">
                  <MessageSquare className="absolute left-3 top-2.5 w-4 h-4 text-slate-500" />
                  <input
                    type="text"
                    placeholder="(99) 99999-9999..."
                    value={whatsapp}
                    onChange={handleInputChange(setWhatsapp)}
                    className="w-full pl-9 pr-4 py-2 text-xs bg-slate-950 border border-slate-800 rounded-lg text-slate-100 placeholder-slate-600 focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Employee Count (Optional) */}
              <div className="space-y-1">
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Nº de Funcionários (Opcional)</label>
                <div className="relative">
                  <Users className="absolute left-3 top-2.5 w-4 h-4 text-slate-500" />
                  <input
                    type="number"
                    placeholder="EX: 15, 120..."
                    value={employeeCount}
                    onChange={handleInputChange(setEmployeeCount)}
                    className={`w-full pl-9 pr-4 py-2 text-xs bg-slate-950 border rounded-lg text-slate-100 placeholder-slate-600 focus:outline-none focus:border-indigo-500 ${
                      validationErrors.employeeCount ? 'border-red-800/80 focus:border-red-800' : 'border-slate-800'
                    }`}
                  />
                </div>
                {validationErrors.employeeCount && <p className="text-[10px] text-red-400 font-semibold">{validationErrors.employeeCount}</p>}
              </div>

              {/* Main Pain */}
              <div className="space-y-1">
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Principal Dor</label>
                <div className="relative">
                  <HelpCircle className="absolute left-3 top-2.5 w-4 h-4 text-slate-500" />
                  <select
                    value={mainPain}
                    onChange={handleInputChange(setMainPain)}
                    className="w-full pl-9 pr-4 py-2 text-xs bg-slate-950 border border-slate-800 rounded-lg text-slate-100 focus:outline-none focus:border-indigo-500"
                  >
                    <option value="Atestados">Atestados médicos acumulados</option>
                    <option value="Faltas">Faltas excessivas</option>
                    <option value="Atrasos">Atrasos constantes</option>
                    <option value="Ponto esquecido">Ponto esquecido recorrente</option>
                    <option value="Trabalho remoto/híbrido">Acompanhamento remoto/híbrido</option>
                    <option value="Relatórios">Dificuldade com relatórios</option>
                    <option value="Outro">Outro motivo</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white font-bold text-sm rounded-lg transition-colors flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    <span>Enviando Candidatura...</span>
                  </>
                ) : (
                  <span>Solicitar Piloto</span>
                )}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
