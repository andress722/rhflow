import React from 'react';
import Link from 'next/link';
import { Metadata } from 'next';
import { ArrowLeft, FileText } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Termos de Uso — PresençaFlow RH',
  description: 'Leia os termos de uso e condições gerais da plataforma PresençaFlow.',
  alternates: {
    canonical: 'https://presencaflow.com/terms',
  },
};

export default function TermsOfServicePage() {
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
              <FileText className="w-6 h-6" />
            </div>
            <h1 className="text-2xl font-bold text-white">Termos de Uso</h1>
          </div>
          <p className="text-xs text-slate-400">Última atualização: 21 de junho de 2026</p>
        </div>

        <div className="prose prose-invert max-w-none text-slate-300 text-xs md:text-sm leading-relaxed space-y-6">
          <p>
            Bem-vindo ao <strong>PresençaFlow</strong>. Ao acessar nosso site público ou candidatar-se ao nosso programa piloto comercial, você concorda com os seguintes termos de uso.
          </p>

          <h2 className="text-base font-bold text-white mt-8">1. Uso Aceitável</h2>
          <p>
            Você concorda em fornecer informações cadastrais verídicas, exatas e atualizadas ao solicitar acesso ou submeter formulários na plataforma. É expressamente proibida a utilização de bots ou scripts automatizados para envio em massa de solicitações de leads (spam).
          </p>

          <h2 className="text-base font-bold text-white mt-8">2. Condições do Piloto Comercial</h2>
          <p>
            A participação no programa piloto comercial está sujeita à triagem e qualificação interna realizada pela nossa equipe de suporte e comercial. O envio da candidatura não garante a liberação imediata do acesso à plataforma.
          </p>

          <h2 className="text-base font-bold text-white mt-8">3. Propriedade Intelectual</h2>
          <p>
            Todo o conteúdo disponibilizado neste site, incluindo códigos, textos, designs, marcas corporativas e fluxos de negócio, são de propriedade intelectual exclusiva do PresençaFlow e protegidos por leis brasileiras e internacionais.
          </p>

          <h2 className="text-base font-bold text-white mt-8">4. Limitação de Responsabilidade</h2>
          <p>
            Na extensão máxima permitida pela lei aplicável, o PresençaFlow não se responsabiliza por prejuízos decorrentes do uso inadequado do sistema ou instabilidade temporária do canal de simulação e APIs de terceiros.
          </p>
        </div>

        <footer className="border-t border-slate-900 pt-8 text-center text-xs text-slate-500">
          <p>© {new Date().getFullYear()} PresençaFlow. Todos os direitos reservados.</p>
        </footer>
      </div>
    </div>
  );
}
