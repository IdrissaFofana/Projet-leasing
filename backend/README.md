# Backend Leasing Imprimantes

API NestJS + Prisma + PostgreSQL pour le suivi parc / stock / relevés / facturation.

## Prérequis

- Node.js 20+
- PostgreSQL 14+
- Fichier `.env` (voir `.env.example`)

## Installation

```bash
cd leasing-app/backend
npm install
npx prisma migrate dev
npm run prisma:seed
npm run start:dev
```

- API : http://localhost:3001/api  
- Swagger : http://localhost:3001/api/docs  
- Health : http://localhost:3001/api/health  

## Comptes seed

| Email | Mot de passe | Rôle |
|-------|--------------|------|
| admin@leasing.local | Admin123! | ADMIN |
| tech@leasing.local | Tech123! | TECHNICIEN |

Auth : `POST /api/auth/login` → `{ accessToken }`.

## Scripts npm

| Commande | Rôle |
|----------|------|
| `npm run start:dev` | API en watch |
| `npm run build` / `start:prod` | Build + prod |
| `npm run prisma:migrate` | Migrations |
| `npm run prisma:seed` | Référentiels + 10 imprimantes + modèle C-EXV 64 |
| `npm run prisma:studio` | UI Prisma |
| `npm test` | Tests unitaires calculs métier |
| `npm run import:excel` | Import Excel → DB |

## Import Excel

```bash
npm run import:excel
# ou
npx ts-node scripts/import-excel.ts "C:\chemin\Gestion cartouche et imprimante.xlsx"
```

Par défaut, le script lit `Projet de suivie/Gestion cartouche et imprimante.xlsx`.

## Modules API (tags Swagger)

`auth`, `utilisateurs`, `marques`, `fournisseurs`, `agents`, `services`, `tarifs`, `sequences`, `imprimantes`, `modeles-cartouches`, `skus`, `entrees-stock`, `affectations`, `kits-cmyk`, `releves`, `vue-mensuelle`, `controle-releves`, `campagnes`, `facturation`, `maintenance`, `dashboard`, `audit`

## Règles métier côté serveur

1. Relevés : totaux 112+113 / 122+123 ; delta `max(0, actuel − précédent)` ; écart `301 − totalNoir`
2. Stock : solde recalculé uniquement via service (entrées / affectations)
3. Facture : snapshot tarifs ; clôture bloque les écritures du mois

## Stock produits (hors leasing)

Module séparé du stock cartouches CMYK (réceptions / livraisons).

```bash
npm run import:stock-produits
```

API : `/api/stock-produits` — permission module `stock_produits`.

## Structure

```
src/
  auth/ users/ referentiels/ printers/ stock/ stock-produits/
  assignments/ readings/ campaigns/ billing/
  maintenance/ dashboard/ audit/
  common/domain/calculs.ts
prisma/
scripts/import-excel.ts
scripts/import-stock-produits.ts
docs/
```
