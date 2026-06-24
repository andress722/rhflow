import React from 'react';
import Link from 'next/link';
import { Metadata } from 'next';
import { ArrowLeft } from 'lucide-react';
import PilotPageClient from './PilotPageClient';

export const metadata: Metadata = {
  title: 'Solicitar piloto — PresençaFlow RH',
  description: 'Solicite um piloto do PresençaFlow RH e veja como organizar faltas, atrasos, atestados e ponto esquecido em uma rotina simples para RH.',
  alternates: {
    canonical: 'https://presencaflow.com/pilot',
  },
  openGraph: {
    title: 'Solicitar piloto — PresençaFlow RH',
    description: 'Solicite um piloto do PresençaFlow RH e veja como organizar faltas, atrasos, atestados e ponto esquecido em uma rotina simples para RH.',
    url: 'https://presencaflow.com/pilot',
    siteName: 'PresençaFlow RH',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Solicitar piloto — PresençaFlow RH',
    description: 'Solicite um piloto do PresençaFlow RH e veja como organizar faltas, atrasos, atestados e ponto esquecido em uma rotina simples para RH.',
  },
};

export default function PilotRegistrationPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans flex flex-col justify-between selection:bg-indigo-500 selection:text-white">
      {/* Header */}
      <header className="h-16 border-b border-slate-900 px-6 flex items-center justify-between max-w-7xl w-full mx-auto">
        <Link href="/" className="flex items-center gap-2 text-slate-400 hover:text-slate-200 transition-colors text-sm font-semibold">
          <ArrowLeft className="w-4 h-4" />
          <span>Voltar ao início</span>
        </Link>
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center font-bold text-white text-md">
            PF
          </div>
          <span className="font-bold text-slate-200 tracking-tight">PresençaFlow</span>
        </div>
      </header>

      {/* Main Body */}
      <main className="flex-1 flex items-center justify-center py-12 px-6">
        <PilotPageClient />
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-900 py-6 px-6 text-center text-xs text-slate-600">
        <p>© {new Date().getFullYear()} PresençaFlow. Todos os direitos reservados.</p>
      </footer>
    </div>
  );
}
