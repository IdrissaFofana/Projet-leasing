#!/usr/bin/env bash
# Fragment à appeler en FIN de /usr/local/bin/backup-leasing-postgresql.sh
# Ne remplace pas le script existant — à intégrer (source ou appel).
#
# Usage (depuis le script principal, après dump + rclone + vérifs) :
#   export BACKUP_STATUS=SUCCESS|FAILED
#   export BACKUP_TYPE=DAILY|WEEKLY|MONTHLY|MANUAL   # ou laisser auto
#   export BACKUP_FILENAME="leasing_....dump"
#   export BACKUP_SIZE=91081
#   export BACKUP_DESTINATION="Onedrive:Sauvegardes-Leasing/daily"
#   export BACKUP_ERROR_MESSAGE=""   # si FAILED
#   export BACKUP_STARTED_AT="2026-08-31T10:00:00.000Z"
#   /usr/local/bin/leasing-backup-report.sh
#
# Le backend lit /var/lib/leasing-backup/results/*.json (pas d'HTTP).

set -euo pipefail

RESULTS_DIR="${BACKUP_RESULTS_DIR:-/var/lib/leasing-backup/results}"
PENDING_FILE="${BACKUP_PENDING_FILE:-/var/lib/leasing-backup/pending.json}"

mkdir -p "$RESULTS_DIR"

export BACKUP_STATUS="${BACKUP_STATUS:-FAILED}"
export BACKUP_TYPE="${BACKUP_TYPE:-}"
export BACKUP_FILENAME="${BACKUP_FILENAME:-}"
export BACKUP_SIZE="${BACKUP_SIZE:-0}"
export BACKUP_DESTINATION="${BACKUP_DESTINATION:-}"
export BACKUP_ERROR_MESSAGE="${BACKUP_ERROR_MESSAGE:-}"
export BACKUP_STARTED_AT="${BACKUP_STARTED_AT:-$(date -u +"%Y-%m-%dT%H:%M:%S.000Z")}"
export BACKUP_COMPLETED_AT="$(date -u +"%Y-%m-%dT%H:%M:%S.000Z")"
export BACKUP_ID=""
export BACKUP_RESULT_KEY="res-$(date -u +%Y%m%d%H%M%S)-$$-${RANDOM}"

if [[ -f "$PENDING_FILE" ]]; then
  export BACKUP_ID="$(python3 -c "import json; print(json.load(open('$PENDING_FILE')).get('backupId') or '')" 2>/dev/null || true)"
  PENDING_TYPE="$(python3 -c "import json; print(json.load(open('$PENDING_FILE')).get('type') or '')" 2>/dev/null || true)"
  if [[ -z "$BACKUP_TYPE" && -n "$PENDING_TYPE" ]]; then
    export BACKUP_TYPE="$PENDING_TYPE"
  fi
fi

if [[ -z "$BACKUP_TYPE" ]]; then
  DOW="$(date -u +%u)"
  DOM="$(date -u +%d)"
  if [[ "$DOM" == "01" ]]; then
    export BACKUP_TYPE="MONTHLY"
  elif [[ "$DOW" == "7" ]]; then
    export BACKUP_TYPE="WEEKLY"
  else
    export BACKUP_TYPE="DAILY"
  fi
fi

export BACKUP_OUT_FILE="${RESULTS_DIR}/${BACKUP_RESULT_KEY}.json"

python3 <<'PY'
import json, os
payload = {
  "schemaVersion": 1,
  "resultKey": os.environ["BACKUP_RESULT_KEY"],
  "backupId": os.environ.get("BACKUP_ID") or None,
  "status": os.environ["BACKUP_STATUS"],
  "type": os.environ["BACKUP_TYPE"],
  "startedAt": os.environ["BACKUP_STARTED_AT"],
  "completedAt": os.environ["BACKUP_COMPLETED_AT"],
  "filename": os.environ.get("BACKUP_FILENAME") or None,
  "size": int(os.environ.get("BACKUP_SIZE") or 0),
  "destination": os.environ.get("BACKUP_DESTINATION") or None,
  "errorMessage": os.environ.get("BACKUP_ERROR_MESSAGE") or None,
}
path = os.environ["BACKUP_OUT_FILE"]
with open(path, "w", encoding="utf-8") as f:
    json.dump(payload, f, ensure_ascii=False, indent=2)
print("Wrote", path)
PY

if [[ -f "$PENDING_FILE" ]]; then
  rm -f "$PENDING_FILE" || true
fi
