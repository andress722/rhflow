'use client';

import React, { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import {
  Users,
  Search,
  Filter,
  Calendar,
  AlertCircle,
  Eye,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Edit3,
  CheckCircle2,
  XCircle,
  Clock,
  Briefcase,
  UserCheck,
  MessageSquare,
  Award,
  AlertTriangle,
  FileText,
  Check,
  Plus
} from 'lucide-react';

export default function AdminLeadsPage() {
  const [leads, setLeads] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [errorRequestId, setErrorRequestId] = useState<string | null>(null);

  // Operators list (SUPER_ADMINs)
  const [operators, setOperators] = useState<any[]>([]);

  // Commercial Tasks Counts & States
  const [taskCounts, setTaskCounts] = useState({
    newUnassignedLeads: 0,
    newUncontactedLeads: 0,
    overdueFollowUps: 0,
    demosToday: 0,
    staleQualifiedLeads: 0,
    wonThisMonth: 0,
    lostThisMonth: 0
  });
  const [loadingTasks, setLoadingTasks] = useState(true);
  const [tasksError, setTasksError] = useState<string | null>(null);
  const [tasksRequestId, setTasksRequestId] = useState<string | null>(null);

  // Filters & Pagination
  const [activeTaskFilter, setActiveTaskFilter] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState('');
  const [assignedToFilter, setAssignedToFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [fromFilter, setFromFilter] = useState('');
  const [toFilter, setToFilter] = useState('');
  const [sourceFilter, setSourceFilter] = useState('');
  const [utmCampaignFilter, setUtmCampaignFilter] = useState('');
  const [utmSourceFilter, setUtmSourceFilter] = useState('');
  const [page, setPage] = useState(1);
  const [limit] = useState(20);
  const [totalCount, setTotalCount] = useState(0);

  // Edit / Detail modal
  const [selectedLead, setSelectedLead] = useState<any | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  
  // Lead edit states
  const [editStatus, setEditStatus] = useState<'NEW' | 'CONTACTED' | 'QUALIFIED' | 'WON' | 'LOST'>('NEW');
  const [editNotes, setEditNotes] = useState('');
  const [editAssignedToUserId, setEditAssignedToUserId] = useState('');
  const [editNextFollowUpAt, setEditNextFollowUpAt] = useState('');
  const [editDemoScheduledAt, setEditDemoScheduledAt] = useState('');
  const [editLostReason, setEditLostReason] = useState('');
  
  const [updating, setUpdating] = useState(false);
  const [updateError, setUpdateError] = useState<string | null>(null);
  const [updateRequestId, setUpdateRequestId] = useState<string | null>(null);

  // Quick Contact Modal State
  const [quickContactLead, setQuickContactLead] = useState<any | null>(null);
  const [quickContactNote, setQuickContactNote] = useState('');
  const [submittingQuickContact, setSubmittingQuickContact] = useState(false);
  const [quickContactError, setQuickContactError] = useState<string | null>(null);
  const [quickContactRequestId, setQuickContactRequestId] = useState<string | null>(null);

  // Activities states
  const [activities, setActivities] = useState<any[]>([]);
  const [loadingActivities, setLoadingActivities] = useState(false);
  
  // Log manual activity states
  const [activityType, setActivityType] = useState<'NOTE' | 'CONTACTED' | 'DEMO_SCHEDULED' | 'FOLLOW_UP_SCHEDULED' | 'WON' | 'LOST'>('NOTE');
  const [activityNote, setActivityNote] = useState('');
  const [actNextFollowUpAt, setActNextFollowUpAt] = useState('');
  const [actDemoScheduledAt, setActDemoScheduledAt] = useState('');
  const [actLostReason, setActLostReason] = useState('');
  const [submittingActivity, setSubmittingActivity] = useState(false);
  const [activityError, setActivityError] = useState<string | null>(null);

  // Commercial notification preview states
  const [previewData, setPreviewData] = useState<any | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [previewRequestId, setPreviewRequestId] = useState<string | null>(null);
  const [isPreviewCollapsed, setIsPreviewCollapsed] = useState(true);

  // Test notification states
  const [testingNotification, setTestingNotification] = useState(false);
  const [testResult, setTestResult] = useState<any | null>(null);
  const [testError, setTestError] = useState<string | null>(null);

  const fetchPreviewData = async () => {
    setLoadingPreview(true);
    setPreviewError(null);
    setPreviewRequestId(null);
    try {
      const response = await api.get('/admin/commercial/notification-preview') as any;
      if (response && response.config && response.summary) {
        setPreviewData(response);
      } else {
        setPreviewError(response?.error?.message || 'Erro ao carregar preview de notificações.');
        setPreviewRequestId(response?.error?.requestId || null);
      }
    } catch (err: any) {
      setPreviewError('Erro de rede ao carregar preview de notificações.');
    } finally {
      setLoadingPreview(false);
    }
  };

  const handleSendTestNotification = async () => {
    if (testingNotification) return;
    setTestingNotification(true);
    setTestError(null);
    setTestResult(null);
    try {
      const response = await api.post('/admin/commercial/test-notification', {}) as any;
      if (response && response.success) {
        setTestResult({
          emailStatus: response.emailStatus,
          whatsappStatus: response.whatsappStatus
        });
        // Refresh preview data
        fetchPreviewData();
      } else {
        setTestError(response?.error?.message || 'Erro ao enviar notificação de teste.');
      }
    } catch (err: any) {
      setTestError('Erro de rede ao enviar notificação de teste.');
    } finally {
      setTestingNotification(false);
    }
  };

  const togglePreviewCollapse = () => {
    const nextValue = !isPreviewCollapsed;
    setIsPreviewCollapsed(nextValue);
    if (!nextValue) {
      fetchPreviewData();
    }
  };

  // Date formatter helpers
  const formatToLocalDatetime = (dateStr?: string | null) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '';
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  };

  const formatDisplayDate = (dateStr?: string | null) => {
    if (!dateStr) return '-';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '-';
    return d.toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Fetch commercial task counters
  const fetchTasks = async () => {
    setLoadingTasks(true);
    setTasksError(null);
    setTasksRequestId(null);
    try {
      const response = await api.get('/admin/commercial/tasks') as any;
      if (response.success && response.data) {
        setTaskCounts({
          newUnassignedLeads: response.data.newUnassignedLeads?.count || 0,
          newUncontactedLeads: response.data.newUncontactedLeads?.count || 0,
          overdueFollowUps: response.data.overdueFollowUps?.count || 0,
          demosToday: response.data.demosToday?.count || 0,
          staleQualifiedLeads: response.data.staleQualifiedLeads?.count || 0,
          wonThisMonth: response.data.wonThisMonth?.count || 0,
          lostThisMonth: response.data.lostThisMonth?.count || 0
        });
      } else {
        setTasksError(response.error?.message || 'Erro ao carregar tarefas comerciais.');
        setTasksRequestId(response.error?.requestId || null);
      }
    } catch (err) {
      setTasksError('Erro de rede ao carregar tarefas comerciais.');
    } finally {
      setLoadingTasks(false);
    }
  };

  // Fetch operators list (SUPER_ADMINs)
  const fetchOperators = async () => {
    try {
      const response = await api.get('/users') as any;
      if (response.success && response.data) {
        const ops = response.data.filter((u: any) => u.role === 'SUPER_ADMIN' && u.isActive);
        setOperators(ops);
      }
    } catch (err) {
      console.error('Erro ao carregar operadores:', err);
    }
  };

  // Fetch leads based on current filter states
  const fetchLeads = async () => {
    setLoading(true);
    setError(null);
    setErrorRequestId(null);
    try {
      const params = new URLSearchParams();
      if (statusFilter) params.append('status', statusFilter);
      if (searchQuery) params.append('search', searchQuery);
      if (fromFilter) params.append('from', fromFilter);
      if (toFilter) params.append('to', toFilter);
      if (sourceFilter) params.append('source', sourceFilter);
      if (utmCampaignFilter) params.append('utmCampaign', utmCampaignFilter);
      if (utmSourceFilter) params.append('utmSource', utmSourceFilter);
      if (assignedToFilter) params.append('assignedToUserId', assignedToFilter);
      
      // Apply the active tasks filter if set
      if (activeTaskFilter) {
        params.append(activeTaskFilter, 'true');
      }
      
      params.append('limit', limit.toString());
      params.append('page', page.toString());

      const response = await api.get(`/admin/leads?${params.toString()}`) as any;
      if (response.success) {
        setLeads(response.data || []);
        setTotalCount(response.pagination?.total || 0);
      } else {
        setError(response.error?.message || 'Erro ao carregar leads comerciais.');
        setErrorRequestId(response.error?.requestId || null);
      }
    } catch (err) {
      setError('Erro de rede ao carregar leads comerciais.');
    } finally {
      setLoading(false);
    }
  };

  // Fetch activities timeline for a specific lead
  const fetchActivities = async (leadId: string) => {
    setLoadingActivities(true);
    try {
      const response = await api.get(`/admin/leads/${leadId}/activities`) as any;
      if (response.success) {
        setActivities(response.data || []);
      }
    } catch (err) {
      console.error('Erro ao carregar histórico de atividades:', err);
    } finally {
      setLoadingActivities(false);
    }
  };

  useEffect(() => {
    fetchLeads();
    fetchTasks();
    fetchOperators();
  }, [page, statusFilter, assignedToFilter, activeTaskFilter]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchLeads();
  };

  const handleOpenEdit = (lead: any) => {
    setSelectedLead(lead);
    setEditStatus(lead.status);
    setEditNotes(lead.notes || '');
    setEditAssignedToUserId(lead.assignedToUserId || '');
    setEditNextFollowUpAt(formatToLocalDatetime(lead.nextFollowUpAt));
    setEditDemoScheduledAt(formatToLocalDatetime(lead.demoScheduledAt));
    setEditLostReason(lead.lostReason || '');
    
    // Clear sub-panel states
    setUpdateError(null);
    setUpdateRequestId(null);
    setActivityError(null);
    setActivityNote('');
    setActNextFollowUpAt('');
    setActDemoScheduledAt('');
    setActLostReason('');
    setActivityType('NOTE');

    setIsEditModalOpen(true);
    fetchActivities(lead.id);
  };

  const handleUpdateLead = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLead || updating) return;

    // Validate lostReason client-side
    if (editStatus === 'LOST' && (!editLostReason || !editLostReason.trim())) {
      setUpdateError('O motivo de perda (lostReason) é obrigatório ao marcar o lead como PERDIDO.');
      return;
    }

    setUpdating(true);
    setUpdateError(null);
    setUpdateRequestId(null);

    try {
      const payload = {
        status: editStatus,
        notes: editNotes || null,
        assignedToUserId: editAssignedToUserId || null,
        nextFollowUpAt: editNextFollowUpAt ? new Date(editNextFollowUpAt).toISOString() : null,
        demoScheduledAt: editDemoScheduledAt ? new Date(editDemoScheduledAt).toISOString() : null,
        lostReason: editStatus === 'LOST' ? editLostReason : null,
      };

      const response = await api.patch(`/admin/leads/${selectedLead.id}`, payload);

      if (response.success) {
        setIsEditModalOpen(false);
        setSelectedLead(null);
        fetchLeads();
        fetchTasks();
      } else {
        setUpdateError(response.error?.message || 'Erro ao salvar alterações do lead.');
        setUpdateRequestId(response.error?.requestId || null);
      }
    } catch (err) {
      setUpdateError('Erro de rede ao atualizar lead.');
    } finally {
      setUpdating(false);
    }
  };

  const handleLogActivity = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLead || submittingActivity) return;

    // Validate specific activity rules
    if (activityType === 'NOTE' && (!activityNote || !activityNote.trim())) {
      setActivityError('Texto da nota é obrigatório para registrar uma nota.');
      return;
    }
    if (activityType === 'FOLLOW_UP_SCHEDULED' && (!actNextFollowUpAt || new Date(actNextFollowUpAt) <= new Date())) {
      setActivityError('Uma data futura é obrigatória para agendar o follow-up.');
      return;
    }
    if (activityType === 'DEMO_SCHEDULED' && (!actDemoScheduledAt || new Date(actDemoScheduledAt) <= new Date())) {
      setActivityError('Uma data futura é obrigatória para agendar a demonstração.');
      return;
    }
    if (activityType === 'LOST') {
      const reason = actLostReason || activityNote;
      if (!reason || !reason.trim()) {
        setActivityError('O motivo de perda é obrigatório para marcar o lead como perdido.');
        return;
      }
    }

    setSubmittingActivity(true);
    setActivityError(null);

    try {
      const payload = {
        type: activityType,
        note: activityNote || null,
        nextFollowUpAt: activityType === 'FOLLOW_UP_SCHEDULED' ? new Date(actNextFollowUpAt).toISOString() : null,
        demoScheduledAt: activityType === 'DEMO_SCHEDULED' ? new Date(actDemoScheduledAt).toISOString() : null,
        lostReason: activityType === 'LOST' ? (actLostReason || activityNote) : null,
      };

      const response = await api.post(`/admin/leads/${selectedLead.id}/activities`, payload);

      if (response.success) {
        setActivityNote('');
        setActNextFollowUpAt('');
        setActDemoScheduledAt('');
        setActLostReason('');
        setActivityType('NOTE');
        
        // Reload details and activities
        fetchActivities(selectedLead.id);
        
        // Reload active lead details in state to show updated timestamps
        const leadDetails = await api.get(`/admin/leads/${selectedLead.id}`) as any;
        if (leadDetails.success && leadDetails.data) {
          setSelectedLead(leadDetails.data);
          setEditStatus(leadDetails.data.status);
          setEditNotes(leadDetails.data.notes || '');
          setEditAssignedToUserId(leadDetails.data.assignedToUserId || '');
          setEditNextFollowUpAt(formatToLocalDatetime(leadDetails.data.nextFollowUpAt));
          setEditDemoScheduledAt(formatToLocalDatetime(leadDetails.data.demoScheduledAt));
          setEditLostReason(leadDetails.data.lostReason || '');
        }

        fetchLeads();
        fetchTasks();
      } else {
        setActivityError(response.error?.message || 'Erro ao registrar atividade.');
      }
    } catch (err) {
      setActivityError('Erro de rede ao registrar atividade.');
    } finally {
      setSubmittingActivity(false);
    }
  };

  // Submit quick contact contact type activity
  const handleQuickContactSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickContactLead || submittingQuickContact) return;

    setSubmittingQuickContact(true);
    setQuickContactError(null);
    setQuickContactRequestId(null);

    try {
      const response = await api.post(`/admin/leads/${quickContactLead.id}/quick-contact`, {
        note: quickContactNote || null,
      });

      if (response.success) {
        setQuickContactLead(null);
        setQuickContactNote('');
        fetchLeads();
        fetchTasks();
      } else {
        setQuickContactError(response.error?.message || 'Erro ao registrar contato rápido.');
        setQuickContactRequestId(response.error?.requestId || null);
      }
    } catch (err) {
      setQuickContactError('Erro de rede ao registrar contato rápido.');
    } finally {
      setSubmittingQuickContact(false);
    }
  };

  // Toggle active card task filter focus
  const toggleTaskFilter = (filterName: string) => {
    if (activeTaskFilter === filterName) {
      setActiveTaskFilter(null);
    } else {
      setActiveTaskFilter(filterName);
      setPage(1);
    }
  };

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case 'NEW':
        return 'bg-blue-500/10 text-blue-400 border border-blue-500/20';
      case 'CONTACTED':
        return 'bg-amber-500/10 text-amber-400 border border-amber-500/20';
      case 'QUALIFIED':
        return 'bg-purple-500/10 text-purple-400 border border-purple-500/20';
      case 'WON':
        return 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20';
      case 'LOST':
        return 'bg-red-500/10 text-red-400 border border-red-500/20';
      default:
        return 'bg-slate-800 text-slate-400 border border-slate-700';
    }
  };

  const getActivityTypeBadgeClass = (type: string) => {
    switch (type) {
      case 'NOTE':
        return 'bg-slate-800 text-slate-400 border border-slate-750';
      case 'STATUS_CHANGED':
        return 'bg-blue-900/40 text-blue-300 border border-blue-800/40';
      case 'CONTACTED':
        return 'bg-amber-900/40 text-amber-300 border border-amber-800/40';
      case 'DEMO_SCHEDULED':
        return 'bg-purple-900/40 text-purple-300 border border-purple-800/40';
      case 'FOLLOW_UP_SCHEDULED':
        return 'bg-pink-900/40 text-pink-300 border border-pink-800/40';
      case 'WON':
        return 'bg-emerald-950/60 text-emerald-400 border border-emerald-800/40';
      case 'LOST':
        return 'bg-red-950/60 text-red-400 border border-red-800/40';
      default:
        return 'bg-slate-800 text-slate-400';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-white">CRM Comercial de Leads</h1>
          <p className="text-xs text-slate-400">
            Acompanhe responsáveis, histórico de contato, demonstrações e resultado comercial dos leads do programa piloto.
          </p>
        </div>
        <button
          onClick={() => { fetchLeads(); fetchTasks(); }}
          className="flex items-center gap-2 px-3 py-1.5 text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg transition-colors self-start sm:self-auto"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Atualizar</span>
        </button>
      </div>

      {/* Commercial Tasks Panel */}
      <div className="space-y-3">
        <h3 className="text-xs font-bold text-slate-450 uppercase tracking-wider">Tarefas Comerciais</h3>
        
        {tasksError ? (
          <div className="p-3 bg-red-950/20 border border-red-800/40 rounded-xl text-red-450 text-xs space-y-1">
            <p>{tasksError}</p>
            {tasksRequestId && <p className="text-[10px] text-slate-650 font-mono">ID do erro: {tasksRequestId}</p>}
          </div>
        ) : loadingTasks ? (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
            {[...Array(7)].map((_, i) => (
              <div key={i} className="bg-slate-900/40 border border-slate-850 p-3.5 rounded-xl animate-pulse space-y-2 h-[76px]">
                <div className="h-2 w-12 bg-slate-850 rounded"></div>
                <div className="h-6 w-8 bg-slate-800 rounded"></div>
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
            {/* Leads sem responsável */}
            <button
              onClick={() => toggleTaskFilter('unassigned')}
              className={`p-3.5 border rounded-xl text-left transition-all duration-200 flex flex-col justify-between ${
                activeTaskFilter === 'unassigned'
                  ? 'bg-indigo-650/15 border-indigo-500/50 shadow-lg shadow-indigo-500/5'
                  : 'bg-slate-900/50 hover:bg-slate-900/80 border-slate-800/80'
              }`}
            >
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Sem Responsável</span>
              <span className={`text-xl font-extrabold block mt-2 ${taskCounts.newUnassignedLeads > 0 ? 'text-indigo-400' : 'text-slate-400'}`}>
                {taskCounts.newUnassignedLeads}
              </span>
            </button>

            {/* Leads sem contato */}
            <button
              onClick={() => toggleTaskFilter('uncontacted')}
              className={`p-3.5 border rounded-xl text-left transition-all duration-200 flex flex-col justify-between ${
                activeTaskFilter === 'uncontacted'
                  ? 'bg-indigo-650/15 border-indigo-500/50 shadow-lg shadow-indigo-500/5'
                  : 'bg-slate-900/50 hover:bg-slate-900/80 border-slate-800/80'
              }`}
            >
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Sem Contato</span>
              <span className={`text-xl font-extrabold block mt-2 ${taskCounts.newUncontactedLeads > 0 ? 'text-amber-400' : 'text-slate-400'}`}>
                {taskCounts.newUncontactedLeads}
              </span>
            </button>

            {/* Follow-ups vencidos */}
            <button
              onClick={() => toggleTaskFilter('overdue')}
              className={`p-3.5 border rounded-xl text-left transition-all duration-200 flex flex-col justify-between ${
                activeTaskFilter === 'overdue'
                  ? 'bg-indigo-650/15 border-indigo-500/50 shadow-lg shadow-indigo-500/5'
                  : 'bg-slate-900/50 hover:bg-slate-900/80 border-slate-800/80'
              }`}
            >
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Follow-up Vencido</span>
              <span className={`text-xl font-extrabold block mt-2 ${taskCounts.overdueFollowUps > 0 ? 'text-rose-400' : 'text-slate-400'}`}>
                {taskCounts.overdueFollowUps}
              </span>
            </button>

            {/* Demos de hoje */}
            <button
              onClick={() => toggleTaskFilter('demosToday')}
              className={`p-3.5 border rounded-xl text-left transition-all duration-200 flex flex-col justify-between ${
                activeTaskFilter === 'demosToday'
                  ? 'bg-indigo-650/15 border-indigo-500/50 shadow-lg shadow-indigo-500/5'
                  : 'bg-slate-900/50 hover:bg-slate-900/80 border-slate-800/80'
              }`}
            >
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Demos Hoje</span>
              <span className={`text-xl font-extrabold block mt-2 ${taskCounts.demosToday > 0 ? 'text-purple-400' : 'text-slate-400'}`}>
                {taskCounts.demosToday}
              </span>
            </button>

            {/* Leads qualificados parados */}
            <button
              onClick={() => toggleTaskFilter('stale')}
              className={`p-3.5 border rounded-xl text-left transition-all duration-200 flex flex-col justify-between ${
                activeTaskFilter === 'stale'
                  ? 'bg-indigo-650/15 border-indigo-500/50 shadow-lg shadow-indigo-500/5'
                  : 'bg-slate-900/50 hover:bg-slate-900/80 border-slate-800/80'
              }`}
            >
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Qualif. Parado</span>
              <span className={`text-xl font-extrabold block mt-2 ${taskCounts.staleQualifiedLeads > 0 ? 'text-pink-400' : 'text-slate-400'}`}>
                {taskCounts.staleQualifiedLeads}
              </span>
            </button>

            {/* Ganhos no mês */}
            <button
              onClick={() => toggleTaskFilter('wonThisMonth')}
              className={`p-3.5 border rounded-xl text-left transition-all duration-200 flex flex-col justify-between ${
                activeTaskFilter === 'wonThisMonth'
                  ? 'bg-indigo-650/15 border-indigo-500/50 shadow-lg shadow-indigo-500/5'
                  : 'bg-slate-900/50 hover:bg-slate-900/80 border-slate-800/80'
              }`}
            >
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Ganhos no Mês</span>
              <span className="text-xl font-extrabold block text-emerald-400 mt-2">
                {taskCounts.wonThisMonth}
              </span>
            </button>

            {/* Perdidos no mês */}
            <button
              onClick={() => toggleTaskFilter('lostThisMonth')}
              className={`p-3.5 border rounded-xl text-left transition-all duration-200 flex flex-col justify-between ${
                activeTaskFilter === 'lostThisMonth'
                  ? 'bg-indigo-650/15 border-indigo-500/50 shadow-lg shadow-indigo-500/5'
                  : 'bg-slate-900/50 hover:bg-slate-900/80 border-slate-800/80'
              }`}
            >
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Perdidos no Mês</span>
              <span className="text-xl font-extrabold block text-slate-400 mt-2">
                {taskCounts.lostThisMonth}
              </span>
            </button>
          </div>
        )}
      </div>

      {/* Collapsible Panel: Notificações Comerciais Externas */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden transition-all duration-200">
        <button
          type="button"
          onClick={togglePreviewCollapse}
          className="w-full flex items-center justify-between p-4 hover:bg-slate-850/50 transition-colors text-left"
        >
          <div className="flex items-center gap-3">
            <MessageSquare className="w-5 h-5 text-indigo-400" />
            <div>
              <h3 className="text-sm font-bold text-white">Notificações Comerciais Externas</h3>
              <p className="text-xs text-slate-400">
                Acompanhe o status e envie alertas de teste por e-mail e WhatsApp.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-slate-400 bg-slate-800 hover:bg-slate-750 px-2.5 py-1 rounded-md border border-slate-700 font-semibold cursor-pointer">
              {isPreviewCollapsed ? 'Expandir' : 'Recolher'}
            </span>
          </div>
        </button>

        {!isPreviewCollapsed && (
          <div className="p-4 border-t border-slate-800 space-y-4 bg-slate-950/20">
            {loadingPreview ? (
              <div className="py-6 flex flex-col items-center justify-center gap-2">
                <RefreshCw className="w-5 h-5 text-indigo-400 animate-spin" />
                <span className="text-xs text-slate-400">Carregando preview e configurações...</span>
              </div>
            ) : previewError ? (
              <div className="p-3 bg-red-950/20 border border-red-800/40 rounded-xl text-red-400 text-xs space-y-1">
                <p>{previewError}</p>
                {previewRequestId && <p className="text-[10px] text-slate-500 font-mono">ID do erro: {previewRequestId}</p>}
              </div>
            ) : previewData ? (
              <div className="space-y-4">
                {/* Config and Summary Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Configuration column */}
                  <div className="bg-slate-900/50 border border-slate-800/50 p-4 rounded-xl space-y-3">
                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Status das Conexões</h4>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-400">Notificações por E-mail:</span>
                        {previewData.config.emailEnabled ? (
                          <span className="text-emerald-450 font-semibold flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                            Ativo ({previewData.config.emailRecipientsCount} dest.)
                          </span>
                        ) : (
                          <span className="text-slate-500 font-semibold">Inativo</span>
                        )}
                      </div>
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-400">Notificações por WhatsApp:</span>
                        {previewData.config.whatsappEnabled ? (
                          <span className="text-emerald-450 font-semibold flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                            Ativo ({previewData.config.whatsappRecipientsCount} dest.)
                          </span>
                        ) : (
                          <span className="text-slate-500 font-semibold">Inativo</span>
                        )}
                      </div>
                      <div className="flex items-center justify-between text-xs pt-1.5 border-t border-slate-850">
                        <span className="text-slate-400">Horário do Resumo Diário:</span>
                        <span className="text-white font-mono bg-slate-800 px-1.5 py-0.5 rounded border border-slate-700 text-[11px]">
                          {previewData.config.dailySummaryTime}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Summary preview column */}
                  <div className="bg-slate-900/50 border border-slate-800/50 p-4 rounded-xl space-y-3">
                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Preview do Resumo de Hoje</h4>
                    <div className="grid grid-cols-2 gap-2 text-center">
                      <div className="p-2 bg-slate-850/50 border border-slate-850 rounded-lg">
                        <span className="text-[10px] text-slate-400 uppercase block">Novos Leads</span>
                        <span className="text-base font-bold text-indigo-400">{previewData.summary.newLeadsToday}</span>
                      </div>
                      <div className="p-2 bg-slate-850/50 border border-slate-850 rounded-lg">
                        <span className="text-[10px] text-slate-400 uppercase block">F.ups Vencidos</span>
                        <span className="text-base font-bold text-rose-450">{previewData.summary.overdueFollowUps}</span>
                      </div>
                      <div className="p-2 bg-slate-850/50 border border-slate-850 rounded-lg">
                        <span className="text-[10px] text-slate-400 uppercase block">Demos Hoje</span>
                        <span className="text-base font-bold text-purple-400">{previewData.summary.demosToday}</span>
                      </div>
                      <div className="p-2 bg-slate-850/50 border border-slate-850 rounded-lg">
                        <span className="text-[10px] text-slate-400 uppercase block">Qualif. Parados</span>
                        <span className="text-base font-bold text-pink-400">{previewData.summary.staleQualifiedLeads}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Actions area */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-slate-800">
                  <div className="text-[11px] text-slate-400">
                    * Você pode testar se a infraestrutura está funcionando enviando um alerta comercial simulado imediato.
                  </div>
                  <button
                    type="button"
                    onClick={handleSendTestNotification}
                    disabled={testingNotification}
                    className="flex items-center justify-center gap-2 px-3.5 py-2 text-xs font-semibold bg-indigo-650 hover:bg-indigo-600 disabled:bg-indigo-850 text-white rounded-lg transition-colors shadow-sm disabled:cursor-not-allowed min-w-[170px]"
                  >
                    {testingNotification ? (
                      <>
                        <RefreshCw className="w-3 h-3 animate-spin" />
                        <span>Enviando...</span>
                      </>
                    ) : (
                      <span>Enviar Notificação de Teste</span>
                    )}
                  </button>
                </div>

                {/* Test Feedback */}
                {testError && (
                  <div className="p-3 bg-red-950/20 border border-red-800/40 rounded-xl text-red-400 text-xs">
                    {testError}
                  </div>
                )}
                {testResult && (
                  <div className="p-3 bg-emerald-950/20 border border-emerald-800/40 rounded-xl text-emerald-450 text-xs space-y-1">
                    <p className="font-bold">Notificação de teste enviada!</p>
                    <p className="text-[11px] text-slate-350">
                      Canais: E-mail (<strong>{testResult.emailStatus}</strong>) | WhatsApp (<strong>{testResult.whatsappStatus}</strong>)
                    </p>
                  </div>
                )}
              </div>
            ) : null}
          </div>
        )}
      </div>

      {/* CRM Advanced Filters */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
        <form onSubmit={handleSearchSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {/* Search text */}
            <div className="space-y-1">
              <label className="block text-[10px] font-semibold text-slate-400 uppercase">Busca Livre</label>
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-slate-600" />
                <input
                  type="text"
                  placeholder="Nome, empresa, email..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-950 border border-slate-800 rounded-lg text-slate-200 focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>

            {/* Status Selection */}
            <div className="space-y-1">
              <label className="block text-[10px] font-semibold text-slate-400 uppercase">Status</label>
              <select
                value={statusFilter}
                onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
                className="w-full px-3 py-1.5 text-xs bg-slate-950 border border-slate-800 rounded-lg text-slate-200 focus:outline-none focus:border-indigo-500"
              >
                <option value="">Todos os status</option>
                <option value="NEW">Novo (NEW)</option>
                <option value="CONTACTED">Contatado (CONTACTED)</option>
                <option value="QUALIFIED">Qualificado (QUALIFIED)</option>
                <option value="WON">Ganho (WON)</option>
                <option value="LOST">Perdido (LOST)</option>
              </select>
            </div>

            {/* Operator Selection */}
            <div className="space-y-1">
              <label className="block text-[10px] font-semibold text-slate-400 uppercase">Responsável</label>
              <select
                value={assignedToFilter}
                onChange={(e) => { setAssignedToFilter(e.target.value); setPage(1); }}
                className="w-full px-3 py-1.5 text-xs bg-slate-950 border border-slate-800 rounded-lg text-slate-200 focus:outline-none focus:border-indigo-500"
              >
                <option value="">Todos os responsáveis</option>
                {operators.map((op) => (
                  <option key={op.id} value={op.id}>{op.name}</option>
                ))}
              </select>
            </div>

            {/* Canal (Source) */}
            <div className="space-y-1">
              <label className="block text-[10px] font-semibold text-slate-400 uppercase">Canal (Source)</label>
              <input
                type="text"
                placeholder="Ex: whatsapp, email..."
                value={sourceFilter}
                onChange={(e) => setSourceFilter(e.target.value)}
                className="w-full px-3 py-1.5 text-xs bg-slate-955 border border-slate-800 rounded-lg text-slate-200 focus:outline-none focus:border-indigo-500"
              />
            </div>

            {/* Submit button */}
            <div className="flex items-end gap-2">
              <button
                type="submit"
                disabled={loading}
                className="flex-1 py-1.5 text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition-colors flex items-center justify-center gap-1.5 h-[32px]"
              >
                <Filter className="w-3.5 h-3.5" />
                <span>Filtrar</span>
              </button>
              {activeTaskFilter && (
                <button
                  type="button"
                  onClick={() => setActiveTaskFilter(null)}
                  className="px-2.5 py-1.5 text-xs font-semibold bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 rounded-lg transition-colors h-[32px] shrink-0"
                  title="Limpar filtro de tarefa ativa"
                >
                  Limpar
                </button>
              )}
            </div>
          </div>
        </form>
      </div>

      {/* Main Table or State display */}
      {error ? (
        <div className="p-4 bg-red-950/20 border border-red-800/50 rounded-xl space-y-2 text-red-400 text-xs">
          <div className="flex items-center gap-3">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <span>{error}</span>
          </div>
          {errorRequestId && (
            <p className="text-[10px] text-slate-500 font-mono">ID de Rastreamento do Erro: {errorRequestId}</p>
          )}
        </div>
      ) : loading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3 bg-slate-900/20 border border-slate-800 rounded-xl">
          <div className="w-8 h-8 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
          <span className="text-xs text-slate-400 font-medium">Buscando leads...</span>
        </div>
      ) : leads.length === 0 ? (
        <div className="text-center py-16 bg-slate-900/20 border border-slate-800/60 rounded-xl animate-fadeIn">
          <Users className="w-8 h-8 text-slate-700 mx-auto mb-3" />
          <h4 className="text-xs font-bold text-slate-400">Nenhum lead comercial encontrado</h4>
          <p className="text-[10px] text-slate-600 mt-1">Nenhum registro corresponde aos filtros ou buscas definidos.</p>
        </div>
      ) : (
        <div className="space-y-4 animate-fadeIn">
          <div className="overflow-x-auto border border-slate-800 rounded-lg">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-950/80 text-slate-400 border-b border-slate-800 font-semibold">
                  <th className="p-3">Data</th>
                  <th className="p-3">Lead / Empresa</th>
                  <th className="p-3">Origem</th>
                  <th className="p-3">Responsável</th>
                  <th className="p-3">Último Contato</th>
                  <th className="p-3">Próximo Follow-up</th>
                  <th className="p-3">Demo Agendada</th>
                  <th className="p-3 text-center">Status</th>
                  <th className="p-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/70 text-slate-300">
                {leads.map((lead) => {
                  const isOverdue = lead.nextFollowUpAt && new Date(lead.nextFollowUpAt) <= new Date() && lead.status !== 'WON' && lead.status !== 'LOST';
                  return (
                    <tr key={lead.id} className="hover:bg-slate-900/40 transition-colors">
                      <td className="p-3 whitespace-nowrap text-slate-500">
                        {new Date(lead.createdAt).toLocaleDateString()}
                      </td>
                      <td className="p-3">
                        <p className="font-semibold text-slate-200">{lead.name}</p>
                        <p className="text-[10px] text-slate-400">{lead.companyName}</p>
                      </td>
                      <td className="p-3 text-slate-450">
                        <p>{lead.source || 'N/A'}</p>
                        {lead.utmCampaign && <p className="text-[9px] text-indigo-400/80">Campanha: {lead.utmCampaign}</p>}
                      </td>
                      <td className="p-3 font-semibold text-slate-300">
                        {lead.assignedTo?.name ? (
                          <div className="flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-indigo-500"></span>
                            <span>{lead.assignedTo.name}</span>
                          </div>
                        ) : (
                          <span className="text-slate-500 italic text-[10px]">Não atribuído</span>
                        )}
                      </td>
                      <td className="p-3 text-slate-400">
                        {formatDisplayDate(lead.lastContactedAt)}
                      </td>
                      <td className="p-3">
                        {lead.nextFollowUpAt ? (
                          <span className={`px-1.5 py-0.5 rounded font-mono text-[10px] ${isOverdue ? 'bg-amber-950/50 text-amber-400 border border-amber-800/45 font-bold' : 'text-slate-350'}`}>
                            {formatDisplayDate(lead.nextFollowUpAt)}
                          </span>
                        ) : (
                          <span className="text-slate-600">-</span>
                        )}
                      </td>
                      <td className="p-3 text-slate-350 font-mono">
                        {formatDisplayDate(lead.demoScheduledAt)}
                      </td>
                      <td className="p-3 text-center">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${getStatusBadgeClass(lead.status)}`}>
                          {lead.status}
                        </span>
                      </td>
                      <td className="p-3 text-right">
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => {
                              setQuickContactLead(lead);
                              setQuickContactNote('');
                              setQuickContactError(null);
                              setQuickContactRequestId(null);
                            }}
                            className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-750 border border-slate-700 text-slate-300 hover:text-white transition-all flex items-center gap-1 text-[10px] font-medium"
                            title="Contato rápido"
                          >
                            <MessageSquare className="w-3.5 h-3.5 text-indigo-400" />
                            <span>Contato Rápido</span>
                          </button>
                          <button
                            onClick={() => handleOpenEdit(lead)}
                            className="px-2.5 py-1 rounded bg-indigo-600 hover:bg-indigo-500 border border-indigo-550 text-white transition-all flex items-center gap-1 text-[10px] font-bold"
                            title="Gerenciar CRM"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                            <span>Gerenciar</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between border-t border-slate-800 pt-4">
            <span className="text-xs text-slate-500">
              Total: {totalCount} leads • Página {page}
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => setPage(prev => Math.max(1, prev - 1))}
                disabled={page === 1 || loading}
                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 disabled:opacity-40 transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={() => setPage(prev => prev + 1)}
                disabled={leads.length < limit || loading}
                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 disabled:opacity-40 transition-colors"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Quick Contact Modal (Popup) */}
      {quickContactLead && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50 animate-fadeIn">
          <div className="bg-slate-900 border border-slate-800 rounded-xl w-full max-w-md shadow-2xl overflow-hidden animate-slideUp">
            <div className="px-5 py-3.5 border-b border-slate-800 bg-slate-950/40 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-indigo-400" />
                <div>
                  <h3 className="text-xs font-bold text-white uppercase tracking-wider">Contato Rápido</h3>
                  <p className="text-[10px] text-slate-500">Registrar interação CONTACTED</p>
                </div>
              </div>
              <button
                onClick={() => setQuickContactLead(null)}
                className="text-slate-400 hover:text-slate-200 text-xs font-bold bg-slate-800/40 hover:bg-slate-800 px-2 py-0.5 rounded border border-slate-700"
              >
                X
              </button>
            </div>

            <form onSubmit={handleQuickContactSubmit} className="p-5 space-y-4">
              {quickContactError && (
                <div className="p-2.5 bg-red-955/20 border border-red-900/30 rounded-lg text-red-405 text-xs space-y-1">
                  <p>{quickContactError}</p>
                  {quickContactRequestId && <p className="text-[9px] text-slate-500 font-mono">ID do erro: {quickContactRequestId}</p>}
                </div>
              )}

              <div className="bg-slate-950 p-3 border border-slate-850 rounded-lg text-xs space-y-1">
                <p className="text-slate-400">Registrando contato para:</p>
                <p className="font-bold text-slate-200 text-sm">{quickContactLead.name}</p>
                <p className="text-slate-500 text-[10px]">{quickContactLead.companyName}</p>
              </div>

              <div className="space-y-1">
                <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider">Nota Comercial (Opcional)</label>
                <textarea
                  rows={3}
                  placeholder="Ex: Mensagem enviada por WhatsApp. Demonstração agendada..."
                  value={quickContactNote}
                  onChange={(e) => setQuickContactNote(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs bg-slate-950 border border-slate-850 rounded-lg text-slate-200 focus:outline-none focus:border-indigo-500 placeholder-slate-650"
                />
              </div>

              <div className="flex justify-end gap-2.5 pt-1">
                <button
                  type="button"
                  onClick={() => setQuickContactLead(null)}
                  className="px-3 py-1.5 text-xs bg-slate-800 hover:bg-slate-750 text-slate-350 font-semibold rounded-lg border border-slate-705 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submittingQuickContact}
                  className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-bold rounded-lg transition-colors flex items-center gap-1"
                >
                  <span>{submittingQuickContact ? 'Registrando...' : 'Registrar Contato'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CRM Detail / Edit Modal */}
      {isEditModalOpen && selectedLead && (
        <div className="fixed inset-0 bg-black/85 flex items-center justify-center p-4 z-50 animate-fadeIn">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-5xl shadow-2xl flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/40 rounded-t-2xl">
              <div className="flex items-center gap-2">
                <Briefcase className="w-5 h-5 text-indigo-400" />
                <div>
                  <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                    Ficha de Lead & Histórico de CRM
                  </h3>
                  <p className="text-[10px] text-slate-500 font-mono">ID: {selectedLead.id}</p>
                </div>
              </div>
              <button
                onClick={() => setIsEditModalOpen(false)}
                className="text-slate-400 hover:text-slate-200 text-sm font-semibold transition-colors bg-slate-800/50 hover:bg-slate-800 px-3 py-1 rounded-lg border border-slate-700"
              >
                Fechar
              </button>
            </div>

            {/* Modal Two-Column Body */}
            <div className="flex-1 overflow-y-auto grid grid-cols-1 lg:grid-cols-12 divide-y lg:divide-y-0 lg:divide-x divide-slate-800 font-sans">
              
              {/* Left Column: Lead Information & State Updates */}
              <div className="lg:col-span-6 p-6 space-y-5 overflow-y-auto">
                
                {/* Basic data details */}
                <div className="bg-slate-950 p-4 border border-slate-800/80 rounded-xl text-xs space-y-2">
                  <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2 border-b border-slate-900 pb-1">Dados Comerciais</h4>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <span className="text-slate-500 block">Solicitante</span>
                      <span className="text-slate-200 font-semibold">{selectedLead.name}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">Empresa</span>
                      <span className="text-slate-200 font-semibold">{selectedLead.companyName}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">Cargo</span>
                      <span className="text-slate-350">{selectedLead.role || 'Não informado'}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">Funcionários</span>
                      <span className="text-slate-350">{selectedLead.employeeCount ? `${selectedLead.employeeCount} pessoas` : 'N/I'}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">E-mail</span>
                      <span className="text-indigo-400 font-mono break-all">{selectedLead.email}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">WhatsApp</span>
                      <span className="text-slate-200 font-mono">{selectedLead.whatsapp || 'N/I'}</span>
                    </div>
                  </div>
                  {selectedLead.mainPain && (
                    <div className="border-t border-slate-900 pt-2 mt-2">
                      <span className="text-slate-500 block">Dor principal apontada:</span>
                      <span className="text-amber-400/90 font-medium block mt-0.5">{selectedLead.mainPain}</span>
                    </div>
                  )}
                </div>

                {/* Campaign / Marketing source */}
                <div className="bg-slate-955 p-4 border border-slate-850 rounded-xl text-xs">
                  <h4 className="text-[10px] font-bold text-slate-550 uppercase tracking-wider mb-2 border-b border-slate-900 pb-1">Marketing / Rastreamento</h4>
                  <div className="grid grid-cols-3 gap-2 text-[11px]">
                    <div>
                      <span className="text-slate-500 block">Canal</span>
                      <span className="text-slate-300 font-semibold">{selectedLead.source || 'N/A'}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">Campaign</span>
                      <span className="text-slate-300 truncate block" title={selectedLead.utmCampaign}>{selectedLead.utmCampaign || 'N/A'}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">Source</span>
                      <span className="text-slate-300 truncate block" title={selectedLead.utmSource}>{selectedLead.utmSource || 'N/A'}</span>
                    </div>
                  </div>
                </div>

                {/* Update Lead State Form */}
                <form onSubmit={handleUpdateLead} className="space-y-4 pt-2 border-t border-slate-800">
                  <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Configuração e Funil</h4>
                  
                  {updateError && (
                    <div className="p-3 bg-red-950/20 border border-red-800/40 rounded-lg text-red-400 text-xs space-y-1">
                      <p className="font-semibold">{updateError}</p>
                      {updateRequestId && <p className="text-[10px] text-slate-500 font-mono">ID do erro: {updateRequestId}</p>}
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-4">
                    {/* Status input */}
                    <div className="space-y-1">
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Status Comercial</label>
                      <select
                        value={editStatus}
                        onChange={(e) => setEditStatus(e.target.value as any)}
                        className="w-full px-3 py-1.5 text-xs bg-slate-950 border border-slate-800 rounded-lg text-slate-100 focus:outline-none focus:border-indigo-500"
                      >
                        <option value="NEW">Novo Lead (NEW)</option>
                        <option value="CONTACTED">Contatado (CONTACTED)</option>
                        <option value="QUALIFIED">Qualificado (QUALIFIED)</option>
                        <option value="WON">Piloto Fechado (WON)</option>
                        <option value="LOST">Lead Perdido (LOST)</option>
                      </select>
                    </div>

                    {/* Operator (SRE) input */}
                    <div className="space-y-1">
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Responsável Comercial</label>
                      <select
                        value={editAssignedToUserId}
                        onChange={(e) => setEditAssignedToUserId(e.target.value)}
                        className="w-full px-3 py-1.5 text-xs bg-slate-955 border border-slate-800 rounded-lg text-slate-100 focus:outline-none focus:border-indigo-500"
                      >
                        <option value="">Não atribuído</option>
                        {operators.map((op) => (
                          <option key={op.id} value={op.id}>{op.name}</option>
                        ))}
                      </select>
                    </div>

                    {/* Next follow up datetime */}
                    <div className="space-y-1">
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Próximo Follow-up</label>
                      <input
                        type="datetime-local"
                        value={editNextFollowUpAt}
                        onChange={(e) => setEditNextFollowUpAt(e.target.value)}
                        className="w-full px-3 py-1.5 text-xs bg-slate-955 border border-slate-800 rounded-lg text-slate-150 focus:outline-none focus:border-indigo-500"
                      />
                    </div>

                    {/* Demo scheduled datetime */}
                    <div className="space-y-1">
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Demonstração Agendada</label>
                      <input
                        type="datetime-local"
                        value={editDemoScheduledAt}
                        onChange={(e) => setEditDemoScheduledAt(e.target.value)}
                        className="w-full px-3 py-1.5 text-xs bg-slate-955 border border-slate-800 rounded-lg text-slate-150 focus:outline-none focus:border-indigo-500"
                      />
                    </div>
                  </div>

                  {/* Lost Reason input - Visible only when status is LOST */}
                  {editStatus === 'LOST' && (
                    <div className="space-y-1 animate-slideDown">
                      <label className="block text-[10px] font-bold text-red-400 uppercase tracking-wider flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3" />
                        <span>Motivo da Perda (Obrigatório)</span>
                      </label>
                      <textarea
                        rows={2}
                        required
                        placeholder="Descreva o motivo de perda deste lead comercial..."
                        value={editLostReason}
                        onChange={(e) => setEditLostReason(e.target.value)}
                        className="w-full px-3 py-2 text-xs bg-slate-955 border border-red-900/40 rounded-lg text-slate-100 focus:outline-none focus:border-red-500 placeholder-slate-650"
                      />
                    </div>
                  )}

                  {/* General notes */}
                  <div className="space-y-1">
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Observações Gerais</label>
                    <textarea
                      rows={3}
                      placeholder="Histórico ou observações cruciais sobre a empresa..."
                      value={editNotes}
                      onChange={(e) => setEditNotes(e.target.value)}
                      className="w-full px-3 py-2 text-xs bg-slate-950 border border-slate-800 rounded-lg text-slate-100 focus:outline-none focus:border-indigo-500 placeholder-slate-650"
                    />
                  </div>

                  {/* Submit updates button */}
                  <button
                    type="submit"
                    disabled={updating}
                    className="w-full py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-lg transition-colors flex items-center justify-center gap-1.5"
                  >
                    {updating ? 'Salvando dados...' : 'Atualizar Dados do Lead'}
                  </button>
                </form>

              </div>

              {/* Right Column: Timeline activities & New manual activity log */}
              <div className="lg:col-span-6 p-6 space-y-6 flex flex-col max-h-[80vh] overflow-y-auto">
                
                {/* Manual activity logger */}
                <div className="bg-slate-955 p-4 border border-slate-800/80 rounded-xl space-y-3 shrink-0">
                  <h4 className="text-[10px] font-bold text-slate-350 uppercase tracking-wider flex items-center gap-1.5 border-b border-slate-850 pb-2">
                    <Plus className="w-3.5 h-3.5 text-indigo-400" />
                    <span>Registrar Nova Atividade</span>
                  </h4>

                  {activityError && (
                    <div className="p-2.5 bg-red-955/25 border border-red-900/30 rounded-lg text-red-405 text-xs">
                      {activityError}
                    </div>
                  )}

                  <form onSubmit={handleLogActivity} className="space-y-3">
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1 col-span-2">
                        <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider">Tipo da Atividade</label>
                        <select
                          value={activityType}
                          onChange={(e) => setActivityType(e.target.value as any)}
                          className="w-full px-2.5 py-1 text-xs bg-slate-950 border border-slate-800 rounded-lg text-slate-200 focus:outline-none focus:border-indigo-500"
                        >
                          <option value="NOTE">Nota Geral (NOTE)</option>
                          <option value="CONTACTED">Contato Efetuado (CONTACTED)</option>
                          <option value="FOLLOW_UP_SCHEDULED">Agendar Follow-up (FOLLOW_UP_SCHEDULED)</option>
                          <option value="DEMO_SCHEDULED">Agendar Demonstração (DEMO_SCHEDULED)</option>
                          <option value="WON">Marcar como GANHO (WON)</option>
                          <option value="LOST">Marcar como PERDIDO (LOST)</option>
                        </select>
                      </div>

                      {activityType === 'FOLLOW_UP_SCHEDULED' && (
                        <div className="space-y-1 col-span-2">
                          <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider">Nova Data de Follow-up (Futuro)</label>
                          <input
                            type="datetime-local"
                            required
                            value={actNextFollowUpAt}
                            onChange={(e) => setActNextFollowUpAt(e.target.value)}
                            className="w-full px-2.5 py-1 text-xs bg-slate-955 border border-slate-800 rounded-lg text-slate-200 focus:outline-none focus:border-indigo-500"
                          />
                        </div>
                      )}

                      {activityType === 'DEMO_SCHEDULED' && (
                        <div className="space-y-1 col-span-2">
                          <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider">Nova Data da Demo (Futuro)</label>
                          <input
                            type="datetime-local"
                            required
                            value={actDemoScheduledAt}
                            onChange={(e) => setActDemoScheduledAt(e.target.value)}
                            className="w-full px-2.5 py-1 text-xs bg-slate-955 border border-slate-800 rounded-lg text-slate-200 focus:outline-none focus:border-indigo-500"
                          />
                        </div>
                      )}

                      {activityType === 'LOST' && (
                        <div className="space-y-1 col-span-2">
                          <label className="block text-[9px] font-bold text-red-405 uppercase tracking-wider">Motivo de Perda</label>
                          <input
                            type="text"
                            required
                            placeholder="Descreva brevemente o motivo de perda..."
                            value={actLostReason}
                            onChange={(e) => setActLostReason(e.target.value)}
                            className="w-full px-2.5 py-1 text-xs bg-slate-955 border border-slate-800 rounded-lg text-slate-200 focus:outline-none focus:border-indigo-500 placeholder-slate-650"
                          />
                        </div>
                      )}
                    </div>

                    <div className="space-y-1">
                      <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider">Descrição / Nota da Atividade</label>
                      <textarea
                        rows={2}
                        placeholder={activityType === 'NOTE' ? 'Insira o texto da nota...' : 'Notas detalhadas sobre a atividade...'}
                        value={activityNote}
                        onChange={(e) => setActivityNote(e.target.value)}
                        className="w-full px-2.5 py-1.5 text-xs bg-slate-950 border border-slate-800 rounded-lg text-slate-200 focus:outline-none focus:border-indigo-500 placeholder-slate-655"
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={submittingActivity}
                      className="w-full py-1.5 bg-slate-850 hover:bg-slate-800 border border-slate-700 text-slate-200 text-xs font-semibold rounded-lg transition-colors flex items-center justify-center gap-1.5"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>{submittingActivity ? 'Gravando atividade...' : 'Registrar Atividade'}</span>
                    </button>
                  </form>
                </div>

                {/* Timeline display */}
                <div className="flex-1 flex flex-col min-h-[300px]">
                  <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-3 border-b border-slate-800 pb-2">
                    Linha do Tempo (Timeline de Atividades)
                  </h4>

                  {loadingActivities ? (
                    <div className="flex-1 flex flex-col items-center justify-center gap-2">
                      <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
                      <span className="text-[10px] text-slate-500">Buscando atividades...</span>
                    </div>
                  ) : activities.length === 0 ? (
                    <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-slate-955/20 border border-dashed border-slate-800 rounded-xl">
                      <Clock className="w-6 h-6 text-slate-700 mb-2" />
                      <span className="text-[10px] text-slate-500 font-medium">Nenhuma atividade registrada</span>
                    </div>
                  ) : (
                    <div className="flex-1 overflow-y-auto pr-1 space-y-3 max-h-[350px] relative">
                      {/* Timeline bar line */}
                      <div className="absolute left-3.5 top-2 bottom-2 w-0.5 bg-slate-850"></div>
                      
                      {activities.map((act) => {
                        return (
                          <div key={act.id} className="relative pl-7 text-xs flex flex-col space-y-0.5 animate-fadeIn">
                            {/* Dot icon indicator */}
                            <span className="absolute left-1.5 top-1.5 w-4 h-4 rounded-full border border-slate-900 bg-slate-800 flex items-center justify-center">
                              <span className="w-1.5 h-1.5 rounded-full bg-indigo-500"></span>
                            </span>

                            <div className="flex items-center gap-2">
                              <span className={`px-1.5 py-0.2 rounded-[3px] text-[8px] font-extrabold tracking-wide uppercase ${getActivityTypeBadgeClass(act.type)}`}>
                                {act.type}
                              </span>
                              <span className="text-[10px] text-slate-500">
                                {formatDisplayDate(act.createdAt)}
                              </span>
                              {act.createdByUser?.name && (
                                <span className="text-[9px] text-slate-400 font-medium ml-auto flex items-center gap-0.5">
                                  <UserCheck className="w-2.5 h-2.5" />
                                  <span>{act.createdByUser.name}</span>
                                </span>
                              )}
                            </div>
                            {act.note && (
                              <p className="text-slate-300 text-[11px] bg-slate-950/30 p-2 border border-slate-900 rounded-lg mt-1 whitespace-pre-line leading-relaxed">
                                {act.note}
                              </p>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

              </div>

            </div>
          </div>
        </div>
      )}
    </div>
  );
}
