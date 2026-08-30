# Revue de cohésion des fichiers runtime et Room

Statut : validé le 2026-08-30.

Cette revue ne traite pas le nombre de lignes comme une responsabilité. Les seuils
automatiques restent bloquants à 500 lignes par fichier et 80 lignes par méthode.
Une extraction n'est retenue que lorsqu'elle produit une frontière testable et
réutilisable, sans déplacer des invariants entre plusieurs fichiers.

| Fichier | Responsabilité vérifiée | Décision |
|---|---|---|
| `runtime/game-rule-context.ts` | composition des capacités disponibles pendant une règle | conserver comme façade de composition : chaque getter délègue à un contrôleur spécialisé et aucun état métier parallèle n'y est stocké |
| `definitions/game-definition-contracts.ts` | contrat statique complet d'une définition compilée | conserver groupé : séparer actions, définition et état créerait des imports circulaires autour de `GameContext` et `DeclarativeState` |
| `runtime/public-api.ts` | manifeste explicite des exports internes autorisés | conserver explicite : le nombre de lignes ne mesure pas la surface, verrouillée par le test du hash des exports SDK |
| `kits/pawn-kit.ts` | définition, état et contrôleur atomique des pions | conserver groupé ; aucune seconde source d'état |
| `projection/game-kit-view.ts` | projection publique de tous les kits optionnels | conserver comme frontière unique contre les fuites d'état |
| `projection/declarative-game-queries.ts` | catalogue paginé des actions et choix légaux | conserver groupé ; parsing et exécution restent dans leurs contrôleurs respectifs |
| `state/game-session-contracts.ts` | validation récursive d'une session persistée | conserver groupé afin qu'un seul validateur porte tous les invariants de snapshot |
| `cards/cards-hands-controller.ts` | mutations cohérentes main/table/zones d'un même agrégat cartes | conserver groupé ; deck et projection sont déjà isolés |
| `content/game-content.ts` | validation, gel et version stable du contenu statique | conserver groupé pour garantir une boundary unique |
| `kits/quiz-kit.ts` | cycle de vie atomique d'une session de quiz | conserver groupé ; le catalogue statique est déjà délégué à `quizContent` |
| `room-gateway-state.service.ts` | lecture/projection WS et resynchronisation | présentation uniquement ; aucune mutation métier |
| `room-gateway-command.service.ts` | validation d'enveloppe, auth et délégation des commandes | orchestration de transport uniquement ; mutations déléguées aux services applicatifs |
| `sounds/infrastructure/storage/sounds.service.ts` | façade de stockage audio, manifeste et délégation des opérations | conserver comme façade : upload, maintenance et ambiances sont déjà isolés dans trois managers ; le service ne réimplémente pas leurs workflows |

Toute croissance au-delà des seuils de structure, toute dépendance métier ajoutée
aux services Room ou toute deuxième source d'état invalide cette revue et doit
entraîner une extraction ciblée.
