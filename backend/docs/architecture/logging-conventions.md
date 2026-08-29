# Conventions de journalisation backend

Les logs sont des événements d'exploitation, pas une copie des requêtes ni de
l'état métier. Le logger racine applique une dernière redaction aux messages et
aux traces sérialisées. Les loggers spécialisés doivent en plus passer leurs
contextes structurés par `sanitizeLogValue`.

## Structure

Un événement structuré utilise un identifiant stable `event` en notation
pointée, puis uniquement les identifiants utiles au diagnostic : `requestId`,
`commandId`, `roomId`, `userId`, `gameType`, version, durée et code d'erreur.
Le même `requestId` ou `commandId` est conservé entre réception, traitement et
persistance. Les textes libres ne servent qu'à décrire une erreur externe déjà
nettoyée.

## Niveaux

- `error` : opération abandonnée ou invariant rompu nécessitant une action ;
- `warn` : dégradation récupérée, refus attendu notable ou dépendance différée ;
- `log/info` : transition de cycle de vie ou résultat d'une commande ;
- `debug` : détails techniques désactivables en production ;
- `verbose` : diagnostic local exceptionnel.

## Données interdites

Ne jamais journaliser mot de passe, token, cookie, en-tête Authorization,
secret, corps/payload complet, contenu de message privé, données privées d'un
joueur ou état de partie complet. Les erreurs doivent être réduites à leur nom,
code et message nettoyé. `sanitizeLogText` protège les chaînes déjà sérialisées
et `sanitizeLogValue` clone puis masque récursivement les champs sensibles.
