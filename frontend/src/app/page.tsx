import React from 'react';
import Link from 'next/link';
import { Metadata } from 'next';
import {
  MessageSquare,
  ShieldCheck,
  Zap,
  Users,
  Clock,
  FileText,
  HelpCircle,
  ArrowRight,
  Building2,
  Lock,
  Calendar,
  AlertTriangle,
  CheckCircle2,
  XCircle
} from 'lucide-react';

export const metadata: Metadata = {
  title: 'PresençaFlow RH — Faltas, atrasos e atestados pelo WhatsApp',
  description: 'Automatize faltas, atrasos, atestados e ponto esquecido pelo WhatsApp, com ocorrências, evidências e relatórios para RH e gestores.',
  alternates: {
    canonical: 'https://presencaflow.com',
  },
  openGraph: {
    title: 'PresençaFlow RH — Faltas, atrasos e atestados pelo WhatsApp',
    description: 'Automatize faltas, atrasos, atestados e ponto esquecido pelo WhatsApp, com ocorrências, evidências e relatórios para RH e gestores.',
    url: 'https://presencaflow.com',
    siteName: 'PresençaFlow RH',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'PresençaFlow RH — Faltas, atrasos e atestados pelo WhatsApp',
    description: 'Automatize faltas, atrasos, atestados e ponto esquecido pelo WhatsApp, com ocorrências, evidências e relatórios para RH e gestores.',
  },
};

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans selection:bg-indigo-500 selection:text-white">
      {/* Top Navbar */}
      <header className="fixed top-0 left-0 right-0 h-16 bg-slate-900/80 backdrop-blur-md border-b border-slate-800/80 z-50 flex items-center justify-between px-6 md:px-12">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center font-bold text-white text-md">
            PF
          </div>
          <span className="font-bold text-lg text-white tracking-tight">PresençaFlow</span>
        </div>
        <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-slate-400">
          <a href="#problema" className="hover:text-slate-200 transition-colors">O Problema</a>
          <a href="#solucao" className="hover:text-slate-200 transition-colors">A Solução</a>
          <a href="#como-funciona" className="hover:text-slate-200 transition-colors">Como Funciona</a>
          <a href="#alinhamento" className="hover:text-slate-200 transition-colors">Para Quem É</a>
          <a href="#planos" className="hover:text-slate-200 transition-colors">Planos</a>
          <a href="#seguranca" className="hover:text-slate-200 transition-colors">Segurança</a>
        </nav>
        <div className="flex items-center gap-4">
          <Link
            href="/login"
            className="text-sm font-semibold text-slate-300 hover:text-white px-4 py-2 transition-colors"
          >
            Entrar
          </Link>
          <Link
            href="/pilot"
            className="text-sm font-semibold bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white px-4 py-2 rounded-lg transition-all shadow-md shadow-indigo-600/10"
          >
            Solicitar Piloto
          </Link>
        </div>
      </header>

      {/* Hero Section */}
      <section className="pt-32 pb-20 px-6 md:px-12 max-w-7xl mx-auto flex flex-col items-center text-center space-y-8">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/25 text-indigo-400 text-xs font-semibold">
          <Zap className="w-3.5 h-3.5" />
          <span>Onboarding Simplificado via WhatsApp</span>
        </div>
        <h1 className="text-4xl md:text-6xl font-extrabold text-white tracking-tight leading-tight max-w-4xl">
          Controle faltas, atrasos, atestados e ponto esquecido pelo{' '}
          <span className="bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400">
            WhatsApp.
          </span>
        </h1>
        <p className="text-slate-400 text-base md:text-lg max-w-2xl leading-relaxed">
          O PresençaFlow automatiza a confirmação de presença remota e híbrida de seus colaboradores, gerencia ocorrências instantaneamente e homologa atestados de forma ágil e centralizada.
        </p>
        <div className="flex flex-col sm:flex-row items-center gap-4 pt-4">
          <Link
            href="/pilot"
            className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-3.5 bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white font-bold rounded-lg transition-all shadow-lg shadow-indigo-600/20"
          >
            <span>Solicitar Piloto</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
          <Link
            href="/pilot"
            className="w-full sm:w-auto px-6 py-3.5 bg-slate-900 hover:bg-slate-800 active:bg-slate-950 text-slate-300 hover:text-white font-semibold rounded-lg border border-slate-800 transition-colors"
          >
            Agendar Demonstração
          </Link>
        </div>
      </section>

      {/* Problema Section */}
      <section id="problema" className="py-20 bg-slate-900/40 border-y border-slate-900/80 px-6 md:px-12">
        <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
          <div className="space-y-6">
            <h2 className="text-2xl md:text-3xl font-extrabold text-white">O Gargalo no Acompanhamento de Pessoal</h2>
            <p className="text-slate-400 text-sm md:text-base leading-relaxed">
              Manter o controle de jornadas de trabalho externas, remotas ou híbridas gera atrito diário. O RH perde horas valiosas cobrando ponto esquecido, organizando atestados recebidos em múltiplos canais e gerando relatórios de fechamento de folha manualmente.
            </p>
            <div className="space-y-3.5">
              {[
                'Cobranças manuais excessivas via mensagens informais.',
                'Atestados médicos perdidos ou acumulados em caixas de entrada.',
                'Ocorrências acumuladas dificultando o fechamento do espelho de ponto.',
                'Falta de visibilidade em tempo real para gestores e diretores.'
              ].map((text, i) => (
                <div key={i} className="flex items-start gap-2.5 text-xs md:text-sm text-slate-300">
                  <span className="text-red-400 font-bold mt-0.5">✕</span>
                  <span>{text}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="bg-slate-950 border border-slate-800 p-8 rounded-2xl space-y-6 shadow-xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-24 h-24 bg-red-500/5 rounded-full blur-2xl"></div>
            <h3 className="text-md font-bold text-red-400">Rotina sem Automação:</h3>
            <div className="space-y-4">
              <div className="flex gap-3 text-xs bg-red-950/20 border border-red-900/30 p-3 rounded-lg">
                <Clock className="w-4 h-4 text-red-400 shrink-0" />
                <div>
                  <p className="font-semibold text-slate-200">10:00 — Cobrança de Presença</p>
                  <p className="text-slate-500 mt-0.5">O RH envia mensagens manuais para 30 funcionários remotos que esqueceram de avisar o início da jornada.</p>
                </div>
              </div>
              <div className="flex gap-3 text-xs bg-red-950/20 border border-red-900/30 p-3 rounded-lg">
                <FileText className="w-4 h-4 text-red-400 shrink-0" />
                <div>
                  <p className="font-semibold text-slate-200">15:30 — Triagem de Atestados</p>
                  <p className="text-slate-500 mt-0.5">Funcionários enviam fotos borradas de atestados no WhatsApp privado. Informações precisam ser digitadas em planilhas.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Solucao Section */}
      <section id="solucao" className="py-20 px-6 md:px-12 max-w-6xl mx-auto space-y-12">
        <div className="text-center max-w-2xl mx-auto space-y-3">
          <h2 className="text-2xl md:text-3xl font-extrabold text-white">Como o PresençaFlow resolve isso?</h2>
          <p className="text-slate-400 text-sm md:text-base">
            Uma abordagem simplificada, direta e automatizada que integra a comunicação do funcionário com a gestão corporativa.
          </p>
          <div className="pt-2">
            <a href="#como-funciona" className="text-xs text-indigo-400 hover:text-indigo-300 font-semibold underline">Ver como funciona</a>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-xl space-y-4 hover:border-slate-700 transition-colors">
            <div className="p-3 bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 rounded-lg w-fit">
              <MessageSquare className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-white">WhatsApp-First</h3>
            <p className="text-slate-400 text-xs md:text-sm leading-relaxed">
              O funcionário responde ao check-in diário com um clique e faz o upload de seus atestados médicos diretamente pelo WhatsApp. Sem precisar baixar aplicativos pesados.
            </p>
          </div>

          <div className="bg-slate-900 border border-slate-800 p-6 rounded-xl space-y-4 hover:border-slate-700 transition-colors">
            <div className="p-3 bg-purple-500/10 border border-purple-500/20 text-purple-400 rounded-lg w-fit">
              <Zap className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-white">Gestão de Ocorrências</h3>
            <p className="text-slate-400 text-xs md:text-sm leading-relaxed">
              Se houver atrasos ou ausências, ocorrências são geradas no sistema automaticamente. O RH e gestores avaliam pendências de forma ágil e centralizada em lote.
            </p>
          </div>

          <div className="bg-slate-900 border border-slate-800 p-6 rounded-xl space-y-4 hover:border-slate-700 transition-colors">
            <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-lg w-fit">
              <FileText className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-white">Relatórios Consolidados</h3>
            <p className="text-slate-400 text-xs md:text-sm leading-relaxed">
              Exporte relatórios operacionais consolidados em CSV em poucos segundos para integração direta com seu sistema de ponto tradicional ou folha de pagamento.
            </p>
          </div>
        </div>
      </section>

      {/* Como funciona Section */}
      <section id="como-funciona" className="py-20 bg-slate-900/30 border-y border-slate-900/60 px-6 md:px-12">
        <div className="max-w-6xl mx-auto space-y-12">
          <div className="text-center max-w-2xl mx-auto space-y-3">
            <h2 className="text-2xl md:text-3xl font-extrabold text-white">Fluxo de Trabalho Descomplicado</h2>
            <p className="text-slate-400 text-sm md:text-base">Passo a passo de como o sistema opera integrando colaboradores e administradores.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="bg-slate-950 border border-slate-800 p-5 rounded-xl space-y-3 text-center">
              <div className="w-8 h-8 rounded-full bg-indigo-500/10 text-indigo-400 flex items-center justify-center font-bold mx-auto border border-indigo-500/20 text-xs">1</div>
              <h4 className="text-sm font-bold text-white">Cadastre a Equipe</h4>
              <p className="text-slate-400 text-[11px] leading-relaxed">Importe seus funcionários rapidamente através de planilhas CSV ou via convites.</p>
            </div>
            <div className="bg-slate-950 border border-slate-800 p-5 rounded-xl space-y-3 text-center">
              <div className="w-8 h-8 rounded-full bg-indigo-500/10 text-indigo-400 flex items-center justify-center font-bold mx-auto border border-indigo-500/20 text-xs">2</div>
              <h4 className="text-sm font-bold text-white">Dispare Check-ins</h4>
              <p className="text-slate-400 text-[11px] leading-relaxed">O sistema envia notificações diárias de verificação pelo canal do WhatsApp conforme a jornada de trabalho.</p>
            </div>
            <div className="bg-slate-950 border border-slate-800 p-5 rounded-xl space-y-3 text-center">
              <div className="w-8 h-8 rounded-full bg-indigo-500/10 text-indigo-400 flex items-center justify-center font-bold mx-auto border border-indigo-500/20 text-xs">3</div>
              <h4 className="text-sm font-bold text-white">Homologue Solicitações</h4>
              <p className="text-slate-400 text-[11px] leading-relaxed">Acompanhe atestados submetidos e valide justificativas de ausências diretamente no painel admin.</p>
            </div>
            <div className="bg-slate-950 border border-slate-800 p-5 rounded-xl space-y-3 text-center">
              <div className="w-8 h-8 rounded-full bg-indigo-500/10 text-indigo-400 flex items-center justify-center font-bold mx-auto border border-indigo-500/20 text-xs">4</div>
              <h4 className="text-sm font-bold text-white">Pronto para a Folha</h4>
              <p className="text-slate-400 text-[11px] leading-relaxed">Feche a folha do mês exportando o relatório de fechamento operacional sem erros ou retrabalho.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Alinhamento de Expectativa Section */}
      <section id="alinhamento" className="py-20 px-6 md:px-12 max-w-6xl mx-auto space-y-12">
        <div className="text-center max-w-2xl mx-auto space-y-3">
          <h2 className="text-2xl md:text-3xl font-extrabold text-white">O PresençaFlow é o que você precisa?</h2>
          <p className="text-slate-400 text-sm md:text-base">
            Queremos garantir que nossa solução esteja perfeitamente alinhada com as necessidades operacionais de sua equipe.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Para quem é */}
          <div className="bg-slate-900/50 border border-slate-800 p-6 rounded-xl space-y-4">
            <h3 className="text-sm font-bold text-indigo-400 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4" />
              <span>Para quem é:</span>
            </h3>
            <ul className="space-y-2.5 text-xs text-slate-300">
              <li>• Setor de RH de pequenas e médias empresas procurando agilidade.</li>
              <li>• Clínicas, operações de campo, escritórios e equipes com jornadas híbridas/remotas.</li>
              <li>• Empresas que gerenciam faltas, atrasos e recebem atestados via canais informais (WhatsApp).</li>
              <li>• Gestores de equipe que necessitam de evidências e relatórios simplificados.</li>
            </ul>
          </div>

          {/* Para quem não é */}
          <div className="bg-slate-900/50 border border-slate-800 p-6 rounded-xl space-y-4">
            <h3 className="text-sm font-bold text-red-400 flex items-center gap-2">
              <XCircle className="w-4 h-4" />
              <span>Para quem não é:</span>
            </h3>
            <ul className="space-y-2.5 text-xs text-slate-300">
              <li>• Empresas procurando sistema completo de processamento de folha de pagamento.</li>
              <li>• Empresas que buscam substituir integralmente o sistema de relógio de ponto oficial.</li>
              <li>• Organizações que necessitam de consultoria jurídica trabalhista dedicada.</li>
              <li>• Organizações procurando um ERP completo e genérico de RH.</li>
            </ul>
          </div>

          {/* O que não substituímos */}
          <div className="bg-slate-900/50 border border-slate-800 p-6 rounded-xl space-y-4">
            <h3 className="text-sm font-bold text-amber-500 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" />
              <span>O que não substitui:</span>
            </h3>
            <ul className="space-y-2.5 text-xs text-slate-300">
              <li>• Processamento de Folha de pagamento.</li>
              <li>• Relógio de ponto eletrônico oficial (REP).</li>
              <li>• Assessoria jurídica ou trabalhista.</li>
              <li>• Contabilidade ou medicina do trabalho convencional.</li>
            </ul>
          </div>
        </div>
      </section>

      {/* Planos Section */}
      <section id="planos" className="py-20 bg-slate-900/40 border-y border-slate-900/80 px-6 md:px-12">
        <div className="max-w-6xl mx-auto space-y-12">
          <div className="text-center max-w-2xl mx-auto space-y-3">
            <h2 className="text-2xl md:text-3xl font-extrabold text-white">Nossos Planos</h2>
            <p className="text-slate-400 text-sm md:text-base">Preços transparentes para empresas de qualquer porte. Comece com nosso piloto comercial.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Starter Plan */}
            <div className="bg-slate-950 border border-slate-800 p-6 rounded-2xl flex flex-col justify-between space-y-6">
              <div className="space-y-4">
                <h4 className="text-base font-bold text-slate-100">Starter</h4>
                <p className="text-slate-400 text-xs">Ideal para equipes pequenas testando o fluxo básico.</p>
                <div className="text-2xl font-bold text-white">R$ 99<span className="text-xs font-normal text-slate-500"> / mês</span></div>
                <div className="h-px bg-slate-800"></div>
                <ul className="space-y-2.5 text-xs text-slate-400">
                  <li>✓ Até 5 funcionários ativos</li>
                  <li>✓ Check-ins pelo WhatsApp</li>
                  <li>✓ Relatórios simplificados</li>
                  <li className="text-slate-600">✕ Módulo de atestados médicos</li>
                </ul>
              </div>
              <Link href="/pilot" className="w-full text-center py-2.5 bg-slate-900 hover:bg-slate-800 text-slate-300 text-xs font-semibold rounded-lg border border-slate-800 transition-colors">
                Solicitar Piloto
              </Link>
            </div>

            {/* Pro Plan */}
            <div className="bg-slate-950 border-2 border-indigo-600 p-6 rounded-2xl flex flex-col justify-between space-y-6 relative shadow-lg shadow-indigo-600/5">
              <div className="absolute top-0 right-6 -translate-y-1/2 px-2.5 py-0.5 rounded-full bg-indigo-600 text-[10px] font-bold text-white uppercase tracking-wider">Mais Popular</div>
              <div className="space-y-4">
                <h4 className="text-base font-bold text-slate-100">Professional (PRO)</h4>
                <p className="text-slate-400 text-xs">Ideal para empresas de médio porte estruturando o setor de RH.</p>
                <div className="text-2xl font-bold text-white">R$ 299<span className="text-xs font-normal text-slate-500"> / mês</span></div>
                <div className="h-px bg-slate-800"></div>
                <ul className="space-y-2.5 text-xs text-slate-400">
                  <li>✓ Até 50 funcionários ativos</li>
                  <li>✓ Check-ins e ocorrências em lote</li>
                  <li>✓ Módulo completo de atestados médicos</li>
                  <li>✓ Relatórios e filtros avançados</li>
                </ul>
              </div>
              <Link href="/pilot" className="w-full text-center py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-lg transition-colors">
                Solicitar Piloto
              </Link>
            </div>

            {/* Enterprise Plan */}
            <div className="bg-slate-950 border border-slate-800 p-6 rounded-2xl flex flex-col justify-between space-y-6">
              <div className="space-y-4">
                <h4 className="text-base font-bold text-slate-100">Enterprise</h4>
                <p className="text-slate-400 text-xs">Para grandes empresas que necessitam de suporte técnico especializado.</p>
                <div className="text-2xl font-bold text-white">Sob Consulta</div>
                <div className="h-px bg-slate-800"></div>
                <ul className="space-y-2.5 text-xs text-slate-400">
                  <li>✓ Funcionários ilimitados</li>
                  <li>✓ Configuração de canal WhatsApp próprio</li>
                  <li>✓ Exportação de dados e integrações personalizadas</li>
                  <li>✓ SLA de suporte dedicado</li>
                </ul>
              </div>
              <Link href="/pilot" className="w-full text-center py-2.5 bg-slate-900 hover:bg-slate-800 text-slate-300 text-xs font-semibold rounded-lg border border-slate-800 transition-colors">
                Solicitar Piloto
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Seguranca Section */}
      <section id="seguranca" className="py-20 px-6 md:px-12 max-w-6xl mx-auto space-y-12">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
          <div className="space-y-6">
            <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-lg w-fit">
              <Lock className="w-6 h-6" />
            </div>
            <h2 className="text-2xl md:text-3xl font-extrabold text-white">Segurança e Privacidade de Dados por Padrão</h2>
            <p className="text-slate-400 text-sm md:text-base leading-relaxed">
              Tratamos os dados de seus colaboradores com extremo rigor ético e conformidade técnica. Nosso ecossistema de infraestrutura utiliza criptografia ponta a ponta e rígido controle de isolamento lógico de multi-inquilinos (multi-tenant) para assegurar que apenas usuários autorizados acessem os dados.
            </p>
            <div className="grid grid-cols-2 gap-4 text-xs">
              <div className="p-3 bg-slate-900 border border-slate-800 rounded-lg">
                <p className="font-bold text-slate-200">Isolamento Lógico</p>
                <p className="text-slate-500 mt-1">Garantia técnica de que os dados de uma empresa nunca cruzarão com outra.</p>
              </div>
              <div className="p-3 bg-slate-900 border border-slate-800 rounded-lg">
                <p className="font-bold text-slate-200">Rastreabilidade</p>
                <p className="text-slate-500 mt-1">AuditLog persistente que registra ações críticas executadas na plataforma.</p>
              </div>
            </div>
          </div>
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-xl space-y-4">
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>Conformidade Legal & LGPD</span>
            </h4>
            <p className="text-slate-400 text-xs leading-relaxed">
              Em conformidade com as diretrizes da Lei Geral de Proteção de Dados (LGPD):
            </p>
            <ul className="space-y-2.5 text-xs text-slate-300">
              <li className="flex gap-2">
                <span className="text-indigo-400">✓</span>
                <span>Armazenamento restrito às finalidades específicas de registro de presença laboral.</span>
              </li>
              <li className="flex gap-2">
                <span className="text-indigo-400">✓</span>
                <span>Políticas de segurança para solicitação de exclusão ou retificação de dados pessoais.</span>
              </li>
              <li className="flex gap-2">
                <span className="text-indigo-400">✓</span>
                <span>Mascaramento de identificadores e chaves confidenciais em todos os logs de diagnóstico técnico.</span>
              </li>
            </ul>
            <div className="pt-2 text-xs">
              <Link href="/privacy" className="text-indigo-400 hover:underline">Políticas de Privacidade</Link>
              <span className="text-slate-600 mx-2">|</span>
              <Link href="/terms" className="text-indigo-400 hover:underline">Termos de Uso</Link>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section id="faq" className="py-20 bg-slate-900/30 border-t border-slate-900/60 px-6 md:px-12">
        <div className="max-w-4xl mx-auto space-y-12">
          <div className="text-center space-y-3">
            <h2 className="text-2xl md:text-3xl font-extrabold text-white">Perguntas Frequentes (FAQ)</h2>
            <p className="text-slate-400 text-sm md:text-base">Dúvidas rápidas sobre nossa implantação e operação.</p>
          </div>
          <div className="space-y-6">
            <div className="p-5 bg-slate-900/80 border border-slate-800 rounded-xl space-y-2">
              <h4 className="text-sm font-bold text-white flex items-center gap-2">
                <HelpCircle className="w-4 h-4 text-indigo-400 shrink-0" />
                <span>O funcionário precisa baixar algum aplicativo no celular?</span>
              </h4>
              <p className="text-slate-400 text-xs md:text-sm pl-6 leading-relaxed">
                Não. A comunicação é realizada de forma totalmente transparente pelo WhatsApp. O funcionário clica em botões interativos diretamente no aplicativo de conversas que já possui instalado.
              </p>
            </div>

            <div className="p-5 bg-slate-900/80 border border-slate-800 rounded-xl space-y-2">
              <h4 className="text-sm font-bold text-white flex items-center gap-2">
                <HelpCircle className="w-4 h-4 text-indigo-400 shrink-0" />
                <span>Como funciona a simulação ou uso do WhatsApp real?</span>
              </h4>
              <p className="text-slate-400 text-xs md:text-sm pl-6 leading-relaxed">
                Durante a fase piloto ou teste, o canal é fornecido de forma simulada no próprio sistema ou utilizando chaves de desenvolvimento. Para operação em produção, é possível ativar a API do Meta Cloud oficial.
              </p>
            </div>

            <div className="p-5 bg-slate-900/80 border border-slate-800 rounded-xl space-y-2">
              <h4 className="text-sm font-bold text-white flex items-center gap-2">
                <HelpCircle className="w-4 h-4 text-indigo-400 shrink-0" />
                <span>É possível integrar com os sistemas de ponto eletrônico atuais?</span>
              </h4>
              <p className="text-slate-400 text-xs md:text-sm pl-6 leading-relaxed">
                Sim. A plataforma disponibiliza a exportação completa de relatórios em CSV estruturado, facilitando a importação em sistemas de espelho de ponto convencionais do mercado.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Final CTA Section */}
      <section className="py-20 px-6 md:px-12 text-center max-w-4xl mx-auto space-y-8">
        <h2 className="text-3xl md:text-4xl font-extrabold text-white">Modernize a gestão de jornada de sua empresa</h2>
        <p className="text-slate-400 text-base max-w-xl mx-auto">
          Participe do nosso piloto assistido e elimine as planilhas do RH.
        </p>
        <div>
          <Link
            href="/pilot"
            className="inline-flex items-center gap-2 px-8 py-4 bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white font-bold rounded-lg transition-all shadow-lg shadow-indigo-600/25"
          >
            <span>Solicitar Piloto</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-900 py-8 px-6 md:px-12 flex flex-col md:flex-row items-center justify-between text-xs text-slate-500 gap-4">
        <div>
          <p>© {new Date().getFullYear()} PresençaFlow. Todos os direitos reservados.</p>
        </div>
        <div className="flex gap-4">
          <Link href="/privacy" className="hover:text-slate-400">Privacidade</Link>
          <Link href="/terms" className="hover:text-slate-400">Termos</Link>
        </div>
      </footer>
    </div>
  );
}
