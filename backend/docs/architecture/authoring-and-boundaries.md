# Guide auteur et frontières

Propriétaire : équipe backend. Revue : 2026-09-08.

## Direction des imports

| Source | Cibles | Responsabilité |
| --- | --- | --- |
| jeu concret | SDK auteur et fichiers locaux | contenu, règles particulières et composition |
| engine/sdk | exports explicites des capacités runtime | contrat auteur versionné, sans API de test |
| engine/runtime | capacités déterministes et contrats moteur autorisés | règles génériques, état des kits et projections |
| game/core | ports, runtime, adapters propres | orchestration des commandes et stockage durable |
| domain | domaine local et primitives pures | invariants sans Nest, TypeORM ni I/O |
| application | domaine, ports et contrats publics autorisés | use-cases ; aucun repository concret |
| infrastructure | application/domain et API techniques | HTTP/WS, TypeORM, Redis, filesystem |
| composition racine | modules et implémentations des ports | assemblage des implémentations |
| shared | aucune autre frontière | primitives universelles ; aucune nouvelle capacité métier |

La matrice exhaustive des arêtes permises est
[`architecture-contract.json`](../../tools/architecture-contract.json), notamment
`dependencies.allowed` et `dependencies.forbidden`. Ne pas en recopier une liste
manuelle : `architecture:check` analyse les imports, les cycles et les couches.
Le scan des manifestes catalogue existe encore dans l'adapter filesystem de core ;
le point 620 reste ouvert. La découverte des définitions est sous composition.

Les owners conceptuels des données sont dans [table-ownership](table-ownership.md),
ceux des modules dans [module-boundary-review](module-boundary-review.md).
L'ownership technique ne transfère pas la responsabilité métier : Redis ne
possède pas les règles de room et TypeORM ne définit pas les contrats de user.
Les helpers d'auth restent dans user/auth/ws, ceux de room dans room et ceux de
mécaniques de jeu dans le moteur. Aucun dossier shared/services, shared/entities
ou shared/repositories n'est autorisé. Les utilitaires techniques historiques
encore dans shared sont une dette connue (453/459), pas un précédent autorisant
de nouveaux ajouts.

## Créer un jeu

Utiliser `npm run create:game -- --help`, puis le générateur
[`create-game.cjs`](../../commands/create-game.cjs). Il crée les fichiers standards
et passe par les modèles de `tools/game-template`. Le registre est généré avec
`npm run game:registry` et contrôlé au build. Ne pas éditer ce registre à la main.

`content.ts` fournit les données statiques versionnées et validées ; `rules.ts`
ne contient que les décisions particulières ; `game.ts` assemble la définition,
les composants, les actions et les projections. Types et identifiants ne doivent
pas importer les règles. Une donnée UX ne sert jamais de programme exécutable.
Le protocole de chargement auteur unique reste une migration globale ouverte
(14/15) : suivre les exemples du générateur et le contrat de contenu courant,
sans ajouter une lecture physique de JSON dans un jeu.

Le kit possède ses decks, mains, dés, positions, scores et tours. Le jeu conserve
uniquement les extensions spécifiques sous son état propre et accède aux kits
par leurs contrôleurs. Une projection est calculée à la lecture ; la persister
exige une raison métier explicite. L'application possède la version de session,
le verrou de room et le commit ; le transport ne possède aucune de ces mutations.

Une correction est rétrocompatible seulement si les mêmes commandes/seed/horloge
produisent le même état et si le format persistant reste interprétable. Modifier
un effet, une transition, l'ordre aléatoire ou un invariant de règle est une
modification de règles, même appelée « bugfix » : réviser rulesVersion et prévoir
la stratégie de restauration. Le chargeur refuse les versions incompatibles ;
l'outil général de migration des parties en cours reste un point ouvert (718).

## Extraire une mécanique et ajouter un kit

Comparer les invariants, l'état, les transitions et la visibilité de deux usages
réels avant de créer une abstraction moteur. Deux blocs ressemblants ne suffisent
pas. Conserver une règle spécifique si les comportements divergent ; un troisième
usage équivalent consolide la généralisation. Consigner les usages dans la PR.

| Choix | Quand l'utiliser |
| --- | --- |
| rule | décision propre à un jeu, sans état générique nouveau |
| effect | mutation déclarative atomique disponible dans les capacités moteur |
| recipe | séquence réutilisable d'opérations de capacités existantes |
| pattern | composition récurrente de phases/actions/règles et composants |
| kit | mécanique générique avec invariants, état et contrôleur propres |

Pour un kit : définir ses contrats et son état sérialisable dans runtime ; fournir
la factory d'initialisation, les mutations validées et la projection de visibilité ;
raccorder compilation/validation, factory d'état et projection de kits ; exposer
uniquement la façade auteur nécessaire dans SDK ; migrer les usages démontrés et
retirer leur mécanique/état local redondant. Revoir les versions si le format
persisté change. Tester déterminisme, sauvegarde/restauration, limites et secrets
visibles aux différents joueurs. Le hash de surface SDK doit faire l'objet d'une
revue explicite si des exports changent.

