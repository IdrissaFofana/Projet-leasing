# Plan de développement — Backend NestJS
## Projet leasing imprimantes / cartouches / compteurs

Stack : **NestJS + Prisma + PostgreSQL**  
Front (plus tard) : **Next.js** dans `leasing-app/front`  
Schéma déjà posé : `prisma/schema.prisma`

---

## 0. Objectif du backend

Exposer une **API REST sécurisée** qui porte toute la logique métier aujourd’hui dans Excel :
parc, stock, affectations (kit CMYK), relevés compteurs, campagne mensuelle, facturation, maintenance, audit.

Le front Next.js ne calcule **pas** la facturation ni les deltas : il consomme l’API.

---

## 1. Structure cible des dossiers

```
leasing-app/
├── front/                 # Next.js (plus tard)
└── backend/
    ├── prisma/
    │   ├── schema.prisma  # ✓ déjà créé
    │   ├── migrations/
    │   └── seed.ts
    ├── src/
    │   ├── main.ts
    │   ├── app.module.ts
    │   ├── prisma/              # PrismaModule / PrismaService
    │   ├── common/              # guards, filters, dto utils, pipes
    │   ├── auth/
    │   ├── users/
    │   ├── referentiels/        # marques, fournisseurs, agents, services, tarifs, séquences
    │   ├── printers/            # Imprimantes
    │   ├── stock/               # modèles, SKU, entrées
    │   ├── assignments/         # affectations + lignes CMYK
    │   ├── readings/            # relevés compteurs
    │   ├── campaigns/           # saisie mensuelle
    │   ├── billing/             # factures période
    │   ├── maintenance/
    │   ├── dashboard/           # KPI agrégés
    │   └── audit/
    ├── test/
    ├── .env
    └── package.json
```

---

## 2. Phases de développement

### Phase A — Fondations (semaine 1)
| # | Tâche | Livrable |
|---|--------|----------|
| A1 | Init NestJS dans `backend/` | projet compilable |
| A2 | Brancher Prisma + `DATABASE_URL` | connexion OK |
| A3 | `prisma migrate dev` | tables créées en Postgres |
| A4 | Seed référentiels (marques, couleurs via enums, tarifs Excel, agents, préfixes ID) | données de base |
| A5 | Module `PrismaModule` global | injection partout |
| A6 | Config validation (`ConfigModule`), CORS, prefix `/api` | API prête |

**Critère de fin :** `GET /api/health` + Studio Prisma montrent les tables.

---

### Phase B — Auth & référentiels (semaine 1–2)
| # | Tâche | Endpoints principaux |
|---|--------|----------------------|
| B1 | Auth JWT (login, refresh optionnel) | `POST /auth/login` |
| B2 | Guards rôles (`ADMIN`, `TECHNICIEN`, `FACTURATION`, `LECTURE`) | décorateur `@Roles()` |
| B3 | CRUD Utilisateurs (admin) | `/users` |
| B4 | CRUD référentiels | `/marques`, `/fournisseurs`, `/agents`, `/services` |
| B5 | Tarifs leasing | `GET/PATCH /tarifs` |
| B6 | Service séquences ID (`IMP-`, `ENT-`, `AFF-`, `REL-`, `MNT-`, `FAC-`) | interne |

**Critère de fin :** login + liste marques/tarifs protégés par JWT.

---

### Phase C — Parc imprimantes (semaine 2)
| # | Tâche | Détail |
|---|--------|--------|
| C1 | CRUD imprimantes | code auto `IMP-xxxx`, n° série **unique** |
| C2 | Filtres | statut, localisation, marque |
| C3 | Validation | n° série obligatoire / unique |
| C4 | Import depuis Excel (script) | 10 imprimantes actuelles |

**API :**
- `GET /printers`
- `GET /printers/:id`
- `POST /printers`
- `PATCH /printers/:id`
- `DELETE /printers/:id` (soft : statut `RETIREE` préférable)

**Critère de fin :** parc Excel migré, CRUD testé.

---

### Phase D — Stock cartouches (semaine 2–3)
| # | Tâche | Détail |
|---|--------|--------|
| D1 | Modèles cartouche | ex. C-EXV 64 |
| D2 | SKU modèle+couleur | solde tenu à jour |
| D3 | Entrées stock | `ENT-xxxx`, +qté |
| D4 | Recalcul solde | service unique `StockService.recalculer(sku)` |
| D5 | Alertes | épuisé / stock bas |

**API :**
- `GET /stock/skus`
- `POST /stock/modeles`
- `POST /stock/entrees`
- `GET /stock/entrees`

**Règle :** jamais modifier `qteRestante` à la main hors service stock.

**Critère de fin :** entrée +10 YELLOW → restant +10.

---

### Phase E — Affectations / poses kit (semaine 3)
| # | Tâche | Détail |
|---|--------|--------|
| E1 | Créer affectation | imprimante + modèle + lignes CMYK |
| E2 | Mode kit | 4 lignes qté=1 |
| E3 | Mode partiel | 1–3 couleurs |
| E4 | Décrément stock transactionnel | rollback si stock insuffisant |
| E5 | Motifs / agent / statut pose | enums Excel |

