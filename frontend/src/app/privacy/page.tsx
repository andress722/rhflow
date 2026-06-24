import React from 'react';
import Link from 'next/link';
import { Metadata } from 'next';
import { ArrowLeft, Shield } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Política de Privacidade — PresençaFlow RH',
  description: 'Leia a nossa política de privacidade e saiba como protegemos os dados pessoais coletados na plataforma.',
  alternates: {
    canonical: 'https://presencaflow.com/privacy',
  },
};

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans p-6 md:p-12 selection:bg-indigo-500 selection:text-white">
      <div className="max-w-3xl mx-auto space-y-8">
        <Link href="/" className="flex items-center gap-2 text-slate-400 hover:text-slate-200 transition-colors text-sm font-semibold">
          <ArrowLeft className="w-4 h-4" />
          <span>Voltar ao início</span>
        </Link>

        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
              <Shield className="w-6 h-6" />
            </div>
            <h1 className="text-2xl font-bold text-white">Política de Privacidade</h1>
          </div>
          <p className="text-xs text-slate-400">Última atualização: 21 de junho de 2026</p>
        </div>

        <div className="prose prose-invert max-w-none text-slate-300 text-xs md:text-sm leading-relaxed space-y-6">
          <p>
            O <strong>PresençaFlow</strong> tem o compromisso de proteger a privacidade e a segurança dos dados pessoais de seus clientes, colaboradores e visitantes. Esta política descreve como coletamos, usamos e protegemos as informações fornecidas em nossa plataforma.
          </p>

          <h2 className="text-base font-bold text-white mt-8">1. Dados Coletados</h2>
          <p>
            Coletamos informações essenciais para o contato comercial e prestação de serviço, incluindo:
          </p>
          <ul className="list-disc pl-5 space-y-2">
            <li><strong>Formulários de Lead e Piloto:</strong> Nome completo, e-mail corporativo, nome da empresa, cargo, número de funcionários, principal dor informada e número de WhatsApp.</li>
            <li><strong>Dados de Acesso Técnico:</strong> Endereço IP (criptografado/hashed no banco de dados para segurança) e dados do navegador (User-Agent) para fins de controle de fraude e segurança cibernética.</li>
          </ul>

          <h2 className="text-base font-bold text-white mt-8">2. Finalidade do Tratamento</h2>
          <p>
            Todos os dados coletados são tratados estritamente para as seguintes finalidades:
          </p>
          <ul className="list-disc pl-5 space-y-2">
            <li>Avaliar e viabilizar a implantação de pilotos comerciais e demonstrações da ferramenta.</li>
            <li>Entrar em contato com o responsável comercial para tirar dúvidas e alinhar propostas de contratação.</li>
            <li>Garantir a integridade da plataforma através de controles de limites e combate ao spam/abuso.</li>
          </ul>

          <h2 className="text-base font-bold text-white mt-8">3. Proteção e Segurança dos Dados</h2>
          <p>
            Empregamos melhores práticas de segurança de informação para proteger seus dados, tais como:
          </p>
          <ul className="list-disc pl-5 space-y-2">
            <li>Isolamento de banco de dados por empresa (multi-tenant) para impedir acessos cruzados.</li>
            <li>Criptografia de dados sensíveis e hashes criptográficos para proteção do IP e senhas.</li>
            <li>Mascaramento de identificadores de diagnóstico para que informações confidenciais de colaboradores nunca fiquem expostas em logs operacionais.</li>
          </ul>

          <h2 className="text-base font-bold text-white mt-8">4. Contato</h2>
          <p>
            Para exercer seus direitos de exclusão, correção ou dúvidas relacionadas à privacidade de seus dados sob os termos da LGPD, entre em contato através de nosso e-mail de suporte comercial.
          </p>
        </div>

        <footer className="border-t border-slate-900 pt-8 text-center text-xs text-slate-500">
          <p>© {new Date().getFullYear()} PresençaFlow. Todos os direitos reservados.</p>
        </footer>
      </div>
    </div>
  );
}