## Definition of Done d'un nouveau jeu

Ces conditions sont obligatoires pour les nouveaux jeux ; elles ne déclarent pas
conformes les jeux historiques dont l'ownership reste dans le backlog.

- SDK et imports locaux seulement ; ni I/O, ni horloge système, ni RNG local.
- Une seule source d'état par kit ; aucun état générique miroir dans le jeu.
- Contenu validé/versionné, références vérifiées avant usage, rejet explicite
  des snapshots incompatibles.
- Réutilisation des capacités existantes ; toute nouvelle abstraction moteur
  justifie au moins deux usages équivalents.
- Règles lisibles comme décisions métier ; un jeu sans mécanique nouvelle
  utilise `manifest.json`, `game.json` et ses contenus JSON. Une extension
  TypeScript passe exclusivement par le SDK et doit justifier le manque du DSL.
- Tests de contrat, typecheck, lint, build, vérification du dist et quality:check.

Le compilateur, le générateur et les audits vérifient la structure, les imports,
les cycles, les définitions et la surface SDK. L'équivalence sémantique, l'ownership
et la lisibilité demandent aussi une revue humaine ; un audit vert ne les prouve
pas à lui seul.

## Definition of Done d'une nouvelle primitive moteur

- Décrire la mécanique et ses usages réels équivalents ; plusieurs usages sont
  requis lorsqu'il s'agit d'une composition, ou justifier son caractère fondamental.
- Faire évoluer ensemble l'union discriminée, le schéma JSON fermé, les références
  et capabilities, le compilateur et l'exécuteur. Aucun callback dans le JSON.
- Étendre les tables exhaustives de `json-capabilities.spec.ts` et les tests de
  compilation/rejet, d'exécution, de visibilité et de sauvegarde/restauration.
- Valider toutes les destinations et quantités avant une mutation composée ;
  tester l'absence de mutation et d'événement lors d'un refus.
- Conserver l'horloge/RNG injectés et des ordres/départages explicites. Comparer
  les traces des usages migrés ; réviser les versions si leur comportement change.
- Documenter la syntaxe auteur, revoir le contrat SDK et exécuter typage, lint,
  tests, build et chaîne qualité sans relever les seuils ni masquer de dette.

Le suivi `game:metrics` distingue désormais les lignes TypeScript et JSON des
fichiers auteur. `jsonOnly` signifie présence de `game.json` et absence de
TypeScript auteur, hors tests. La réapparition de TypeScript dans un tel jeu
fait échouer le contrôle ; toute croissance des règles spécifiques est signalée.
Le ratio historique fondé sur les noms de fichiers reste un indicateur de revue,
jamais une preuve de migration complète.

## Definition of Done d'un nouveau module

- Déclarer l'owner de chaque table et les arêtes autorisées dans le contrat.
- Exposer le minimum de contrats publics effectivement consommés ; aucun import
  d'infrastructure ou d'entité d'un autre module, même via une réexportation.
- Aucun cycle ; domaine indépendant de Nest/TypeORM ; application dépendant de
  ports dont l'infrastructure fournit les implémentations.
- Module Nest limité au wiring ; DTO externes distincts des entités avec champs
  projetés explicitement, validation et autorisation de ressource.
- Documenter les décisions difficiles par ADR, avec les mêmes contrôles que la
  [Definition of Done backend](backend-definition-of-done.md).

La présence d'anciennes entités partagées ne rend pas cette pratique acceptable
pour un nouveau module ; les points 198–217 et 502 restent suivis séparément.

## Taille, noms et abstractions

La revue [runtime-cohesion-review](runtime-cohesion-review.md) justifie les classes
cohésives et les grandes tables déclaratives conservées. Les seuils canoniques
sont dans les outils de structure ; ne pas scinder ni renommer pour diminuer une
métrique. Un nom est corrigé lorsqu'il cache l'owner ou plusieurs raisons de changer.
`Repository` exprime la persistence métier, `Reader` une projection et `Presenter`
un mapping. Les résultats de commandes utilisent une union discriminée lorsque
les variantes ont des données différentes (ex. PresenceChatCommandResult).

Un CRUD simple peut mapper directement un record applicatif sans fabriquer une
seconde hiérarchie d'entités. Les invariants de credentials et de bannissement
restent des fonctions de domaine ; on ne crée pas une classe value object sans
invariant. Une interface avec une seule implémentation reste utile pour isoler
MySQL, Redis, le filesystem ou l'horloge. Évaluer le changement protégé, pas le
nombre d'implémentations. Une façade purement redondante doit disparaître ; cette
règle n'atteste pas que tous les wrappers historiques ont déjà été supprimés.

Le registre temporaire est `a corriger..txt`. Les comptes rendus sous docs/quality
conservent les numéros retirés et leurs preuves. Le point 722 reste ouvert tant
que toutes les dettes n'ont pas une fiche individuelle owner/raison/cible/état.
