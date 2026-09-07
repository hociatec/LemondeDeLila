## Maintenance deploy local (systemd)

Le déploiement est maintenant assuré par `updatecmd`, sans `git pull` et sans
workflow GitHub. L'installation complète est documentée dans
`tools/updatecmd/README.md` et se fait avec :

```bash
sudo ./updatecmd bootstrap
sudo updatecmd doctor
sudo updatecmd backend
```

Pour conserver le déclenchement depuis l'API d'administration, autoriser
l'utilisateur du backend à démarrer `lila-backend-deploy.service` avec le
fichier sudoers minimal fourni :

- Adapter `backend/tools/systemd/lila-backend-maintenance.sudoers`
- Installer le fichier dans `/etc/sudoers.d/` (via `visudo -cf`)

Activer ensuite le garde-fou de maintenance côté backend :

- Copier `backend/tools/systemd/lila-backend.service.d/10-maintenance.conf` vers `/etc/systemd/system/lila-backend.service.d/10-maintenance.conf`
- Mettre `ADMIN_MAINTENANCE_TOKEN=...` (et optionnel `ADMIN_MAINTENANCE_ALLOWED_IPS=...`)
- Puis:

```bash
sudo systemctl daemon-reload
sudo systemctl restart lila-backend.service
```

### API (résumé)

- `POST /api/admin/maintenance/deploy` (JWT admin + header `x-admin-maintenance-token`)
- `GET /api/admin/maintenance/deploy/status`
- `GET /api/admin/maintenance/deploy/logs?tail=200`
