import { clearSession, getStoredUser, getToken, setStoredUser } from './auth-storage';
import type {
  Affectation,
  AppMessage,
  AppNotification,
  AuditEntry,
  AuthUser,
  Campagne,
  CampagneLigne,
  CartoucheSku,
  ConversationSummary,
  ConversationThread,
  CouleurToner,
  ControlView,
  DashboardSummary,
  DirectoryUser,
  EntreeStock,
  FacturePeriode,
  Imprimante,
  LoginResponse,
  Maintenance,
  ManagedUser,
  ModeleCartouche,
  ModulesCatalog,
  MonthlyView,
  NamedRef,
  ClientRef,
  ReadingsMatrix,
  Releve,
  AssistanceQuota,
  BackupListResponse,
  BackupRecord,
  RoleMetier,
  StatutImprimante,
  StockMouvementsResponse,
  StockProduit,
  StockProduitSummary,
  StatutStockProduit,
  Tarif,
  UserAssignee,
  UserProfile,
} from './types';

const CONFIGURED_API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api';

/** En accès LAN (IP:3000), remplace localhost par l’hôte du navigateur. */
function apiBaseUrl(): string {
  if (typeof window === 'undefined') return CONFIGURED_API_URL;
  try {
    const u = new URL(CONFIGURED_API_URL);
    const host = window.location.hostname;
    if (
      (u.hostname === 'localhost' || u.hostname === '127.0.0.1') &&
      host !== 'localhost' &&
      host !== '127.0.0.1'
    ) {
      u.hostname = host;
      return u.toString().replace(/\/$/, '');
    }
  } catch {
    /* ignore */
  }
  return CONFIGURED_API_URL;
}

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function request<T>(
  path: string,
  options: RequestInit = {},
  auth = true,
): Promise<T> {
  const headers = new Headers(options.headers);
  const isFormData = typeof FormData !== 'undefined' && options.body instanceof FormData;
  if (!headers.has('Content-Type') && options.body && !isFormData) {
    headers.set('Content-Type', 'application/json');
  }
  if (auth) {
    const token = getToken();
    if (token) headers.set('Authorization', `Bearer ${token}`);
  }

  const res = await fetch(`${apiBaseUrl()}${path}`, { ...options, headers });

  if (res.status === 401 && auth) {
    clearSession();
    if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/login')) {
      window.location.href = '/login';
    }
    throw new ApiError(401, 'Session expiree');
  }

  if (!res.ok) {
    let message = `Erreur ${res.status}`;
    try {
      const body = (await res.json()) as { message?: string | string[] };
      if (Array.isArray(body.message)) message = body.message.join(', ');
      else if (body.message) message = body.message;
    } catch {
      /* ignore */
    }
    if (
      res.status === 403 &&
      auth &&
      typeof window !== 'undefined' &&
      /mot de passe/i.test(message)
    ) {
      const stored = getStoredUser();
      if (stored && !stored.mustChangePassword) {
        setStoredUser({ ...stored, mustChangePassword: true });
      }
      if (!window.location.pathname.startsWith('/change-password')) {
        window.location.replace('/change-password');
      }
    }
    throw new ApiError(res.status, message);
  }

  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

async function uploadFile<T>(path: string, file: File, field = 'file'): Promise<T> {
  const fd = new FormData();
  fd.append(field, file);
  return request<T>(path, { method: 'POST', body: fd });
}

function qs(params: Record<string, string | undefined | null>) {
  const sp = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v != null && v !== '') sp.set(k, v);
  });
  const s = sp.toString();
  return s ? `?${s}` : '';
}

