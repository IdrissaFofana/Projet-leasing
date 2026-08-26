export type RoleUtilisateur = 'ADMIN' | 'TECHNICIEN' | 'FACTURATION' | 'LECTURE';

export type ModulePermission =
  | 'dashboard'
  | 'printers'
  | 'stock'
  | 'assignments'
  | 'readings'
  | 'campaigns'
  | 'billing'
  | 'maintenance'
  | 'referentiels'
  | 'users'
  | 'messages';

export type AuthUser = {
  id: string;
  email: string;
  nom: string;
  role: RoleUtilisateur;
  prenom?: string | null;
  nomFamille?: string | null;
  avatarUrl?: string | null;
  permissions: ModulePermission[];
  mustChangePassword: boolean;
};

export type UserProfile = {
  id: string;
  email: string;
  nom: string;
  prenom: string | null;
  nomFamille: string | null;
  autreAdresse: string | null;
  telephone: string | null;
  autreTelephone: string | null;
  dateNaissance: string | null;
  avatarUrl: string | null;
  languePref: string;
  notifEmail: boolean;
  role: RoleUtilisateur;
  permissions: string[];
  mustChangePassword: boolean;
  effectivePermissions?: ModulePermission[];
  actif: boolean;
  createdAt: string;
  updatedAt?: string;
};

export type ManagedUser = {
  id: string;
  email: string;
  nom: string;
  role: RoleUtilisateur;
  roleMetierId?: string | null;
  roleMetier?: RoleMetierRef | null;
  permissions: string[];
  mustChangePassword: boolean;
  actif: boolean;
  createdAt: string;
  temporaryPassword?: string;
  generatedPassword?: boolean;
  effectivePermissions?: ModulePermission[];
};

export type RoleMetierRef = {
  id: string;
  code: string;
  libelle: string;
  permissions: string[];
  systeme: boolean;
  actif: boolean;
};

export type RoleMetier = RoleMetierRef & {
  description?: string | null;
  createdAt?: string;
  updatedAt?: string;
  _count?: { utilisateurs: number };
  utilisateurs?: Array<{ id: string; nom: string; email: string; actif: boolean }>;
};

export type UserAssignee = {
  id: string;
  nom: string;
  email: string;
  role: RoleUtilisateur;
};

export type ModulesCatalog = {
  modules: ModulePermission[];
  defaultsByRole: Record<RoleUtilisateur, ModulePermission[]>;
};

export type LoginResponse = {
  accessToken: string;
  user: AuthUser;
};

export type DashboardSummary = {
  moisCourant: string;
  parc: { actives: number; retirees: number };
  stock: { alertesBas: number; epuises: number };
  releves: { anomalies: number };
  maintenance: { aVenir7j: number };
  activite30j: { entrees: number; affectations: number };
  facturation: {
    code: string;
    statut: string;
    montantTotal: string | number;
  } | null;
  alertes: {
    stockBas: number;
    stockEpuise: number;
    anomaliesReleves: number;
    maintenancesProches: number;
  };
  scoreAlertes: number;
};

export type NamedRef = {
  id: string;
  nom: string;
  actif?: boolean;
};

export type Tarif = {
  id: string;
  type: string;
  libelle: string;
  prixUnitaire: string | number;
  devise: string;
  actif: boolean;
};

export type StatutImprimante =
  | 'FONCTIONNELLE'
  | 'EN_MAINTENANCE'
  | 'HORS_SERVICE'
  | 'RETIREE';

export type Imprimante = {
  id: string;
  code: string;
  modele: string;
  numeroSerie: string;
  localisation: string | null;
  statut: StatutImprimante;
  dateInstallation: string | null;
  prochaineMaintenance: string | null;
  observations: string | null;
  marqueId: string | null;
  fournisseurId: string | null;
  serviceId: string | null;
  marque?: NamedRef | null;
  fournisseur?: NamedRef | null;
  service?: NamedRef | null;
};

export type CouleurToner =
  | 'TONER_BLACK'
  | 'TONER_CYAN'
  | 'TONER_MAGENTA'
  | 'TONER_YELLOW';

