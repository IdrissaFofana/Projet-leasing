# Modèle de données — Système de leasing imprimantes

Source : analyse du classeur `Gestion cartouche et imprimante.xlsx` (21 feuilles).  
Stack cible : **PostgreSQL + Prisma + NestJS (API) + Next.js (front)**.

---

## Architecture recommandée (réponse à ta question)

### Ne pas faire un MVC monolithique classique « tout dans un seul app »
Pour un leasing complet (compteurs, stock, facturation, multi-users), le bon modèle est :

| Couche | Techno | Rôle |
|--------|--------|------|
| **Données** | PostgreSQL + Prisma | Tables / contraintes / historique |
| **Backend API** | NestJS | Règles métier, sécurité, calculs facturation |
| **Frontend** | Next.js | UI campagne, stock, dashboard |

### Ordre de mise en œuvre (celui qu’on suit)
1. **Schéma DB complet** ← *ici*
2. Seed des référentiels (marques, tarifs, couleurs…)
3. **Modules NestJS + API REST** (domaine par domaine)
4. **Next.js** branché sur les API
5. Migration des données Excel

### Pourquoi API d’abord (pas « tout le code front+back MVC d’un coup »)
- Les règles critiques (deltas compteurs, stock, clôture facture) doivent vivre **côté serveur**, testables, auditables.
- Next.js consomme l’API : pas de logique facturation dans le navigateur.
- NestJS reste « MVC » en interne (`Controller` / `Service` / `Module`) — c’est normal ; ce n’est juste pas un monolithe PHP-style sans API.
- On peut livrer module par module (Parc → Relevés → Facturation → Stock).

**Verdict :** faire **API NestJS + front Next.js**, pas un seul bloc MVC sans API. Le schéma Prisma est la fondation ; les API viennent ensuite.

---

## Tables persistantes

### Référentiels
| Table | Champs clés |
|-------|-------------|
| `Marque` | nom |
| `Fournisseur` | nom |
| `Agent` | nom |
| `Service` | nom (Direction, RH…) |
| `TarifLeasing` | type (COPIE_NB, COPIE_COULEUR, SCAN_*, ENVOI), prixUnitaire, devise |
| `IdSequenceConfig` | entité, préfixe (IMP-/ENT-/AFF-/REL-/MNT-/FAC-), dernierNumero |
| `Utilisateur` | email, rôle (ADMIN/TECHNICIEN/FACTURATION/LECTURE) |

### Parc
| Table | Champs clés |
|-------|-------------|
| `Imprimante` | code, marque, modele, **numeroSerie unique**, localisation, statut, fournisseur, service, dates, observations |

### Stock cartouches
| Table | Champs clés |
|-------|-------------|
| `ModeleCartouche` | modele (C-EXV 64), marque, refFabricant |
| `CartoucheSku` | modele + **couleur**, qteEntrees/Sorties/Restante, statut |
| `EntreeStock` | code ENT-, date, modele, couleur, qte, fournisseur |

### Affectations (kit / partiel)
| Table | Champs clés |
|-------|-------------|
| `Affectation` | code AFF-, date, imprimante, modele cartouche, agent, motif, statutPose |
| `AffectationLigne` | couleur + qte (1 à 4 lignes CMYK) |

### Relevés compteurs (cœur leasing)
| Table | Champs clés |
|-------|-------------|
| `ReleveCompteur` | code REL-, imprimante, moisFacture, date, **c112/c113/c122/c123**, c501/c301, scans/envoi, totaux + deltas snapshot, statut, observation |

### Campagne mensuelle
| Table | Champs clés |
|-------|-------------|
| `CampagneSaisie` | mois, dateReleve, cloturee |
| `LigneSaisieMensuelle` | imprimante, compteurs saisis, statutLigne (A_SAISIR/PRET/…) |

### Maintenance
| Table | Champs clés |
|-------|-------------|
| `Maintenance` | code MNT-, imprimante, type, technicien, actions, pieces, prochaineMaintenance |

### Facturation (snapshot)
| Table | Champs clés |
|-------|-------------|
| `FacturePeriode` | mois, tarifs figés, montantTotal, statut (BROUILLON→CLOTUREE) |
| `FactureLigne` | imprimante, quantités, montants, statut |

### Audit
| Table | Champs clés |
|-------|-------------|
| `AuditLog` | dateHeure, user, action, entite, details |

---

## Vues / écrans (pas de tables dédiées)
Calculés via API / requêtes :
- Dashboard KPI
- Controle Releves
- Vue mensuelle (début / fin / Δ)
- Filtre mois
- Synthèses copies / facturation / maintenances

---

## Mapping Excel → tables

| Feuille Excel | Table(s) |
|---------------|----------|
| Imprimantes | `Imprimante` |
| Stock Cartouches (dispo) | `CartoucheSku` |
| Stock Cartouches (entrées) | `EntreeStock` |
| Affectations | `Affectation` + `AffectationLigne` |
| Releves Copies | `ReleveCompteur` |
| Saisie mensuelle | `CampagneSaisie` + `LigneSaisieMensuelle` |
| Maintenance Imprimantes | `Maintenance` |
| Facturation | `FacturePeriode` + `FactureLigne` |
| Parametres | référentiels + `TarifLeasing` |
| Configuration IDs | `IdSequenceConfig` |
| Logs | `AuditLog` |
| Vue mensuelle / Filtre / Controle / Dashboard | API / requêtes |

---

## Règles métier à coder dans NestJS (pas en front)

1. Relevé : totaux = 112+113 / 122+123  
2. Delta facturable = max(0, actuel − précédent) ; 1er relevé = `BASE_INITIALE`  
3. Anomalie si compteur baisse ; doublon si même imprimante + même mois  
4. Écart contrôle = 301 − total noir  
5. Stock : entrée ↑ ; affectation ↓ par couleur  
6. Facture : snapshot tarifs + quantités à la clôture  
7. Génération codes IMP-/ENT-/AFF-/REL-/MNT-/FAC-

---

## Prochaines étapes
1. Configurer `DATABASE_URL` dans `backend/.env`
2. `npx prisma migrate dev`
3. Seed référentiels + import Excel
4. Modules NestJS : `printers` → `readings` → `billing` → `stock` → `assignments`
5. Next.js consomme les API
