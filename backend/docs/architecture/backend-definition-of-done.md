# Definition of Done backend

Un changement backend est terminé lorsque les points applicables sont vérifiés:

- domaine sans dépendance Nest, TypeORM, Redis, filesystem ou WebSocket;
- use-case dépendant de ports, adapter déclaré dans le module, imports inter-modules via `public-api.ts`;
- entrée DTO strictement validée, chaînes normalisées et tailles bornées;
- autorisation testée sur la ressource (y compris ID valide appartenant à un autre utilisateur);
- collection paginée avec plafond serveur;
- transaction ou compensation explicite pour plusieurs agrégats;
- clé d'idempotence pour une écriture externe rejouable;
- timeout/retry/dégradation documentés pour toute dépendance;
- opération best-effort nommée et échec journalisé sans donnée sensible;
- timer/listener/Map possédé et nettoyé au shutdown ou à la déconnexion;
- migration testable en montée et, si elle transforme des données, avec fixture antérieure;
- tests unitaires des limites et intégration DB pour les invariants SQL;
- lint, typecheck, architecture, structure, tests et build verts.

Les seuils structurels signalent les fichiers >500 lignes, méthodes >80 lignes, classes >500 lignes, plus de 20 méthodes ou plus de 8 dépendances. Une exception doit être documentée; aucun nouveau dépassement n'est accepté. Les recettes du moteur sont rangées par famille fonctionnelle et les extensions de jeu restent locales lorsque leur généralisation n'améliore pas au moins deux usages.

