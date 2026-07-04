'use client';

import React, { useEffect, useState, useRef } from 'react';
import { Bell, Check, Trash2, CheckCircle2, AlertTriangle, AlertCircle, Info } from 'lucide-react';
import { api } from '@/lib/api';
import { useRouter } from 'next/navigation';

interface NotificationBellProps {
  isSuperAdmin: boolean;
}

interface NotificationItem {
  id: string;
  title: string;
  message: string;
  severity: 'INFO' | 'SUCCESS' | 'WARNING' | 'CRITICAL';
  status: 'UNREAD' | 'READ' | 'DISMISSED' | 'RESOLVED';
  actionUrl?: string | null;
  createdAt: string;
}

export function NotificationBell({ isSuperAdmin }: NotificationBellProps) {
  const router = useRouter();
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const fetchUnreadCount = async () => {
    try {
      const endpoint = isSuperAdmin ? '/admin/notifications/unread-count' : '/notifications/unread-count';
      const res: any = await api.get(endpoint);
      if (res.success && typeof res.count === 'number') {
        setUnreadCount(res.count);
      }
    } catch (err) {
      console.error('Error fetching unread count:', err);
    }
  };

  const fetchNotifications = async () => {
    setLoading(true);
    try {
      const endpoint = isSuperAdmin ? '/admin/notifications?pageSize=10' : '/notifications?pageSize=10';
      const res: any = await api.get(endpoint);
      if (res.success && Array.isArray(res.items)) {
        setNotifications(res.items);
      }
    } catch (err) {
      console.error('Error fetching notifications:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUnreadCount();
    
    const handleNewNotification = () => {
      fetchUnreadCount();
      if (isOpen) {
        fetchNotifications();
      }
    };
    window.addEventListener('new-notification', handleNewNotification);

    // Poll every 60s
    const timer = setInterval(fetchUnreadCount, 60000);
    return () => {
      clearInterval(timer);
      window.removeEventListener('new-notification', handleNewNotification);
    };
  }, [isSuperAdmin, isOpen]);

  useEffect(() => {
    if (isOpen) {
      fetchNotifications();
    }
  }, [isOpen]);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleMarkAsRead = async (id: string, actionUrl?: string | null) => {
    try {
      const endpoint = isSuperAdmin ? `/admin/notifications/${id}/read` : `/notifications/${id}/read`;
      const res = await api.patch(endpoint);
      if (res.success) {
        setUnreadCount((prev) => Math.max(0, prev - 1));
        setNotifications((prev) =>
          prev.map((n) => (n.id === id ? { ...n, status: 'READ' as const } : n))
        );
        if (actionUrl) {
          router.push(actionUrl);
          setIsOpen(false);
        }
      }
    } catch (err) {
      console.error('Error marking notification as read:', err);
    }
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'CRITICAL':
        return <AlertCircle className="w-4 h-4 text-red-500" />;
      case 'WARNING':
        return <AlertTriangle className="w-4 h-4 text-amber-500" />;
      case 'SUCCESS':
        return <CheckCircle2 className="w-4 h-4 text-emerald-500" />;
      default:
        return <Info className="w-4 h-4 text-slate-400" />;
    }
  };

  const getSeverityStyles = (severity: string) => {
    switch (severity) {
      case 'CRITICAL':
        return 'bg-red-500/10 border-red-500/20 text-red-400';
      case 'WARNING':
        return 'bg-amber-500/10 border-amber-500/20 text-amber-400';
      case 'SUCCESS':
        return 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400';
      default:
        return 'bg-slate-500/10 border-slate-500/20 text-slate-400';
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 transition-all cursor-pointer"
        aria-label="Notificações"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-rose-600 text-[10px] font-bold text-white ring-2 ring-slate-900 animate-pulse">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 rounded-xl bg-slate-900 border border-slate-800 shadow-2xl z-50 overflow-hidden backdrop-blur-md">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800 bg-slate-900/80">
            <span className="text-sm font-bold text-slate-100 flex items-center gap-1.5">
              Notificações
              {unreadCount > 0 && (
                <span className="px-1.5 py-0.5 rounded-full bg-rose-500/10 text-rose-400 text-xs font-semibold">
                  {unreadCount} novas
                </span>
              )}
            </span>
            <button
              onClick={() => {
                setIsOpen(false);
                router.push(isSuperAdmin ? '/app/admin/notifications' : '/app/notifications');
              }}
              className="text-xs text-indigo-400 hover:text-indigo-300 font-medium transition-colors"
            >
              Ver todas
            </button>
          </div>

          {/* List */}
          <div className="max-h-80 overflow-y-auto divide-y divide-slate-800/60">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <div className="w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
              </div>
            ) : notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-center px-4">
                <Bell className="w-8 h-8 text-slate-600 mb-2 stroke-[1.5]" />
                <p className="text-xs text-slate-400 font-semibold">Nenhuma notificação</p>
                <p className="text-[10px] text-slate-500 mt-1 max-w-[200px]">Você está em dia com todos os alertas e tarefas.</p>
              </div>
            ) : (
              notifications.map((notif) => (
                <div
                  key={notif.id}
                  onClick={() => handleMarkAsRead(notif.id, notif.actionUrl)}
                  className={`flex gap-3 p-3.5 hover:bg-slate-850/40 transition-colors cursor-pointer text-left ${
                    notif.status === 'UNREAD' ? 'bg-indigo-950/10' : ''
                  }`}
                >
                  <div className={`w-8 h-8 rounded-lg border flex items-center justify-center shrink-0 ${getSeverityStyles(notif.severity)}`}>
                    {getSeverityIcon(notif.severity)}
                  </div>
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-start justify-between gap-2">
                      <p className={`text-xs font-semibold truncate ${
                        notif.status === 'UNREAD' ? 'text-slate-100' : 'text-slate-300'
                      }`}>
                        {notif.title}
                      </p>
                      <span className="text-[9px] text-slate-500 shrink-0 font-medium">
                        {formatDate(notif.createdAt)}
                      </span>
                    </div>
                    <p className={`text-[11px] leading-relaxed line-clamp-2 ${
                      notif.status === 'UNREAD' ? 'text-slate-300' : 'text-slate-400'
                    }`}>
                      {notif.message}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Footer */}
          <div className="p-2.5 bg-slate-950/40 border-t border-slate-800/80 text-center">
            <button
              onClick={() => {
                setIsOpen(false);
                router.push(isSuperAdmin ? '/app/admin/notifications' : '/app/notifications');
              }}
              className="w-full py-1.5 rounded-lg bg-slate-800 hover:bg-slate-750 text-xs font-semibold text-slate-200 transition-colors"
            >
              Central de Notificações
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
