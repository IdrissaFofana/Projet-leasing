# Front — ESAY Suivi Leasing

Next.js App Router + TypeScript + Tailwind. API Nest : `NEXT_PUBLIC_API_URL`.

## Démarrage

```bash
# Backend
cd leasing-app/backend && npm run start:dev

# Front
cd leasing-app/front && npm run dev
```

- App : http://localhost:3000  
- Login : `admin@leasing.local` / `Admin123!`

### Accès depuis un autre PC du réseau

1. Relancer le front (`npm run dev`) après toute modif de `next.config.ts`.
2. Ouvrir `http://<IP-de-votre-PC>:3000` (ex. `http://192.168.1.52:3000`).
3. Autoriser les ports **3000** et **3001** dans le pare-feu Windows si besoin.
4. Si la page reste blanche, ajouter votre IP dans `allowedDevOrigins` (`next.config.ts`).

L’API est appelée automatiquement sur la même IP (`:3001`), pas sur `localhost` du PC distant.

## Écrans livrés

| Module | Route |
|--------|--------|
| Login ESAY | `/login` |
| Dashboard | `/` |
| Imprimantes | `/imprimantes`, `/nouveau`, `/[id]` |
| Admin référentiels / tarifs | `/admin` |
| Stock | `/stock` |
| Affectations / kit | `/affectations` |
| Relevés + vue mensuelle + contrôle | `/releves` |
| Campagnes | `/campagnes`, `/campagnes/[mois]` |
| Facturation | `/facturation` |
| Maintenance | `/maintenance` |

Charte : `src/lib/theme.ts` · Logo : `public/logo-esay.png`