async function downloadFile(
  path: string,
  fallbackName: string,
): Promise<void> {
  const headers = new Headers();
  const token = getToken();
  if (token) headers.set('Authorization', `Bearer ${token}`);

  const res = await fetch(`${apiBaseUrl()}${path}`, { headers });
  if (res.status === 401) {
    clearSession();
    if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/login')) {
      window.location.href = '/login';
    }
    throw new ApiError(401, 'Session expiree');
  }
  if (!res.ok) {
    let message = `Erreur ${res.status}`;
    try {
      const body = (await res.json()) as { message?: string | string[] };
      if (Array.isArray(body.message)) message = body.message.join(', ');
      else if (body.message) message = body.message;
    } catch {
      /* ignore */
    }
    throw new ApiError(res.status, message);
  }

  const blob = await res.blob();
  const cd = res.headers.get('Content-Disposition');
  const match = cd?.match(/filename="?([^"]+)"?/i);
  const filename = match?.[1] ?? fallbackName;
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export const api = {
  login(email: string, password: string) {
    return request<LoginResponse>(
      '/auth/login',
      { method: 'POST', body: JSON.stringify({ email, password }) },
      false,
    );
  },

  changePassword(data: { currentPassword?: string; newPassword: string }) {
    return request<AuthUser>('/auth/change-password', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  dashboard() {
    return request<DashboardSummary>('/dashboard');
  },

  // Référentiels
  marques: {
    list: () => request<NamedRef[]>('/marques'),
    create: (nom: string) =>
      request<NamedRef>('/marques', { method: 'POST', body: JSON.stringify({ nom }) }),
    update: (id: string, data: { nom?: string; actif?: boolean }) =>
      request<NamedRef>(`/marques/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  },
  fournisseurs: {
    list: () => request<NamedRef[]>('/fournisseurs'),
    create: (nom: string) =>
      request<NamedRef>('/fournisseurs', { method: 'POST', body: JSON.stringify({ nom }) }),
    update: (id: string, data: { nom?: string; actif?: boolean }) =>
      request<NamedRef>(`/fournisseurs/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),
  },
  agents: {
    list: () => request<NamedRef[]>('/agents'),
    create: (nom: string) =>
      request<NamedRef>('/agents', { method: 'POST', body: JSON.stringify({ nom }) }),
    update: (id: string, data: { nom?: string; actif?: boolean }) =>
      request<NamedRef>(`/agents/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  },
  services: {
    list: () => request<NamedRef[]>('/services'),
    create: (nom: string) =>
      request<NamedRef>('/services', { method: 'POST', body: JSON.stringify({ nom }) }),
    update: (id: string, data: { nom?: string; actif?: boolean }) =>
      request<NamedRef>(`/services/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  },
  clients: {
    list: () => request<ClientRef[]>('/clients'),
    create: (data: { nom: string; telephone?: string; email?: string }) =>
      request<ClientRef>('/clients', { method: 'POST', body: JSON.stringify(data) }),
    update: (
      id: string,
      data: { nom?: string; telephone?: string | null; email?: string | null; actif?: boolean },
    ) =>
      request<ClientRef>(`/clients/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    remove: (id: string) =>
      request<{ ok: boolean; unlinked: number }>(`/clients/${id}`, { method: 'DELETE' }),
  },
  tarifs: {
    list: () => request<Tarif[]>('/tarifs'),
    update: (id: string, data: Partial<Tarif>) =>
      request<Tarif>(`/tarifs/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  },

  // Imprimantes
  printers: {
    list: (params: {
      q?: string;
      statut?: StatutImprimante;
      marqueId?: string;
      localisation?: string;
    } = {}) => request<Imprimante[]>(`/printers${qs(params)}`),
    get: (id: string) => request<Imprimante>(`/printers/${id}`),
    create: (data: Record<string, unknown>) =>
      request<Imprimante>('/printers', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: Record<string, unknown>) =>
      request<Imprimante>(`/printers/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),
    remove: (id: string) =>
      request<Imprimante>(`/printers/${id}`, { method: 'DELETE' }),
  },

  // Stock
  stock: {
    modeles: () => request<ModeleCartouche[]>('/stock/modeles'),
    createModele: (data: { modele: string; marqueId?: string; marqueNom?: string }) =>
      request<ModeleCartouche>('/stock/modeles', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    skus: (params: { modeleId?: string; alerte?: string } = {}) =>
      request<CartoucheSku[]>(`/stock/skus${qs(params)}`),
    entrees: (params: { modeleId?: string } = {}) =>
      request<EntreeStock[]>(`/stock/entrees${qs(params)}`),
    createEntree: (data: {
      dateEntree: string;
      heureEntree?: string;
      modeleId: string;
      couleur: CouleurToner;
      qte: number;
      fournisseurId?: string;
      observations?: string;
    }) =>
      request<EntreeStock>('/stock/entrees', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    createEntreesBatch: (data: {
      dateEntree: string;
      heureEntree?: string;
      observations?: string;
      lignes: Array<{ modeleId: string; couleur: CouleurToner; qte: number }>;
    }) =>
      request<EntreeStock[]>('/stock/entrees/batch', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    updateEntree: (id: string, data: Record<string, unknown>) =>
      request<EntreeStock>(`/stock/entrees/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),
    removeEntree: (id: string) =>
      request<EntreeStock>(`/stock/entrees/${id}`, { method: 'DELETE' }),
    mouvements: (modeleId: string) =>
      request<StockMouvementsResponse>(`/stock/mouvements${qs({ modeleId })}`),
    updateSortie: (id: string, data: Record<string, unknown>) =>
      request<unknown>(`/stock/sorties/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),
    removeSortie: (id: string) =>
      request<unknown>(`/stock/sorties/${id}`, { method: 'DELETE' }),
  },

  // Affectations
  assignments: {
    list: (params: { imprimanteId?: string } = {}) =>
      request<Affectation[]>(`/assignments${qs(params)}`),
    get: (id: string) => request<Affectation>(`/assignments/${id}`),
    create: (data: Record<string, unknown>) =>
      request<Affectation>('/assignments', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    kit: (data: Record<string, unknown>) =>
      request<Affectation>('/assignments/kit', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    update: (id: string, data: Record<string, unknown>) =>
      request<Affectation>(`/assignments/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),
    remove: (id: string) =>
      request<{ ok: boolean; id: string; code: string }>(`/assignments/${id}`, {
        method: 'DELETE',
      }),
  },

  // Relevés
  readings: {
    list: (
      params: {
        mois?: string;
        imprimanteId?: string;
        statut?: string;
        q?: string;
        serviceId?: string;
        marqueId?: string;
        localisation?: string;
        file?: string;
      } = {},
    ) => request<Releve[]>(`/readings${qs(params)}`),
    get: (id: string) => request<Releve>(`/readings/${id}`),
    previous: (params: { imprimanteId: string; moisFacture: string; dateReleve?: string }) =>
      request<import('./types').PreviousReading>(`/readings/previous${qs(params)}`),
    create: (data: Record<string, unknown>) =>
      request<Releve>('/readings', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: Record<string, unknown>) =>
      request<Releve>(`/readings/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),
    import: (data: Record<string, unknown>) =>
      request<{
        total: number;
        ok: number;
        erreurs: number;
        lignes: Array<{ codeImprimante: string; code?: string; error?: string }>;
      }>('/readings/import', { method: 'POST', body: JSON.stringify(data) }),
    acceptAnomaly: (id: string, data: { observationMotif: string; observations?: string }) =>
      request<Releve>(`/readings/${id}/accept-anomaly`, {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    markControle: (id: string) =>
      request<Releve>(`/readings/${id}/control`, { method: 'POST' }),
    markValide: (id: string) =>
      request<Releve>(`/readings/${id}/validate`, { method: 'POST' }),
    monthlyView: (mois: string) =>
      request<MonthlyView>(`/readings/monthly-view${qs({ mois })}`),
    matrix: (moisDebut: string, moisFin: string) =>
      request<ReadingsMatrix>(`/readings/matrix${qs({ moisDebut, moisFin })}`),
    control: (mois: string) =>
      request<ControlView>(`/readings/control${qs({ mois })}`),
    controlExport: (mois: string) =>
      request<{ filename: string; content: string }>(
        `/readings/control/export${qs({ mois })}`,
      ),
    exportFile: (params: {
      format: 'xlsx' | 'pdf';
      view: 'liste' | 'mensuelle' | 'controle' | 'matrice';
      mois?: string;
      moisDebut?: string;
      moisFin?: string;
      metric?: 'compteurs' | 'delta' | 'facturer';
    }) =>
      downloadFile(
        `/readings/export${qs(params)}`,
        `releves-${params.view}.${params.format === 'xlsx' ? 'xlsx' : 'pdf'}`,
      ),
    uploadRapport: (id: string, file: File) =>
      uploadFile<Releve>(`/readings/${id}/rapport`, file),
    downloadRapport: (id: string, filename = 'rapport-compteur') =>
      downloadFile(`/readings/${id}/rapport`, filename),
    delete: (id: string) =>
      request<{
        ok: boolean;
        code: string;
        moisFacture: string;
        factureRecalculRequise: boolean;
        campagneRouverte: boolean;
      }>(`/readings/${id}`, { method: 'DELETE' }),
  },

  // Campagnes
  campaigns: {
    list: () => request<Campagne[]>('/campaigns'),
    get: (mois: string) => request<Campagne>(`/campaigns/${mois}`),
    create: (data: {
      mois: string;
      dateReleve: string;
      heureReleve?: string;
      portee?: 'ALL' | 'SELECTION';
      imprimanteIds?: string[];
    }) =>
      request<Campagne>('/campaigns', { method: 'POST', body: JSON.stringify(data) }),
    addLignes: (mois: string, imprimanteIds: string[]) =>
      request<Campagne>(`/campaigns/${mois}/lignes`, {
        method: 'POST',
        body: JSON.stringify({ imprimanteIds }),
      }),
    removeLigne: (mois: string, printerId: string) =>
      request<Campagne>(`/campaigns/${mois}/lignes/${printerId}`, { method: 'DELETE' }),
    delete: (mois: string) =>
      request<{ ok: boolean; mois: string }>(`/campaigns/${mois}`, { method: 'DELETE' }),
    updateLigne: (mois: string, printerId: string, data: Record<string, unknown>) =>
      request<CampagneLigne>(`/campaigns/${mois}/lignes/${printerId}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),
    uploadRapportLigne: (mois: string, printerId: string, file: File) =>
      uploadFile<Campagne>(`/campaigns/${mois}/lignes/${printerId}/rapport`, file),
    downloadRapportLigne: (mois: string, printerId: string, filename = 'rapport-compteur') =>
      downloadFile(`/campaigns/${mois}/lignes/${printerId}/rapport`, filename),
    archive: (mois: string) =>
      request<{
        mois: string;
        archives: Array<{ imprimanteId?: string; code?: string; error?: string }>;
        campagneCloturee: boolean;
        restantes: number;
      }>(`/campaigns/${mois}/archive`, { method: 'POST' }),
    reopen: (mois: string) => request<Campagne>(`/campaigns/${mois}/reopen`, { method: 'POST' }),
    unlinkLigne: (mois: string, printerId: string) =>
      request<Campagne>(`/campaigns/${mois}/lignes/${printerId}/unlink`, {
        method: 'POST',
      }),
    exportFile: (mois: string, format: 'xlsx' | 'pdf') =>
      downloadFile(
        `/campaigns/${mois}/export${qs({ format })}`,
        `campagne-${mois}.${format === 'xlsx' ? 'xlsx' : 'pdf'}`,
      ),
  },

  // Facturation
  billing: {
    list: () =>
      request<Array<FacturePeriode & { _count?: { lignes: number } }>>(
        '/billing/periods',
      ),
    get: (mois: string) => request<FacturePeriode>(`/billing/periods/${mois}`),
    calculate: (mois: string) =>
      request<FacturePeriode>(`/billing/periods/${mois}/calculate`, {
        method: 'POST',
      }),
    close: (mois: string) =>
      request<FacturePeriode>(`/billing/periods/${mois}/close`, { method: 'POST' }),
    export: (mois: string, format: 'json' | 'csv' = 'csv') =>
      request<{
        content?: string;
        mois?: string;
        format?: string;
        montantTotal?: string | number;
        statut?: string;
      }>(`/billing/periods/${mois}/export${qs({ format })}`),
    exportFile: (mois: string, format: 'xlsx' | 'pdf') =>
      downloadFile(
        `/billing/periods/${mois}/export${qs({ format })}`,
        `facture-${mois}.${format}`,
      ),
  },

  // Rapports
  reports: {
    leasingMensuelle: (mois: string) =>
      downloadFile(`/reports/leasing-mensuelle/${mois}`, `leasing-mensuelle-${mois}.pdf`),
    facturationMensuelle: (mois: string) =>
      downloadFile(
        `/reports/facturation-mensuelle/${mois}`,
        `facturation-mensuelle-${mois}.pdf`,
      ),
    leasingAnnuelle: (annee: string) =>
      downloadFile(`/reports/leasing-annuelle/${annee}`, `leasing-annuelle-${annee}.pdf`),
    leasingSemestrielle: (annee: string, semestre: 1 | 2) =>
      downloadFile(
        `/reports/leasing-semestrielle/${annee}/${semestre}`,
        `leasing-semestrielle-${annee}-S${semestre}.pdf`,
      ),
    leasingTrimestrielle: (annee: string, trimestre: 1 | 2 | 3 | 4) =>
      downloadFile(
        `/reports/leasing-trimestrielle/${annee}/${trimestre}`,
        `leasing-trimestrielle-${annee}-T${trimestre}.pdf`,
      ),
    intervention: (id: string, code = 'intervention') =>
      downloadFile(`/reports/intervention/${id}`, `intervention-${code}.pdf`),
    modeleLeasingMensuelle: () =>
      downloadFile(`/reports/modele/leasing-mensuelle`, `modele-leasing-mensuelle.pdf`),
  },

  // Maintenance
  maintenance: {
    list: (params: { imprimanteId?: string; type?: string; moisAssistance?: string } = {}) =>
      request<Maintenance[]>(`/maintenance${qs(params)}`),
    get: (id: string) => request<Maintenance>(`/maintenance/${id}`),
    assistanceQuota: (mois?: string) =>
      request<AssistanceQuota>(`/maintenance/assistance-quota${qs({ mois })}`),
    create: (data: Record<string, unknown>) =>
      request<Maintenance>('/maintenance', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    update: (id: string, data: Record<string, unknown>) =>
      request<Maintenance>(`/maintenance/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),
    remove: (id: string) =>
      request<Maintenance>(`/maintenance/${id}`, { method: 'DELETE' }),
    uploadRapport: (id: string, file: File) =>
      uploadFile<Maintenance>(`/maintenance/${id}/rapport`, file),
    downloadRapport: (id: string, filename = 'rapport-assistance') =>
      downloadFile(`/maintenance/${id}/rapport`, filename),
  },

  me: {
    get: () => request<UserProfile>('/users/me'),
    update: (data: Record<string, unknown>) =>
      request<UserProfile>('/users/me', {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),
  },

  users: {
    list: () => request<ManagedUser[]>('/users'),
    modules: () => request<ModulesCatalog>('/users/modules'),
    assignees: () => request<UserAssignee[]>('/users/assignees'),
    get: (id: string) => request<ManagedUser>(`/users/${id}`),
    create: (data: Record<string, unknown>) =>
      request<ManagedUser>('/users', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    update: (id: string, data: Record<string, unknown>) =>
      request<ManagedUser>(`/users/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),
    resetPassword: (id: string) =>
      request<ManagedUser>(`/users/${id}/reset-password`, { method: 'POST' }),
    remove: (id: string) =>
      request<{ ok: boolean }>(`/users/${id}`, { method: 'DELETE' }),
  },

  roles: {
    list: () => request<RoleMetier[]>('/roles'),
    get: (id: string) => request<RoleMetier>(`/roles/${id}`),
    create: (data: Record<string, unknown>) =>
      request<RoleMetier>('/roles', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    update: (id: string, data: Record<string, unknown>) =>
      request<RoleMetier>(`/roles/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),
    remove: (id: string) =>
      request<{ ok: boolean }>(`/roles/${id}`, { method: 'DELETE' }),
  },

  stockProduits: {
    list: (
      params: {
        q?: string;
        statut?: StatutStockProduit;
        fournisseur?: string;
        destinataire?: string;
      } = {},
    ) => request<StockProduit[]>(`/stock-produits${qs(params)}`),
    summary: () => request<StockProduitSummary>('/stock-produits/summary'),
    get: (id: string) => request<StockProduit>(`/stock-produits/${id}`),
    create: (data: Record<string, unknown>) =>
      request<StockProduit>('/stock-produits', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    update: (id: string, data: Record<string, unknown>) =>
      request<StockProduit>(`/stock-produits/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),
    sortie: (
      id: string,
      data: {
        qte: number;
        dateLivraison?: string;
        destinataire?: string;
        clientId?: string;
        bonLivraison?: string;
        observations?: string;
      },
    ) =>
      request<StockProduit>(`/stock-produits/${id}/sortie`, {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    remove: (id: string) =>
      request<{ ok: boolean }>(`/stock-produits/${id}`, { method: 'DELETE' }),
  },

  notifications: {
    list: (limit = 40) =>
      request<AppNotification[]>(`/notifications/me${qs({ limit: String(limit) })}`),
    sync: () =>
      request<AppNotification[]>('/notifications/me/sync', { method: 'POST' }),
    unreadCount: () =>
      request<{ count: number }>('/notifications/me/unread-count'),
    markRead: (id: string) =>
      request<AppNotification>(`/notifications/${id}/read`, { method: 'PATCH' }),
    markAllRead: () =>
      request<{ ok: boolean }>('/notifications/me/read-all', { method: 'POST' }),
  },

  messages: {
    directory: () => request<DirectoryUser[]>('/messages/directory'),
    conversations: () => request<ConversationSummary[]>('/messages/conversations'),
    thread: (peerId: string) =>
      request<ConversationThread>(`/messages/conversations/${peerId}`),
    inbox: (limit = 40) =>
      request<AppMessage[]>(`/messages/inbox${qs({ limit: String(limit) })}`),
    sent: (limit = 40) =>
      request<AppMessage[]>(`/messages/sent${qs({ limit: String(limit) })}`),
    unreadCount: () => request<{ count: number }>('/messages/unread-count'),
    send: (data: { destinataireId: string; sujet?: string; corps: string }) =>
      request<AppMessage>('/messages', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    markRead: (id: string) =>
      request<AppMessage>(`/messages/${id}/read`, { method: 'PATCH' }),
  },

  audit: {
    me: (limit = 40) =>
      request<AuditEntry[]>(`/audit/me${qs({ limit: String(limit) })}`),
    recent: (
      params: number | {
        limit?: number;
        userId?: string;
        entite?: string;
        action?: string;
        resultat?: string;
      } = 100,
    ) => {
      const opts = typeof params === 'number' ? { limit: params } : params;
      return request<AuditEntry[]>(
        `/audit${qs({
          limit: opts.limit != null ? String(opts.limit) : '100',
          userId: opts.userId,
          entite: opts.entite,
          action: opts.action,
          resultat: opts.resultat,
        })}`,
      );
    },
  },

  backups: {
    list: (params?: {
      page?: number;
      limit?: number;
      status?: string;
      type?: string;
      from?: string;
      to?: string;
    }) =>
      request<BackupListResponse>(
        `/backups${qs({
          page: params?.page != null ? String(params.page) : undefined,
          limit: params?.limit != null ? String(params.limit) : undefined,
          status: params?.status,
          type: params?.type,
          from: params?.from,
          to: params?.to,
        })}`,
      ),
    latest: () => request<BackupRecord | null>('/backups/latest'),
    get: (id: string) => request<BackupRecord>(`/backups/${id}`),
    run: () =>
      request<BackupRecord>('/backups/run', { method: 'POST' }),
  },
};
