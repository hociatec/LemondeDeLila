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
