# Patterns, cycles, caches et livraisons différées

Troisième passe sur les 100 premières exigences ouvertes (14 à 275, numérotation
discontinue). Quatorze clôtures : 136–140, 170–171, 192–193, 261, 263, 273–275.
Les autres exigences restent ouvertes ; cette passe ne clôture pas 100 points.

## Capacités du contexte : 136–140

`GamePattern` conserve les types des composants et des mécaniques. Toutes les
fabriques standard déclarent les composants qu'elles installent, y compris les
patterns de manches qui n'en installent aucun. Leur composition dans
`defineGame<State>()` n'élargit plus les composants à tous les kits possibles.

`GameContextFor<typeof game>` expose les capacités optionnelles déduites de ces
composants compilés. Une piste n'acquiert pas de cartes, un jeu de cartes n'acquiert
pas de mouvement et un ensemble de pions n'est pas assimilé à une piste.
Le vote est exposé lorsque les patterns déclarent la mécanique `voting`.
Les capacités communes du moteur restent disponibles.

Les tests de compilation vérifient les accès autorisés et interdits avec les
véritables fabriques race, pawnRace, quizRace, gridGame, marketGame, cardGame,
roundScoring, simultaneousAnswers et submissionJudgeGame. Les assertions runtime
comparent les composants effectivement compilés.

Les callbacks génériques reçoivent encore `GameContext` : 133 et 135 restent
ouverts. Une annotation volontairement large (`GamePattern<State>` ou ancienne
surcharge directe `defineGame<State>(...)`) perd les informations de capacités ;
la forme précise documentée est `defineGame<State>()({...})`, utilisée par les
38 jeux. Cette restriction TypeScript ne constitue pas un bac à sable runtime.

## Suppression des cycles : 170–171 et 192–193

L'auditeur excluait le câblage des modules de son graphe de cycles. Il inclut
désormais les imports de composition appartenant à un bounded context. Un test
avec Room et Bot dépendant l'un de l'autre exclusivement depuis leur câblage
vérifie que le cycle est détecté.

Ce contrôle a révélé le SCC `catalog / game / room / stats`. `GameWsModule`
importait Room pour obtenir ses ports. `AppGameRoomPortsModule` relie maintenant
`ROOM_GAME_PORT` et `ROOM_EVENTS_PORT` aux ports consommateurs du moteur, à la
racine. Room n'enregistre plus les tokens du moteur et GameWsModule n'importe
plus Room. Les adaptateurs sont partagés par identité, sans nouvelle instance.
Le test Nest vérifie leur injection, la lecture de salle et le branchement des
événements. Les forwardRef Room→Bot et Room→Presence devenus inutiles sont retirés.

Le graphe renforcé passe sans cycle ni baseline (68 arêtes au moment de la revue),
y compris le groupe initial bot/vault/room/presence. Les workflows transversaux
et dépendances ORM subsistent : absence de cycle ne signifie pas autonomie
complète de chaque domaine. Les points 172–174, 191 et 198–217 restent ouverts.

## Contrats d'invalidation : 261 et 263

| Cache | Source et durée | Invalidation et limites |
| --- | --- | --- |
| Catalogue présenté | Registre de jeux, `GAME_CATALOG_CACHE_TTL_MS`, défaut 30 s, zéro conserve jusqu'à invalidation | AdminCatalogInvalidationService vide le cache du registre et celui du catalogue, puis notifie les clients. Lecture et écriture du catalogue copient les entrées et leurs catégories. |
| Manifestes du registre | Manifeste chargé par le registre, cache local sans TTL | `GameRegistryService.invalidateCache()` ; les overrides sont rechargés après leurs écritures. Les caches des autres processus ne sont pas vidés par cet appel local. |
| Noms de bots | Repository des noms, `BOT_NAMES_CACHE_TTL_MS`, défaut 30 s, zéro conserve jusqu'à invalidation | Création, modification et suppression invalident après succès de la persistance. Les listes stockées et rendues sont copiées ; le mélange ne modifie pas le cache. |
| Manifeste de mise à jour WX | Fichier de métadonnées validé, cache local de 5 s | Publication/rollback mettent à jour le cache local. Les autres instances relisent à expiration ; une erreur de lecture conserve le dernier manifeste connu et réessaie après 5 s. |

Catalogue et noms de bots portent désormais une révision d'invalidation. Une
lecture commencée avant l'invalidation peut terminer pour son appelant, mais
elle ne peut plus remplir le cache ni écraser une valeur chargée après
l'invalidation. Les tests reproduisent précisément cette course.

L'expiration de ces deux caches utilise `BusinessClock`, fourni par le module
technique `platform/time`, également utilisé par Presence. Les tests contrôlent
la limite exacte du TTL sans attente réelle.

Les noms et le catalogue présenté sont des optimisations locales ; leurs copies
ne remplacent pas les données persistées. En revanche, les overrides de catalogue
et la dernière politique de mise à jour connue influencent des décisions : ils
ne doivent pas être supprimés comme de simples données d'optimisation. La
cohérence globale des caches, les notifications/badges, les TTL des autres
services et leurs horloges restent à traiter (249, 252–264 hors 261 et 263).

## Audit BullMQ et idempotence : 273–275

Un seul Worker métier est instancié en production : `game-engine-tasks`, dans
`BullmqGameTaskSchedulerService`. Le module health lit les compteurs de la queue ;
il n'exécute pas de job métier.

L'identité d'une tâche comprend maintenant `roomRunId`. Le worker contrôle la
partie, la génération et la signature avant toute exécution. Une livraison d'une
ancienne partie ou un job historique sans run ne peut pas agir sur une partie
dont le run est connu, même avec la même version et la même signature. Il est
remplacé par une planification issue de l'état courant.

La clé BullMQ hache l'identité complète (clé logique, salle, type exact de jeu,
run, génération, signature). La normalisation des noms de jeux ne peut plus
fusionner deux identités distinctes. Le commandId applicatif inclut aussi le run.
Les anciens jobs peuvent coexister avec les nouvelles clés pendant la transition ;
les contrôles de run/génération et le CAS protègent le commit métier.

Deux livraisons concurrentes ne peuvent valider qu'une transition. Si la diffusion
échoue après le commit, une nouvelle livraison recharge l'état de génération
suivante et ne rejoue pas la mutation. Le test vérifie un seul appel de commit
et la replanification de la génération suivante. La diffusion elle-même n'a pas
une garantie exactement-une-fois ; le client retrouve l'état par resynchronisation.

Politique de reprise : cinq tentatives au total, backoff exponentiel de base
500 ms, suppression des jobs réussis et conservation des échecs terminaux dans
`failed`. L'événement `game.task.dead-letter` et les métriques identifient ces
échecs. `failed` sert de réserve de reprise ; aucune queue DLQ supplémentaire
n'est créée. Une reprise opérationnelle doit conserver l'identité du job et
ne pas altérer la version ou le run pour forcer une ancienne commande.

## Vérifications

198 suites, 720 tests réussis ; typecheck, build et chargement de l'AppModule
réussis. Les audits d'architecture, de structure et de qualité restent sans
augmentation de budgets. L'audit des cycles compte maintenant le câblage.
Redis local n'était pas disponible : le test d'intégration avec de vrais workers
Redis/BullMQ n'a pas été exécuté dans cette passe. Les tests de livraison et de
commit cités ici sont les tests applicatifs, pas une simulation présentée comme
un test réseau réel.
