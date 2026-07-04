'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  Activity,
  Calendar,
  Clock,
  FileText,
  LayoutDashboard,
  LogOut,
  Settings,
  Users,
  ShieldAlert,
  ShieldCheck,
  BarChart3,
  Sliders,
  CreditCard,
  MessageSquare,
  Award,
  Cpu,
  Bell,
  Sparkles,
  Send,
  Bot,
  FileSpreadsheet,
} from 'lucide-react';
import { getUser, clearSession, isAuthenticated } from '@/lib/auth';
import { NotificationBell } from '@/components/NotificationBell';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [isReady, setIsReady] = useState(false);
  const [toasts, setToasts] = useState<any[]>([]);

  const [isAiSidebarOpen, setIsAiSidebarOpen] = useState(false);
  const [aiMessage, setAiMessage] = useState('');
  const [aiChat, setAiChat] = useState<Array<{ sender: 'user' | 'bot'; text: string; action?: string; metadata?: any }>>([
    { sender: 'bot', text: 'Olá! Sou o PresençaFlow AI Co-piloto. Você pode me pedir relatórios de presença, submissão de atestados ou análise de risco de turnover. O que gostaria de fazer agora?' }
  ]);
  const [isAiLoading, setIsAiLoading] = useState(false);

  const handleSendAiMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!aiMessage.trim() || isAiLoading) return;

    const userText = aiMessage;
    setAiChat((prev) => [...prev, { sender: 'user', text: userText }]);
    setAiMessage('');
    setIsAiLoading(true);

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api'}/ai/companion`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ message: userText })
      });
      const data = await response.json();
      if (data.success) {
        setAiChat((prev) => [...prev, {
          sender: 'bot',
          text: data.reply,
          action: data.action,
          metadata: data.metadata
        }]);
      } else {
        setAiChat((prev) => [...prev, { sender: 'bot', text: 'Desculpe, ocorreu um erro ao processar seu comando.' }]);
      }
    } catch (err) {
      setAiChat((prev) => [...prev, { sender: 'bot', text: 'Erro de conexão com o assistente IA.' }]);
    } finally {
      setIsAiLoading(false);
    }
  };

  const handleAiActionClick = (actionType: string, metadata: any) => {
    if (actionType === 'DOWNLOAD_REPORTS') {
      const filename = `Presenca_Consolidada_${metadata.employeeName.replace(/\s+/g, '_')}.xlsx`;
      const blob = new Blob(['Mock data content for timesheet'], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      
      setAiChat((prev) => [...prev, { sender: 'bot', text: `Pronto! O download de *${filename}* foi iniciado com sucesso.` }]);
    } else if (actionType === 'UPLOAD_CERTIFICATE') {
      setAiChat((prev) => [...prev, { sender: 'bot', text: `Perfeito! O atestado médico simulado para **${metadata.employeeName}** foi enviado e processado via OCR com sucesso no sistema.` }]);
    }
  };

  const addToast = (title: string, message: string) => {
    const id = Math.random().toString();
    setToasts((prev) => [...prev, { id, title, message }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 5000);
  };

  useEffect(() => {
    if (!isReady || !user) return;

    const token = localStorage.getItem('token');
    if (!token) return;

    const appApiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';
    const eventSource = new EventSource(`${appApiUrl}/notifications/stream?token=${token}`);

    eventSource.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        if (payload.event === 'notification' && payload.data) {
          addToast(payload.data.title, payload.data.message);
          window.dispatchEvent(new CustomEvent('new-notification', { detail: payload.data }));
        }
      } catch (err) {
        console.error('Error parsing SSE message:', err);
      }
    };

    return () => {
      eventSource.close();
    };
  }, [isReady, user]);

  useEffect(() => {
    if (!isAuthenticated()) {
      clearSession();
      router.push('/login');
    } else {
      const currentUser = getUser();
      if (currentUser?.mustChangePassword) {
        router.push('/change-password');
      } else {
        setUser(currentUser);
        setIsReady(true);
      }
    }
  }, [router, pathname]);

  useEffect(() => {
    // Dynamic manifest link append
    let link = document.querySelector('link[rel="manifest"]') as HTMLLinkElement;
    if (!link) {
      link = document.createElement('link');
      link.rel = 'manifest';
      link.href = '/manifest.json';
      document.head.appendChild(link);
    }

    // Register Service Worker for offline PWA capabilities
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').then((registration) => {
        console.log('Service Worker registered successfully with scope:', registration.scope);
      }).catch((err) => {
        console.error('Service Worker registration failed:', err);
      });
    }
  }, []);

  const handleLogout = () => {
    clearSession();
    router.push('/login');
  };

  if (!isReady || !user) {
    return (
      <div className="flex h-screen w-screen bg-slate-950 items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
          <span className="text-sm text-slate-400 font-medium">Carregando painel...</span>
        </div>
      </div>
    );
  }

  // 12. Configurações de usuários só devem aparecer para ADMIN e HR
  const showSettingsLink = ['ADMIN', 'HR'].includes(user.role);
  const showBillingLink = ['ADMIN', 'HR'].includes(user.role);
  const isSuperAdmin = user.role === 'SUPER_ADMIN';

  // Route guards
  const isPlatformRoute = pathname?.startsWith('/app/admin');
  let isForbidden = false;

  if (isSuperAdmin) {
    // SUPER_ADMIN can only access platform routes
    if (!isPlatformRoute && pathname !== '/app') {
      isForbidden = true;
    }
  } else {
    // Normal users cannot access platform routes
    if (isPlatformRoute) {
      isForbidden = true;
    }
    const isSettingsRoute = pathname?.startsWith('/app/settings');
    const isBillingRoute = pathname?.startsWith('/app/billing');
    const isCustomerSuccessRoute = pathname?.startsWith('/app/customer-success');
    if ((isSettingsRoute && !showSettingsLink) || (isBillingRoute && !showBillingLink) || (isCustomerSuccessRoute && !showSettingsLink)) {
      isForbidden = true;
    }
  }

  let menuItems: Array<{ name: string; href: string; icon: any }> = [];

  if (isSuperAdmin) {
    menuItems = [
      { name: 'Command Center', href: '/app/admin/command-center', icon: Sliders },
      { name: 'Rotinas e Jobs', href: '/app/admin/jobs', icon: Cpu },
      { name: 'Painel Plataforma', href: '/app/admin/companies', icon: Sliders },
      { name: 'Painel Suporte', href: '/app/admin/support', icon: ShieldAlert },
      { name: 'Painel Comercial', href: '/app/admin/leads', icon: Users },
      { name: 'Gestão de Pilotos', href: '/app/admin/pilots', icon: Award },
      { name: 'Faturamento e Contratos', href: '/app/admin/billing', icon: CreditCard },
      { name: 'Retenção e Churn', href: '/app/admin/retention', icon: ShieldAlert },
      { name: 'Notificações', href: '/app/admin/notifications', icon: Bell },
    ];
  } else {
    menuItems = [
      { name: 'Dashboard', href: '/app/dashboard', icon: LayoutDashboard },
      { name: 'Funcionários', href: '/app/employees', icon: Users },
      { name: 'Jornadas', href: '/app/work-schedules', icon: Calendar },
      { name: 'Ocorrências', href: '/app/occurrences', icon: Clock },
      { name: 'Atestados', href: '/app/medical-certificates', icon: FileText },
      { name: 'Presença', href: '/app/presence', icon: Activity },
      { name: 'Relatórios', href: '/app/reports', icon: BarChart3 },
      { name: 'Notificações', href: '/app/notifications', icon: Bell },
      { name: 'Área do Colaborador', href: '/app/employee-portal', icon: Clock },
    ];

    if (showBillingLink) {
      menuItems.push({ name: 'Plano e Uso', href: '/app/billing', icon: CreditCard });
    }
    if (showSettingsLink) {
      menuItems.push({ name: 'Config. Usuários', href: '/app/settings', icon: Settings });
      menuItems.push({ name: 'Config. Equipe', href: '/app/settings/team', icon: Users });
      menuItems.push({ name: 'Config. Empresa', href: '/app/settings/company', icon: Sliders });
      menuItems.push({ name: 'Config. WhatsApp', href: '/app/settings/whatsapp', icon: MessageSquare });
      menuItems.push({ name: 'Logs de Auditoria', href: '/app/settings/audit-logs', icon: ShieldCheck });
      menuItems.push({ name: 'Segurança (MFA)', href: '/app/settings/mfa', icon: ShieldAlert });
      // Add shortcut to Onboarding Checklist for ADMIN / HR
      menuItems.push({ name: 'Checklist Onboarding', href: '/app/onboarding', icon: FileText });
      menuItems.push({ name: 'Sucesso do Cliente', href: '/app/customer-success', icon: Activity });
    }
  }

  return (
    <div className="flex h-screen bg-slate-950 text-slate-100 overflow-hidden font-sans">
      {/* Sidebar */}
      <aside className="w-64 bg-slate-900 border-r border-slate-800 flex flex-col shrink-0">
        {/* Logo Section */}
        <div className="h-16 flex items-center px-6 border-b border-slate-800 gap-2">
          <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center font-bold text-white text-md">
            PF
          </div>
          <span className="font-bold text-lg text-white tracking-tight">PresençaFlow</span>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto px-4 py-6 space-y-1.5">
          {menuItems.map((item) => {
            const isActive = pathname === item.href;
            const Icon = item.icon;
            return (
              <Link
                key={item.name}
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/10'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{item.name}</span>
              </Link>
            );
          })}
        </nav>

        {/* User Info / Logout */}
        <div className="p-4 border-t border-slate-800 flex flex-col gap-3">
          <div className="flex items-center gap-3 px-2">
            <div className="w-9 h-9 rounded-full bg-indigo-950 border border-indigo-700 flex items-center justify-center font-bold text-indigo-300 uppercase">
              {user.name.substring(0, 2)}
            </div>
            <div className="flex-1 overflow-hidden">
              <p className="text-xs font-semibold text-slate-200 truncate">{user.name}</p>
              <p className="text-[10px] text-slate-500 truncate">{user.role} | {user.email}</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 w-full px-3 py-2 rounded-lg text-sm font-medium text-red-400 hover:text-red-300 hover:bg-red-950/20 transition-all"
          >
            <LogOut className="w-4 h-4" />
            <span>Sair do sistema</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="h-16 bg-slate-900 border-b border-slate-800 flex items-center justify-between px-8 z-10">
          <div className="flex items-center gap-2 text-sm text-slate-400">
            <span>PresençaFlow</span>
            <span>/</span>
            <span className="text-slate-200 font-medium capitalize">
              {pathname?.split('/').pop() || 'dashboard'}
            </span>
          </div>

          <div className="flex items-center gap-4">
            <NotificationBell isSuperAdmin={isSuperAdmin} />
            <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-medium">
              <Activity className="w-3.5 h-3.5" />
              <span>{isSuperAdmin ? 'Painel Plataforma Ativo' : 'Conexão WhatsApp Ativa'}</span>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto bg-slate-950 p-8">
          <div className="max-w-7xl mx-auto space-y-8">
            {isForbidden ? (
              /* Treatment for 403 Forbidden */
              <div className="flex flex-col items-center justify-center py-24 text-center">
                <div className="w-16 h-16 rounded-full bg-red-950/50 border border-red-800 flex items-center justify-center mb-6">
                  <ShieldAlert className="w-8 h-8 text-red-400" />
                </div>
                <h2 className="text-2xl font-bold text-white mb-2">Acesso Negado</h2>
                <p className="text-slate-400 max-w-md text-sm leading-relaxed mb-6">
                  {isSuperAdmin
                    ? 'Seu perfil de usuário é SUPER_ADMIN. Você só tem permissão para acessar o Painel de Controle de Plataforma.'
                    : `Seu perfil de usuário (${user.role}) não tem permissão para acessar esta página. Entre em contato com um administrador do sistema.`}
                </p>
                <Link
                  href={isSuperAdmin ? '/app/admin/companies' : '/app/dashboard'}
                  className="px-4 py-2 text-sm font-medium rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white transition-all"
                >
                  {isSuperAdmin ? 'Voltar ao Painel Plataforma' : 'Voltar ao Dashboard'}
                </Link>
              </div>
            ) : (
              children
            )}
          </div>
        </main>
      </div>

      {/* Dynamic Toasts Container */}
      <div className="fixed top-4 right-4 z-50 space-y-2 pointer-events-none">
        {toasts.map((t) => (
          <div key={t.id} className="w-80 p-4 rounded-lg bg-slate-900 border border-slate-800 text-slate-100 shadow-xl flex items-start gap-3 pointer-events-auto animate-slideIn">
            <Bell className="w-5 h-5 text-indigo-400 shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              <h5 className="text-xs font-bold text-white">{t.title}</h5>
              <p className="text-[11px] text-slate-400 leading-normal">{t.message}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Floating AI Companion Button */}
      <button
        onClick={() => setIsAiSidebarOpen(!isAiSidebarOpen)}
        className="fixed bottom-6 right-6 z-40 p-4 rounded-full bg-gradient-to-tr from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white shadow-xl shadow-indigo-500/20 hover:shadow-indigo-500/30 transition-all scale-100 hover:scale-105 active:scale-95 flex items-center justify-center cursor-pointer border border-indigo-400/30"
        title="Assistente Virtual Co-piloto IA"
      >
        <Sparkles className="w-6 h-6 animate-pulse" />
      </button>

      {/* AI Sidebar Panel */}
      {isAiSidebarOpen && (
        <div className="fixed inset-y-0 right-0 z-50 w-96 bg-slate-900 border-l border-slate-800 shadow-2xl flex flex-col animate-slideIn">
          <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/40">
            <div className="flex items-center gap-2">
              <Bot className="w-5 h-5 text-indigo-400" />
              <span className="text-sm font-bold text-white">PresençaFlow AI Co-piloto</span>
            </div>
            <button
              onClick={() => setIsAiSidebarOpen(false)}
              className="text-xs text-slate-400 hover:text-white transition-colors cursor-pointer"
            >
              Fechar
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {aiChat.map((msg, index) => (
              <div
                key={index}
                className={`flex flex-col gap-1 max-w-[85%] ${
                  msg.sender === 'user' ? 'ml-auto items-end' : 'mr-auto items-start'
                }`}
              >
                <div
                  className={`p-3 rounded-xl text-xs leading-relaxed ${
                    msg.sender === 'user'
                      ? 'bg-indigo-650 text-white rounded-br-none'
                      : 'bg-slate-950/70 border border-slate-850 text-slate-200 rounded-bl-none'
                  }`}
                >
                  <p className="whitespace-pre-line">{msg.text}</p>

                  {msg.sender === 'bot' && msg.action && (
                    <div className="mt-3 pt-3 border-t border-slate-850 flex flex-col gap-2">
                      {msg.action === 'DOWNLOAD_REPORTS' && (
                        <div className="flex flex-wrap gap-2">
                          <button
                            onClick={() => handleAiActionClick('DOWNLOAD_REPORTS', msg.metadata)}
                            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[10px] transition-colors cursor-pointer"
                          >
                            <FileSpreadsheet className="w-3.5 h-3.5" />
                            <span>Exportar Excel</span>
                          </button>
                          <button
                            onClick={() => handleAiActionClick('DOWNLOAD_REPORTS', msg.metadata)}
                            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-[10px] transition-colors cursor-pointer"
                          >
                            <FileText className="w-3.5 h-3.5" />
                            <span>Exportar PDF</span>
                          </button>
                        </div>
                      )}

                      {msg.action === 'UPLOAD_CERTIFICATE' && (
                        <div className="p-2.5 rounded bg-slate-900 border border-slate-850 space-y-2">
                          <p className="text-[10px] text-slate-400">Arraste ou confirme dados simulados para homologar atestado:</p>
                          <button
                            onClick={() => handleAiActionClick('UPLOAD_CERTIFICATE', msg.metadata)}
                            className="w-full py-1.5 rounded bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-[10px] transition-colors cursor-pointer"
                          >
                            Confirmar & Subir Atestado
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
            {isAiLoading && (
              <div className="flex items-center gap-2 text-xs text-slate-500 font-medium">
                <div className="w-3.5 h-3.5 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
                <span>Digitando...</span>
              </div>
            )}
          </div>

          <form onSubmit={handleSendAiMessage} className="p-3 border-t border-slate-800 bg-slate-950/20 flex gap-2">
            <input
              type="text"
              placeholder="Digite um comando para a IA..."
              value={aiMessage}
              onChange={(e) => setAiMessage(e.target.value)}
              className="flex-1 px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
            <button
              type="submit"
              className="p-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white transition-colors cursor-pointer flex items-center justify-center shrink-0"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
