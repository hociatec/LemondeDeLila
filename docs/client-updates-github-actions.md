# Client Windows – publication automatique (GitHub Actions)

Cette repo publie le client Windows à chaque push sur `main` via `.github/workflows/client-win-auto-update.yml`.

## Secrets GitHub requis

Dans le repo GitHub → Settings → Secrets and variables → Actions, définir :

- `LILA_API_BASE` : URL de l’API (ex: `https://api.lilas.hociatec.fr/api/`)
- `LILA_UPLOAD_TOKEN` : token upload CI (header `x-client-updates-upload-token`)
  - côté serveur : définir `CLIENT_UPDATES_UPLOAD_TOKEN` avec la même valeur
- `LILA_UPDATES_BASEURL` : (optionnel) URL publique des updates ClickOnce (ex: `https://api.lilas.hociatec.fr/updates/client-win/`)
  - si absent, le workflow utilise `https://api.lilas.hociatec.fr/updates/client-win/`

Signature ClickOnce (signature des manifestes) :
- `CODESIGN_PFX_BASE64` : contenu du `.pfx` encodé en base64
- `CODESIGN_PFX_PASSWORD` : mot de passe du `.pfx`
- `CODESIGN_TIMESTAMP_URL` : (optionnel) serveur timestamp, défaut `http://timestamp.digicert.com`

## Versioning

Le workflow calcule une version monotone : `MAJOR.MINOR.<github.run_number>` à partir de `client-win/client-win/client-win.csproj`.
La mise à jour est forcée en définissant `minRequiredVersion = version` lors de l’upload.

## Notes

- Le workflow tourne sur `windows-latest` car la publication ClickOnce n’est supportée que sous Windows.
- Le serveur sert les fichiers ClickOnce via `https://api.lilas.hociatec.fr/updates/client-win/` (page `index.html` + `.application`).