**API :**
- `GET /assignments`
- `POST /assignments` body `{ printerId, modeleId, lignes: [{couleur, qte}], ... }`
- `POST /assignments/kit` raccourci 4 couleurs
- `GET /assignments/:id`

**Critère de fin :** kit complet décrémente B/C/M/Y ; partiel Black seul OK.

---

### Phase F — Relevés compteurs (cœur leasing) (semaine 3–4)
| # | Tâche | Détail |
|---|--------|--------|
| F1 | Créer relevé | compteurs 112/113/122/123, 501/301, scans |
| F2 | Calcul serveur | totaux, anciens, deltas `max(0,…)`, écart 301−noir, statut |
| F3 | Règles | BASE_INITIALE / OK / ANOMALIE / DOUBLON_PERIODE |
| F4 | Contrainte | 1 relevé facturable / imprimante / mois (ajustable) |
| F5 | Historique + filtre mois | équivalent Filtre mois Excel |

**API :**
- `GET /readings?mois=2026-07`
- `GET /readings/:id`
- `POST /readings`
- `PATCH /readings/:id` (si période non clôturée)
- `GET /readings/monthly-view?mois=2026-07` (début/fin/Δ)

**Critère de fin :** 2 relevés même machine → deltas corrects ; baisse → ANOMALIE.

---

### Phase G — Campagne saisie mensuelle (semaine 4)
| # | Tâche | Détail |
|---|--------|--------|
| G1 | Ouvrir campagne mois | 1 ligne / imprimante active |
| G2 | Saisie progressive | statut A_SAISIR → PRET |
| G3 | Archiver | lignes PRET → `ReleveCompteur` |
| G4 | Détection | déjà relevé / doublon / anomalie |

**API :**
- `POST /campaigns` `{ mois, dateReleve }`
- `GET /campaigns/:mois`
- `PATCH /campaigns/:mois/lignes/:printerId`
- `POST /campaigns/:mois/archive`

**Critère de fin :** campagne juillet → archive = relevés créés.

---

### Phase H — Facturation (semaine 5)
| # | Tâche | Détail |
|---|--------|--------|
| H1 | Calculer période | agrégats depuis relevés du mois |
| H2 | Snapshot tarifs | figer prix dans `FacturePeriode` |
| H3 | Lignes / imprimante | montants N&B, couleur, scans |
| H4 | Clôture | statut CLOTUREE — plus de modif relevés du mois |
| H5 | Export | JSON/CSV (PDF plus tard) |

**API :**
- `POST /billing/periods/:mois/calculate`
- `GET /billing/periods/:mois`
- `POST /billing/periods/:mois/close`
- `GET /billing/periods/:mois/export`

**Critère de fin :** montant = copies × tarifs ; clôture bloque les écritures.

---

### Phase I — Maintenance + Dashboard + Audit (semaine 5–6)
| # | Module | API |
|---|--------|-----|
| I1 | Maintenance CRUD | `/maintenance` |
| I2 | Dashboard KPI | `GET /dashboard` |
| I3 | Contrôle relevés | `GET /readings/control?mois=` |
| I4 | AuditLog | écriture auto sur CUD sensibles |
| I5 | Alertes | stock bas, maintenance < 7j, anomalies |

---

### Phase J — Qualité, docs, durcissement (semaine 6)
| # | Tâche |
|---|--------|
| J1 | Tests unitaires services (stock, relevés, facturation) |
| J2 | Tests e2e API critiques |
| J3 | Swagger (`/api/docs`) |
| J4 | Validation DTO stricte (class-validator) |
| J5 | Script migration données Excel → DB |
| J6 | README backend (install, env, commandes) |

---

## 3. Ordre de priorité métier (si délai serré)

1. **Printers + Readings + Billing** → valeur leasing immédiate  
2. **Stock + Assignments** → consommation terrain  
3. **Campaigns** → confort saisie mensuelle  
4. **Maintenance + Dashboard + Audit** → exploitation

---

## 4. Conventions techniques

- Prefixe global : `/api`
- Auth : Bearer JWT
- Erreurs : filtres Nest uniformes (`400/401/403/404/409`)
- Transactions Prisma pour : affectation+stock, archive campagne, clôture facture
- Pas de logique métier dans les controllers (services only)
- Codes métier générés uniquement via `IdSequenceService`

---

## 5. Dépendances npm principales (à installer en Phase A)

```
@nestjs/core @nestjs/common @nestjs/platform-express
@nestjs/config @nestjs/jwt @nestjs/passport passport passport-jwt
@nestjs/swagger class-validator class-transformer
@prisma/client prisma
bcrypt
```

---

## 6. Definition of Done — Backend « complet »

- [x] Toutes les tables migrées
- [x] Auth + rôles
- [x] CRUD parc / stock / poses / relevés / maintenance
- [x] Campagne mensuelle + archivage
- [x] Facturation calculée + clôturable
- [x] Dashboard + contrôle mois
- [x] Audit sur actions sensibles
- [x] Swagger à jour (tags par ressource)
- [x] Tests des 3 services critiques (stock, relevé, facture)
- [x] Script d’import Excel
- [x] README backend

---

## 7. Prochaine action concrète

Quand tu valides ce plan :
1. Initialiser NestJS dans `leasing-app/backend`
2. Brancher Prisma (schéma déjà prêt)
3. Enchaîner **Phase A → B → C**