export type ModeleCartouche = {
  id: string;
  modele: string;
  marqueId: string | null;
  refFabricant: string | null;
  actif: boolean;
  marque?: NamedRef | null;
  skus?: CartoucheSku[];
};

export type CartoucheSku = {
  id: string;
  modeleId: string;
  couleur: CouleurToner;
  qteEntrees: number;
  qteSorties: number;
  qteRestante: number;
  statut: string;
  modele?: ModeleCartouche;
};

export type EntreeStock = {
  id: string;
  code: string;
  dateEntree: string;
  heureEntree?: string | null;
  modeleId: string;
  couleur: CouleurToner;
  qte: number;
  observations: string | null;
  modele?: ModeleCartouche;
  fournisseur?: NamedRef | null;
};

export type StockMouvement = {
  id: string;
  type: 'ENTREE' | 'SORTIE';
  code: string;
  date: string;
  heure: string | null;
  couleur: CouleurToner;
  qte: number;
  observations: string | null;
  detail: string | null;
  imprimante?: Imprimante | null;
  fournisseur?: NamedRef | null;
  affectationId: string | null;
};

export type StockMouvementsResponse = {
  modele: ModeleCartouche;
  skus: CartoucheSku[];
  mouvements: StockMouvement[];
};

export type Affectation = {
  id: string;
  code: string;
  datePose: string;
  heurePose?: string | null;
  imprimanteId: string;
  modeleId: string;
  motif: string | null;
  statutPose: string;
  observations: string | null;
  imprimante?: Imprimante;
  modele?: ModeleCartouche;
  agent?: NamedRef | null;
  lignes?: Array<{ id: string; couleur: CouleurToner; qte: number }>;
};

export type StatutReleve =
  | 'BASE_INITIALE'
  | 'BROUILLON'
  | 'SAISI'
  | 'OK'
  | 'ANOMALIE_COMPTEUR'
  | 'A_CONTROLER'
  | 'CONTROLE'
  | 'VALIDE'
  | 'DOUBLON_PERIODE';

export type ObservationReleve =
  | 'RAS'
  | 'RESET_COMPTEUR'
  | 'MACHINE_REMPLACEE'
  | 'RELEVE_ESTIME'
  | 'CONTROLE_TECHNIQUE'
  | 'AUTRE';

export const OBSERVATION_RELEVE_LABEL: Record<ObservationReleve, string> = {
  RAS: 'RAS',
  RESET_COMPTEUR: 'Reset compteur',
  MACHINE_REMPLACEE: 'Machine remplacée',
  RELEVE_ESTIME: 'Relevé estimé',
  CONTROLE_TECHNIQUE: 'Contrôle technique',
  AUTRE: 'Autre',
};

export type ReleveAudit = {
  id: string;
  action: string;
  userId: string | null;
  beforeJson: string | null;
  afterJson: string | null;
  createdAt: string;
};

export type Releve = {
  id: string;
  code: string;
  imprimanteId: string;
  moisFacture: string;
  dateReleve: string;
  c112: number;
  c113: number;
  c122: number;
  c123: number;
  c501: number | null;
  c301: number | null;
  scanNoir: number;
  scanCouleur: number;
  envoi: number;
  totalNoir: number;
  totalCouleur: number;
  ancienTotalNoir?: number | null;
  ancienTotalCouleur?: number | null;
  copiesNoirBrutes?: number;
  copiesCouleurBrutes?: number;
  copiesNoirDelta?: number;
  copiesCouleurDelta?: number;
  quotaNoirDispo?: number;
  quotaCouleurDispo?: number;
  copiesNoirIncluses?: number;
  copiesCouleurIncluses?: number;
  quotaNoirReport?: number;
  quotaCouleurReport?: number;
  copiesNoirFacturer: number;
  copiesCouleurFacturer: number;
  totalCopiesFacturer: number;
  scansNoirFacturer?: number;
  scansCouleurFacturer?: number;
  envoisFacturer?: number;
  ecartControle: number | null;
  alerteDeltaHaut?: boolean;
  alerteEcart301?: boolean;
  statut: StatutReleve;
  observationMotif?: ObservationReleve | null;
  observations: string | null;
  rapportPath?: string | null;
  rapportNom?: string | null;
  rapportMime?: string | null;
  imprimante?: Imprimante;
  audits?: ReleveAudit[];
  assistance?: { id: string; code: string } | null;
};

