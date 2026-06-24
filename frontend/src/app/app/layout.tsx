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
  BarChart3,
  Sliders,
  CreditCard,
  MessageSquare,
  Award,
} from 'lucide-react';
import { getUser, clearSession, isAuthenticated } from '@/lib/auth';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [isReady, setIsReady] = useState(false);

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
      { name: 'Painel Plataforma', href: '/app/admin/companies', icon: Sliders },
      { name: 'Painel Suporte', href: '/app/admin/support', icon: ShieldAlert },
      { name: 'Painel Comercial', href: '/app/admin/leads', icon: Users },
      { name: 'Gestão de Pilotos', href: '/app/admin/pilots', icon: Award },
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
    ];

    if (showBillingLink) {
      menuItems.push({ name: 'Plano e Uso', href: '/app/billing', icon: CreditCard });
    }
    if (showSettingsLink) {
      menuItems.push({ name: 'Config. Usuários', href: '/app/settings', icon: Settings });
      menuItems.push({ name: 'Config. Equipe', href: '/app/settings/team', icon: Users });
      menuItems.push({ name: 'Config. Empresa', href: '/app/settings/company', icon: Sliders });
      menuItems.push({ name: 'Config. WhatsApp', href: '/app/settings/whatsapp', icon: MessageSquare });
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
    </div>
  );
}
