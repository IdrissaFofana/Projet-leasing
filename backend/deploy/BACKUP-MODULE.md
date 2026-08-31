# Module supervision sauvegardes PostgreSQL / OneDrive
#
# Ce module NE remplace PAS systemd + backup-leasing-postgresql.sh + rclone.
# Il supervise, historise et permet un déclenchement manuel via systemctl.

## Variables d'environnement (backend)

```env
# Dossier des résultats JSON écrits par le script (pas d'HTTP)
BACKUP_RESULTS_DIR=/var/lib/leasing-backup/results
BACKUP_PENDING_FILE=/var/lib/leasing-backup/pending.json

# Commandes (sudoers restrictif requis en prod)
BACKUP_SYSTEMCTL_START=sudo -n /bin/systemctl start leasing-backup.service
BACKUP_SYSTEMCTL_IS_ACTIVE=sudo -n /bin/systemctl is-active leasing-backup.service
BACKUP_SYSTEMCTL_SHOW=sudo -n /bin/systemctl show leasing-backup.service --property=Result --value

# Polling supervision (ne remplace PAS le timer systemd)
BACKUP_INGEST_MS=30000
BACKUP_POLL_MS=2000
BACKUP_WATCH_TIMEOUT_MS=600000

# Dev local Windows / sans systemd
BACKUP_MOCK=true
```

## Déploiement Ubuntu (checklist)

1. Créer le dossier partagé (lisible/écriturable script + backend) :

```bash
sudo mkdir -p /var/lib/leasing-backup/results
sudo chown admin123:admin123 /var/lib/leasing-backup
# Ajouter le user du backend au groupe admin123 OU ACL :
# sudo setfacl -m u:NODE_USER:rwx /var/lib/leasing-backup /var/lib/leasing-backup/results
```

2. Installer le reporter :

```bash
sudo cp deploy/leasing-backup-report.sh /usr/local/bin/leasing-backup-report.sh
sudo chmod 755 /usr/local/bin/leasing-backup-report.sh
sudo chown root:root /usr/local/bin/leasing-backup-report.sh
```

3. Intégrer l'appel en fin de `/usr/local/bin/backup-leasing-postgresql.sh`
   (après succès dump + rclone + vérif taille / présence OneDrive) :

```bash
export BACKUP_STATUS=SUCCESS   # ou FAILED
export BACKUP_FILENAME="..."
export BACKUP_SIZE=...
export BACKUP_DESTINATION="Onedrive:Sauvegardes-Leasing/daily"
export BACKUP_STARTED_AT="..."
export BACKUP_ERROR_MESSAGE="" # si FAILED
/usr/local/bin/leasing-backup-report.sh
```

4. Sudoers restrictif (voir `sudoers-leasing-backup.example`).

5. Prisma migrate + redémarrer le backend.

6. Ne pas modifier : rclone.conf, timer, remote `Onedrive`.

## API

- `GET /api/backups`
- `GET /api/backups/latest`
- `GET /api/backups/:id`
- `POST /api/backups/run` (permission `backups:create`, async)

## Permissions

Module `backups` : `read` (historique) + `create` (lancer manuel).