export type PreviousReading = {
  id: string;
  code: string;
  moisFacture: string;
  dateReleve: string;
  c112: number;
  c113: number;
  c122: number;
  c123: number;
  c301: number | null;
  c501: number | null;
  scanNoir: number;
  scanCouleur: number;
  envoi: number;
  totalNoir: number;
  totalCouleur: number;
  copiesNoirFacturer: number;
  copiesCouleurFacturer: number;
} | null;

export type MonthlyView = {
  mois: string;
  moisPrecedent?: string;
  lignes: Array<{
    imprimante: Imprimante;
    debut: { totalNoir: number; totalCouleur: number; code: string } | null;
    fin: {
      id?: string;
      totalNoir: number;
      totalCouleur: number;
      code: string;
      statut: string;
      ecartControle: number | null;
      alerteDeltaHaut?: boolean;
      alerteEcart301?: boolean;
    };
    delta: {
      noir: number;
      couleur: number;
      total: number;
      noirBrut?: number;
      couleurBrut?: number;
      noirFacturer?: number;
      couleurFacturer?: number;
      noirInclus?: number;
      couleurInclus?: number;
      quotaNoirDispo?: number;
      quotaCouleurDispo?: number;
      quotaNoirReport?: number;
      quotaCouleurReport?: number;
    };
    comparaison?: {
      moisPrecedent: string;
      deltaNoirPrecedent: number | null;
      deltaCouleurPrecedent: number | null;
      pctNoir: number | null;
      pctCouleur: number | null;
    };
  }>;
  totaux: {
    deltaNoir: number;
    deltaCouleur: number;
    deltaTotal: number;
    nbImprimantes: number;
  };
};

export type ReadingsMatrix = {
  moisDebut: string;
  moisFin: string;
  mois: string[];
  quotaBase: { noir: number; couleur: number };
  lignes: Array<{
    imprimante: Imprimante;
    cellules: Record<
      string,
      {
        id: string;
        code: string;
        totalNoir: number;
        totalCouleur: number;
        c112: number;
        c113: number;
        c122: number;
        c123: number;
        deltaNoir: number;
        deltaCouleur: number;
        inclusNoir: number;
        inclusCouleur: number;
        facturerNoir: number;
        facturerCouleur: number;
        quotaNoirDispo: number;
        quotaCouleurDispo: number;
        quotaNoirReport: number;
        quotaCouleurReport: number;
        statut: string;
      } | null
    >;
  }>;
};

export type ControlView = {
  mois: string;
  lignes: Array<{
    id: string;
    code: string;
    imprimante: Imprimante;
    statut: string;
    observationMotif?: string | null;
    totalNoir: number;
    totalCouleur?: number;
    c301: number | null;
    ecartControle: number | null;
    ecartOk: boolean;
    anomaly: boolean;
    alerteDeltaHaut?: boolean;
    alerteEcart301?: boolean;
    copiesNoirBrutes?: number;
    copiesCouleurBrutes?: number;
    copiesNoirFacturer?: number;
    copiesCouleurFacturer?: number;
    aTraiter?: boolean;
  }>;
  file?: ControlView['lignes'];
  resume: {
    total: number;
    anomalies: number;
    ecartsNonNuls: number;
    alertesDelta?: number;
    aControler?: number;
    controles?: number;
    valides?: number;
    ok: number;
    bases: number;
    aTraiter?: number;
  };
};

export type Campagne = {
  id: string;
  mois: string;
  dateReleve: string;
  heureReleve: string | null;
  cloturee: boolean;
  lignes?: CampagneLigne[];
  _count?: { lignes: number };
};

export type CampagneLigne = {
  id: string;
  imprimanteId: string;
  c112: number | null;
  c113: number | null;
  c122: number | null;
  c123: number | null;
  c501: number | null;
  c301: number | null;
  scanNoir: number | null;
  scanCouleur: number | null;
  envoi: number | null;
  statutLigne: string;
  observationMotif?: string | null;
  observations: string | null;
  archiveVersReleveId: string | null;
  imprimante?: Imprimante;
};

