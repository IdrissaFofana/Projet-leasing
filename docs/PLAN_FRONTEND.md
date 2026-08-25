# Plan Frontend — Next.js (`leasing-app/front`)

Stack cible : **Next.js (App Router) + TypeScript + Tailwind**, consomme l’API Nest (`http://localhost:3001/api`).  
Aucune logique de facturation / deltas / stock côté navigateur.

---

## 0. Objectif

Remplacer progressivement Excel par une UI métier :

1. Saisie terrain (relevés, poses, stock)
2. Pilotage (dashboard, contrôle, campagnes)
3. Facturation (calcul, export, clôture)

---

## 1. Prérequis

- Backend A→J opérationnel (Swagger `/api/docs`)
- Variables front :

```env
NEXT_PUBLIC_API_URL=http://localhost:3001/api
```

---

## 2. Architecture front

```
front/
├── app/
│   ├── (auth)/login/page.tsx
│   ├── (app)/
│   │   ├── layout.tsx          # shell + nav rôles
│   │   ├── page.tsx            # dashboard
│   │   ├── imprimantes/
│   │   ├── stock/
│   │   ├── affectations/
│   │   ├── releves/
│   │   ├── campagnes/[mois]/
│   │   ├── facturation/
│   │   ├── maintenance/
│   │   └── admin/              # users, tarifs, référentiels
│   └── api/                    # proxies optionnels
├── components/                 # UI métier
├── lib/
│   ├── api-client.ts           # fetch + JWT
│   ├── auth.ts
│   └── types.ts                # types alignés OpenAPI
└── docs/PLAN_FRONTEND.md
```

---

## 3. Phases front

### F0 — Socle (semaine 1)
| # | Livrable |
|---|----------|
| F0.1 | Init Next.js + Tailwind dans `leasing-app/front` |
| F0.2 | Client API (`login`, bearer, gestion 401) |
| F0.3 | Layout app + navigation par rôle |
| F0.4 | Page login |

**Fin :** login → dashboard vide authentifié.

### F1 — Parc & référentiels (semaine 1–2)
| # | Écran |
|---|--------|
| F1.1 | Liste imprimantes (filtres statut / localisation / marque) |
| F1.2 | Fiche + création / édition |
| F1.3 | Admin : marques, fournisseurs, agents, services, tarifs |

### F2 — Stock & poses (semaine 2)
| # | Écran |
|---|--------|
| F2.1 | SKU + alertes stock bas |
| F2.2 | Entrée stock |
| F2.3 | Affectation partielle + bouton kit CMYK |

### F3 — Relevés & campagne (semaine 2–3) — cœur métier
| # | Écran |
|---|--------|
| F3.1 | Liste relevés filtrée mois |
| F3.2 | Formulaire relevé (112/113/122/123, 501/301, scans) |
| F3.3 | Vue mensuelle début/fin/Δ |
| F3.4 | Contrôle écarts 301 |
| F3.5 | Campagne mensuelle (grille saisie → archive) |

### F4 — Facturation (semaine 3–4)
| # | Écran |
|---|--------|
| F4.1 | Calcul période |
| F4.2 | Détail lignes + montants |
| F4.3 | Export CSV / JSON |
| F4.4 | Clôture (confirmation) |

### F5 — Exploitation (semaine 4)
| # | Écran |
|---|--------|
| F5.1 | Dashboard KPI + alertes |
| F5.2 | Maintenance CRUD |
| F5.3 | Audit (admin) |

### F6 — Polish (semaine 5)
| # | Tâche |
|---|--------|
| F6.1 | États loading / empty / erreur |
| F6.2 | Permissions UI selon rôle |
| F6.3 | Responsive tablettes terrain |
| F6.4 | Génération types depuis OpenAPI (optionnel) |

---

## 4. Mapping écrans → API

| Écran | Endpoints |
|-------|-----------|
| Login | `POST /auth/login` |
| Dashboard | `GET /dashboard` |
| Imprimantes | `GET/POST/PATCH/DELETE /printers` |
| Stock | `GET /stock/skus`, `POST /stock/entrees` |
| Poses | `POST /assignments`, `POST /assignments/kit` |
| Relevés | `GET/POST/PATCH /readings` |
| Vue mensuelle | `GET /readings/monthly-view?mois=` |
| Contrôle | `GET /readings/control?mois=` |
| Campagne | `POST/GET /campaigns`, `PATCH .../lignes/:id`, `POST .../archive` |
| Facture | `POST .../calculate`, `GET`, `POST .../close`, `GET .../export` |
| Maintenance | `CRUD /maintenance` |
| Audit | `GET /audit` |

---

## 5. Règles UX

- Le front **affiche** les calculs API (deltas, montants, écarts) — il ne les recalcule pas.
- Afficher clairement `BASE_INITIALE` / `OK` / `ANOMALIE_COMPTEUR`.
- Bloquer l’édition si période clôturée (message API).
- Kit CMYK = 1 action, confirmation si stock insuffisant.

---

## 6. Ordre de priorité (délai serré)

1. Login + Relevés + Vue mensuelle + Facturation  
2. Imprimantes + Campagne  
3. Stock + Affectations  
4. Dashboard + Maintenance + Admin  

---

## 7. Definition of Done — Front MVP

- [ ] Login JWT + shell rôles
- [ ] CRUD imprimantes
- [ ] Saisie / liste relevés + vue mensuelle + contrôle
- [ ] Campagne archive
- [ ] Calcul + export + clôture facture
- [ ] Stock + pose (au moins partiel)
- [ ] Dashboard alertes

---

## 8. Prochaine action

Quand le backend J est validé :

1. `npx create-next-app@latest` dans `leasing-app/front`
2. Brancher `NEXT_PUBLIC_API_URL`
3. Enchaîner **F0 → F1 → F3** (valeur leasing d’abord)
