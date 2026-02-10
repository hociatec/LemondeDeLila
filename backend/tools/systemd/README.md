## Maintenance deploy (systemd)

Ce dossier contient les fichiers à installer **une fois** sur le serveur pour permettre au backend de déclencher un déploiement via l’API admin:

- `lila-backend-deploy.service` → `/etc/systemd/system/lila-backend-deploy.service`
- `lila-backend-deploy.sh` → `/usr/local/sbin/lila-backend-deploy.sh` (puis `chmod +x`)
- Exemple sudoers minimal: `lila-backend-maintenance.sudoers`
- Exemple de drop-in (variables d’env): `lila-backend.service.d/10-maintenance.conf`

### Installation

1) Copier les fichiers:

```bash
sudo install -m 0644 backend/tools/systemd/lila-backend-deploy.service /etc/systemd/system/lila-backend-deploy.service
sudo install -m 0755 backend/tools/systemd/lila-backend-deploy.sh /usr/local/sbin/lila-backend-deploy.sh
sudo systemctl daemon-reload
```

2) Configurer le chemin du dépôt sur le serveur:

- Éditer `/etc/systemd/system/lila-backend-deploy.service` et définir `LILA_REPO_DIR=/chemin/vers/lemondeDeLila`.

3) Autoriser l’utilisateur du service backend à déclencher le deploy sans mot de passe (sudoers):

- Adapter `backend/tools/systemd/lila-backend-maintenance.sudoers`
- Installer le fichier dans `/etc/sudoers.d/` (via `visudo -cf`)

4) Activer le garde-fou “maintenance” côté backend (drop-in):

- Copier `backend/tools/systemd/lila-backend.service.d/10-maintenance.conf` vers `/etc/systemd/system/lila-backend.service.d/10-maintenance.conf`
- Mettre `ADMIN_MAINTENANCE_TOKEN=...` (et optionnel `ADMIN_MAINTENANCE_ALLOWED_IPS=...`)
- Puis:

```bash
sudo systemctl daemon-reload
sudo systemctl restart lila-backend.service
```

### ClickOnce (ne pas casser les clients lors d'un `git pull`)

Si vous hébergez les updates ClickOnce via le backend (`/updates/client-win/`) et que votre déploiement fait un `git pull`
dans le dossier du dépôt, stocker les artifacts dans `backend/data/client-updates/` est fragile : un pull peut écraser
les fichiers publiés et empêcher les clients ClickOnce de démarrer / se mettre à jour.

Solution recommandée : configurer `CLIENT_UPDATES_DIR` vers un dossier persistant **hors du repo**.

Exemple (drop-in systemd) :

- Copier `backend/tools/systemd/lila-backend.service.d/20-client-updates.conf` vers `/etc/systemd/system/lila-backend.service.d/20-client-updates.conf`
- Adapter les chemins + l'URL publique
- Puis :

```bash
sudo systemctl daemon-reload
sudo systemctl restart lila-backend.service
```

### API (résumé)

- `POST /api/admin/maintenance/deploy` (JWT admin + header `x-admin-maintenance-token`)
- `GET /api/admin/maintenance/deploy/status`
- `GET /api/admin/maintenance/deploy/logs?tail=200`