export type FacturePeriode = {
  id: string;
  code: string;
  mois: string;
  prixNb: string | number;
  prixCouleur: string | number;
  montantTotal: string | number;
  statut: string;
  clotureeAt: string | null;
  lignes?: FactureLigne[];
};

export type FactureLigne = {
  id: string;
  imprimanteId: string;
  copiesNb: number;
  copiesCouleur: number;
  montantCopies: string | number;
  montantScans: string | number;
  montantTotal: string | number;
  statut: string;
  imprimante?: Imprimante;
};

export type Maintenance = {
  id: string;
  code: string;
  dateMaintenance: string;
  imprimanteId: string;
  type: string;
  technicienId: string | null;
  assigneeUserId?: string | null;
  actionsRealisees: string | null;
  piecesConsommables: string | null;
  prochaineMaintenance: string | null;
  observations: string | null;
  moisAssistance?: string | null;
  releveId?: string | null;
  rapportPath?: string | null;
  rapportNom?: string | null;
  rapportMime?: string | null;
  imprimante?: Imprimante;
  technicien?: NamedRef | null;
  assigneeUser?: { id: string; nom: string; email: string } | null;
  releve?: { id: string; code: string; moisFacture: string } | null;
};

export type AssistanceQuota = {
  mois: string;
  prevuesParImprimante: number;
  incomplete: number;
  lignes: Array<{
    imprimanteId: string;
    code: string;
    localisation: string | null;
    faites: number;
    prevues: number;
    restantes: number;
    complet: boolean;
  }>;
};

export const COULEUR_LABEL: Record<CouleurToner, string> = {
  TONER_BLACK: 'Noir',
  TONER_CYAN: 'Cyan',
  TONER_MAGENTA: 'Magenta',
  TONER_YELLOW: 'Jaune',
};

export const STATUT_IMP_LABEL: Record<StatutImprimante, string> = {
  FONCTIONNELLE: 'Fonctionnelle',
  EN_MAINTENANCE: 'En maintenance',
  HORS_SERVICE: 'Hors service',
  RETIREE: 'Retirée',
};

export type NotificationType =
  | 'STOCK_BAS'
  | 'STOCK_EPUISE'
  | 'ANOMALIE_RELEVE'
  | 'MAINTENANCE_PROCHE'
  | 'ASSISTANCE_QUOTA'
  | 'FACTURATION'
  | 'CAMPAGNE'
  | 'SYSTEME'
  | 'MESSAGE';

export type NotificationPriority = 'LOW' | 'NORMAL' | 'HIGH' | 'CRITICAL';

export type AppNotification = {
  id: string;
  type: NotificationType;
  priority: NotificationPriority;
  titre: string;
  message: string;
  lien: string | null;
  fingerprint: string;
  luAt: string | null;
  createdAt: string;
};

export type DirectoryUser = {
  id: string;
  nom: string;
  email: string;
  role: RoleUtilisateur;
};

export type AppMessage = {
  id: string;
  sujet: string;
  corps: string;
  luAt: string | null;
  createdAt: string;
  expediteurId: string;
  destinataireId: string;
  expediteur?: { id: string; nom: string; email: string };
  destinataire?: { id: string; nom: string; email: string };
};

export type ConversationSummary = {
  peer: DirectoryUser & { role?: RoleUtilisateur };
  lastMessage: {
    id: string;
    corps: string;
    sujet: string;
    createdAt: string;
    fromMe: boolean;
  };
  unreadCount: number;
};

export type ConversationThread = {
  peer: DirectoryUser & { role?: RoleUtilisateur };
  messages: AppMessage[];
};

export type AuditEntry = {
  id: string;
  dateHeure: string;
  action: string;
  entite: string | null;
  entiteId: string | null;
  details: string | null;
  ipAdresse?: string | null;
  userAgent?: string | null;
  resultat?: string;
  user?: { id: string; email: string; nom: string; role?: string } | null;
};

