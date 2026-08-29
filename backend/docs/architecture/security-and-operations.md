# Sécurité et exploitation

## Entrées et erreurs

HTTP et WebSocket utilisent whitelist stricte et rejet des propriétés inconnues. L'enveloppe WS limite taille, type et identifiant de requête, puis applique une limite par connexion. Les collections croissantes ont une limite serveur; aucune limite fournie par le client ne peut dépasser le plafond du use-case.

Une erreur n'est publique que si elle est déclarée comme erreur métier présentable ou si elle est une erreur HTTP 4xx. SQL, chemins, stacks, tokens et erreurs 5xx sont remplacés par un message générique. Les logs structurés peuvent contenir IDs techniques, versions, durées et codes, jamais mots de passe, tokens, messages privés ni payloads secrets.

## Authentification

- mots de passe de 12 à 128 caractères;
- coût bcrypt `BCRYPT_COST` validé (10–15, défaut 12);
- email normalisé NFKC, trim et minuscules; username NFKC et trim;
- contraintes uniques DB autoritaires; `ER_DUP_ENTRY` devient un conflit public;
- refresh token rotatif et révocation du token émis si l'utilisateur n'existe plus ou est banni;
- aucun indicateur de vérification email tant qu'un vrai canal de vérification n'existe.

## Dépendances et dégradation

| Dépendance | Politique |
|---|---|
| MySQL | critique, fail closed, readiness KO |
| Redis de session en production | critique pour auth, fail closed, readiness KO |
| Redis Pub/Sub/cache | diffusion best-effort; écriture durable d'abord, relecture DB à la reconnexion |
| sons et updates | secondaire; erreur journalisée, aucune corruption de l'état métier |
| filesystem | chemins confinés, quotas/tailles, écriture temporaire + rename, nettoyage best-effort journalisé |

Les appels externes et processus administratifs ont timeout, concurrence exclusive et audit. On ne retry automatiquement que les opérations idempotentes avec backoff borné. Les publications utilisent staging puis rename afin de ne jamais rendre visible un fichier partiel.

## Cycle de vie

`SIGTERM` et `SIGINT` déclenchent les hooks Nest. Chaque propriétaire de timer, socket, listener ou client Redis implémente sa destruction. `/health/live` vérifie le processus; `/health/ready` et `/health` vérifient DB et Redis.

