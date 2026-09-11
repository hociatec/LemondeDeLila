# Clôture des règles d'architecture restantes — 10 septembre 2026

Les règles 509–519, 526, 692 et 744 sont auditées par
`npm run architecture:debt-final`, intégré à `quality:check`.

| Point | Traitement et preuve |
| --- | --- |
| 509 | Les audits qualité, structurels et d'architecture contrôlent les fichiers applicatifs ; aucun code mort identifié dans les chemins de production. |
| 510 | `sdk:contract`, l'audit d'architecture et la compilation TypeScript contrôlent les exports publics ; aucun export accidentel n'est conservé. |
| 511 | Les anciennes APIs applicatives ont été retirées après migration ; les contrats publics actuels n'exposent plus d'ancien chemin. |
| 512 | Aucun double chemin applicatif temporaire n'est conservé. Les seuls doubles chemins sont les migrations historiques et le graphe explicite de migration des sauvegardes. |
| 513 | Les façades et contrats runtime/SDK sont versionnés ; la compatibilité de sauvegarde est conservée uniquement pour les données persistées qui doivent encore être lues. |
| 514 | `architecture-debt-final-check` interdit les adaptateurs de compatibilité applicatifs. Les migrations historiques restent nécessaires à l'historique de base. |
| 515 | Aucun feature flag applicatif stabilisé n'est présent ; les flags de tour sont des données métier runtime, non des flags de déploiement. |
| 516 | Les sérialisations actuelles sont uniques et versionnées quand le contrat le nécessite. Les parseurs historiques ne servent qu'aux migrations de données. |
| 517 | Les abstractions courantes remplacent les précédentes dans le code applicatif ; les coexistences restantes sont limitées aux migrations et au registre de migration de contenu documenté. |
| 519 | Les responsabilités multiples ont été séparées ; les noms spécialisés utilisent `Reader`, `Policy`, `Registry`, `Presenter`, `Workflow`, `Query` ou `Command`. |
| 526 | Les options restantes sont des contrats nommés et bornés par cas d'usage (`ListGamesOptions`, `ResolvePlayerNameOptions`, options de recettes). Aucun sac extensible d'options n'est utilisé. |
| 692 | Les classes `Service` restantes coordonnent une capacité technique ou applicative ; les responsabilités métier précises portent un suffixe spécialisé. |
| 744 | Le gel est exécutable : `quality:check` lance le contrôle final, les audits d'architecture/structure et la gouvernance du backlog. Toute régression fait échouer la qualité. |

Les exceptions historiques sont intentionnelles, limitées aux migrations et
aux compatibilités de données explicitement versionnées ; elles ne constituent
pas une ancienne API applicative active.
