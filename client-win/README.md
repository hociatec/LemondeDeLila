# Client Windows — Configuration

Le client lit un fichier `config/client.properties` (ou `config/client.properties.example`) placé à côté de l’exécutable.

En mode dev, si aucun fichier n’existe, un template est copié dans :

- Windows : `%LOCALAPPDATA%\\LeMondeDeLila\\config\\client.properties`

## Connexion à un backend distant (production)

Éditez `config/client.properties` et pointez vers votre serveur :

- `network.http.base` (HTTP/HTTPS) — ex: `https://api.lilas.hociatec.fr/api/`
- `network.ws.url` (WS/WSS) — ex: `wss://ws.lilas.hociatec.fr/ws`
- `network.ws.api` — ex: `wss://ws.lilas.hociatec.fr/ws/api`
- `network.ws.game` — ex: `wss://ws.lilas.hociatec.fr/ws/game`
- `network.ws.notify` — ex: `wss://ws.lilas.hociatec.fr/ws/notify`
- `network.ws.presence` — ex: `wss://ws.lilas.hociatec.fr/presence` (le client ajoute `?context=chat`)

Le secret `network.ws.secret` doit correspondre au backend (`WS_SHARED_SECRET`).

## Mises à jour sans redistribuer aux testeurs

Objectif : les testeurs installent une seule fois, puis l'appli peut (1) vérifier (2) installer une mise à jour depuis l'écran **Options > Mises à jour**, sans re-téléchargement manuel.

La solution recommandée ici est **ClickOnce** :

1. Choisir un dossier de publication unique et stable (ex: partage réseau `\\\\SERVEUR\\partage\\lila-client-win\\` ou dossier synchronisé sur un serveur HTTP).
   - Si vous publiez derrière une URL HTTPS, il faut que cette URL pointe vers ce dossier (ex: `https://api.lilas.hociatec.fr/updates/client-win/` -> dossier `PublishDir`).
2. Publier (build + génération ClickOnce) avec le script :
   - Partage réseau : `powershell -ExecutionPolicy Bypass -File .\\publish-clickonce.ps1 -PublishDir "\\\\SERVEUR\\partage\\lila-client-win"`
   - HTTPS : `powershell -ExecutionPolicy Bypass -File .\\publish-clickonce.ps1 -PublishDir "C:\\inetpub\\wwwroot\\updates\\client-win" -BaseUrl "https://api.lilas.hociatec.fr/updates/client-win/"`
3. Installer côté testeur : exécuter `setup.exe` depuis le dossier de publication (une seule fois).
4. Ensuite, dans le client : **Options > Mises à jour** permet de vérifier et installer la mise à jour.
5. (Optionnel) Pour pousser la proposition à tout le monde : Administration → "Message global / Mises à jour" → "Proposer une mise à jour client".

Notes :
- En mode dev (`dotnet run` / exécutable copié), les mises à jour ClickOnce sont désactivées (le bouton indique que ClickOnce est requis).
- En ClickOnce, les mises à jour sont gérées par ClickOnce au démarrage (si une nouvelle version est publiée, elle est appliquée au lancement suivant).
- Pour une distribution "propre" hors test, il est recommandé d'activer la signature ClickOnce (certificat) dans `client-win/client-win/Properties/PublishProfiles/ClickOnce.pubxml`.

## Gestion 100% depuis l'administration (PC Windows admin)

Le client (compte admin) propose maintenant :
- **Compiler + uploader la mise à jour (admin)** : compile le client WPF en ClickOnce sur le PC Windows, zipe la publication, et upload vers le backend (`POST /api/admin/client-updates/upload`).
- **Proposer une mise à jour client** : notifie tous les clients connectés pour leur proposer d'installer.

Pré-requis :
- Le repo source doit être présent sur le PC Windows admin (ou définir `LILA_CLIENT_PROJECT` vers `client-win.csproj`).
- Définir côté serveur Linux :
  - (optionnel) `CLIENT_UPDATES_DIR` = dossier où extraire la publication ClickOnce. Par défaut: `backend/data/client-updates/client-win` (créé automatiquement).
  - (optionnel) `CLIENT_UPDATES_PUBLIC_URL` = URL publique (ex: `https://api.lilas.hociatec.fr/updates/client-win/`)
- Sur le PC Windows admin (si l'URL change) : `LILA_CLICKONCE_BASEURL` = URL ClickOnce (ex: `https://api.lilas.hociatec.fr/updates/client-win/`).
