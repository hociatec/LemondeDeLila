# Relecture de l'audit moteur du 23 septembre 2026

Source conservée : `engine-followup-source-2026-09-23.md`. Les numéros se
rapportent exclusivement à cette relecture, pas à l'audit précédent.
Un point est retiré de `corriger.txt` uniquement après vérification ; son entrée
reste dans `engine-followup-register-2026-09-23.json`.

## Points 4, 5, 6, 7, 28 et 29 — frontières et contrat d'extension

- **4** : `BoardLanding`, `BoardTile` et `BoardGameProgram` résident dans
  `engine/runtime/contracts/board-landing-contract.ts`. Les recipes de plateau
  consomment le contrat neutre par la façade d'extension. Le pack réexporte les
  types depuis la façade contractuelle ; aucune recipe générique n'importe
  désormais `game-specific`.
- **5 et 6** : `sdk/author-api.ts` énumère les 78 exports existants destinés aux
  auteurs. `sdk/extension-api.ts` énumère les capacités effectivement utilisées
  par les développeurs d'extensions ; `sdk/extension-contracts.ts` expose
  uniquement les types nécessaires aux programmes compilés. Les packs et
  recipes n'importent plus les chemins internes de `engine/runtime`.
  `sdk/public-api.ts` reste compatible avec les imports auteurs existants.
- **7** : le générateur versionné `commands/generate-effect-pack-registry.cjs`
  vérifie le contenu exact avec `--check`. L'audit `engine:effects:audit`, exécuté
  par `quality:check` en CI, lance ce contrôle avant toute analyse. Les tests du
  générateur vérifient la dérive du fichier et l'introduction d'un nouveau pack.
  Sa sortie utilise désormais la façade d'extension.
- **28** : les erreurs génériques et `rejectRule`/`rejectContent` appartiennent
  à `engine/runtime/contracts/game-domain.errors.ts`. Les erreurs de table,
  concurrence applicative et administration de quiz restent dans le core et
  dérivent des erreurs du moteur. Les imports ont été migrés sans recréer les
  classes : `instanceof`, codes, détails et messages restent cohérents.
- **29** : 21 suites intégrant le compilateur de règles et le catalogue quittent
  `engine/runtime` pour `game/testing/architecture-tests/json`. Leurs assertions
  sont conservées et leurs imports recalculés. Les chemins des contrôles CI sont
  mis à jour. Les tests unitaires du runtime restent dans leur couche.

Preuves exécutées : typage TypeScript complet ; audit de séparation runtime ;
tests du générateur ; contrôle AST `extension-api-boundary.spec.cjs` sur tout le
projet et mutations d'imports type, réexports, alias et imports dynamiques.
La campagne Jest ciblée comporte **23 suites et 457 tests réussis** après les
déplacements. Les contrôles de frontières sont intégrés à `engine:boundary:audit`
et donc à la CI obligatoire. Aucun de ces retraits ne prétend démontrer à lui seul
l'indépendance de tout le moteur vis-à-vis du core : le point 30 fourni est
incomplet et reste ouvert.

## Promotions, langage et compatibilité (1–3, 8–17, 20, 23, 27)

Les 38 packs restent spécifiques. `effect-pack-promotion.cjs` exige une ADR
acceptée nommant le pack, deux documents consommateurs qui activent réellement
l'extension, une description de leurs objectifs/tours/interactions et un test
d'indépendance exécuté en CI. Les copies et seules variations numériques sont
refusées. Une primitive exige en plus un contrat neutre et deux tests distincts
d'usage autonome et de composition. Le contrôle parcourt aussi son implémentation
contre les noms de jeux et le vocabulaire interdit, pas seulement son contrat.
Il n'existe actuellement aucune promotion artificielle pour satisfaire le test.

Le rapport d'évolution distingue désormais les nouveaux packs spécifiques et
émet un avertissement CI lorsque leur croissance atteint ou dépasse celle des
nouveaux jeux. Les suppressions ne masquent pas les nouvelles identités.
`json-language-budget.spec.ts` protège la liste historique des propriétés
centrales ; toute exception exige une décision et la démonstration que la
composition existante est insuffisante. Les schémas fermés rejettent les alias
et champs inconnus. Les données métier du catalogue restent sous `extensions`.

Le compilateur réserve globalement les identifiants de document, sortie et
victoire, y compris les noms sensibles du prototype et les champs centraux.
Le test de collision de sortie entre deux packs complète ceux du document et
de la victoire. Le contrat de version des extensions est explicitement lié à
`definitionVersion` dans `docs/architecture/extension-compatibility.md` ; une
modification TypeScript ne doit jamais être considérée comme compatible sur
la seule base d'un digest JSON inchangé.

`Record<string, never>` est conservé après examen : l'état JSON persistant est
porté par les contrôleurs typés du moteur. Ajouter un état générique arbitraire
à l'assemblage de packs hétérogènes demanderait de nouvelles assertions ; aucun
cast existant ne serait supprimé. Le jeu hybride utilise cet état neutre sans
cast. Les valeurs JSON inconnues passent toujours par le codec avant les
compilateurs, validateurs de références et collecteurs de choix.

Les packs déclarent maintenant leurs capacités. Les noms inconnus, doublons,
factories non déclarées et handlers non déclarés sont refusés ; la liste est
copiée et gelée. Les contributions de plusieurs extensions ne sont plus
silencieusement écrasées : un conflit de handler, recette d'action ou propriétaire
du setup échoue avant le jeu. La victoire est sélectionnée explicitement par
`victory.kind`. Les extensions non sélectionnées doivent autoriser un objectif
indépendant. Les anciennes victoires déclenchées par effet restent possibles ;
elles ne sont pas déclarées automatiquement réutilisables (le test du second
jeu conserve notamment la limitation de `chainedTileRace`).

L'audit AST des assertions est conservé dans
`engine-followup-source-metrics-2026-09-23.json`. Les assertions de codec/parser
suivent la validation du schéma ; celles d'immutabilité restaurent les types
structurels des clones/proxies ; celle du compilateur suit la validation de la
définition assemblée. Les assertions vers des records suivent les tests de
forme ou servent à lire une propriété encore `unknown`.
Trois rétrécissements injustifiés ont été corrigés : payload de commande
converti structurellement, archive JSON contrôlée comme objet, et flags de tour
renvoyés comme `unknown`. Les flags structurés des trois consommateurs et le
flag booléen de pioche sont validés avant usage métier. Les doubles casts de
production restent interdits par ESLint, avec tests de contournement.
La métrique garde les lignes de l'audit initial pour rendre ces constats traçables.

Le changement de `flags.get<T>()` est explicitement breaking : SDK auteur 9.0.0,
migration documentée, mêmes symboles publics. Les snapshots exacts couvrent
`public-api`, `author-api`, `extension-api` et `extension-contracts`. Les nouvelles
façades d'extension débutent en 1.0.0.

## Revue de complexité (18, 19)

Mesure AST : base 1, branches, boucles, cases, catches, ternaires et opérateurs
logiques ; les callbacks sont mesurés séparément. Ce comptage est un indicateur
de revue, pas une raison de découper artificiellement les fichiers.

| Fichier | Maximum par fonction | Responsabilité examinée et décision |
| --- | ---: | --- |
| game-ws-state-messages.presenter | 31 | Routage de messages puis formatage délégué ; couche de présentation, pas runtime. Conserver le routage explicite et ses tests. |
| pawn-kit | 22 | Énumération des déplacements légaux et validation des positions ; réutilise la résolution de piste. Les branches décrivent des politiques distinctes testées. |
| declarative-game-queries | 18 | Projection des choix selon le destinataire ; préserver ensemble les restrictions de confidentialité. |
| quiz-kit | 16 | Validation des banques restaurées ; contrôles indépendants de structure dans une même frontière. |
| cards-hands-controller | 10 | Consommation atomique d'une collection ; conserve les contrôles avant mutation. |
| game-rule-context | 8 | Assemblage et délégation des capacités, sans duplication de leur logique. |
| directional-hazard-effects | 13 | Dispatch des opérations conditionnelles ; les opérations sont déjà isolées et réutilisent les contrôleurs. |
| simultaneous-quiz.recipes | 12 | Résolution simultanée, scores et passage à la question suivante ; catalogue et configuration déjà séparés. |
| battle-ties.recipes | 8 | Comparaison et résolution des égalités ; invariant du pot conservé dans le pack. |
| discard-penalty-cards.recipes | 7 | Tour, pioche et comptage ; configuration séparée, cartes/phases/roundScoring réutilisés. |
| property-economy.recipes | 5 | Composition des règles de propriété ; effets, choix et règles de paiement déjà séparés. |

Aucun découpage supplémentaire n'est justifié par la seule taille. Les barrières
d'import et l'audit des séquences structurelles empêchent ces packs de recopier
des implémentations d'autres packs ou de se substituer aux primitives.

## Erreurs et invariants testés (21, 22, 24–26)

Les chemins de compilation JSON (`definitions`, `contracts`, `content`) et les
rules ne contiennent plus de `throw new Error` brut. Le contrôle AST interdit
leur réintroduction dans ces chemins de production. Les huit occurrences
restantes du runtime concernent les bornes des schémas TypeScript construits par
le SDK, le registre statique d'événements et la limite interne d'actions. Les
entrées JSON correspondantes passent auparavant par les schémas fermés et le
validateur de définition à chemins sémantiques. Les tests de diagnostics couvrent
les champs imbriqués et le remappage vers `extensions[index].config`.

Les nouveaux tests privilégient les invariants : jeu hybride exécuté dans deux
ordres de catalogue ; mutations de preuves de promotion ; conservation et
isolation de l'inventaire/cartes/propriété ; modèle indépendant de grille ; rejet
sans mutation ; composition mouvement/coût/protection/collision et choix/score ;
transitions de phase autorisées et interdites ; replay identique.
Les graines sont fixes et affichées dans le nom du test. Le modèle existant de
mouvement/ressources/replay conserve son réducteur de préfixe fautif.

Le corpus versionné `reference-replays.spec.ts.snap` couvre les six familles
(plateau, cartes, choix, collection, course, grille). Son empreinte SHA-256 couvre
l'état initial puis chaque commande, acteur, horloge et état résultant, sur une
partie terminée ou un préfixe de 64 commandes. Les graines et jeux sont explicites.
Les états et vues rejoués sont comparés après chaque commande et restauration.
Les six snapshots ont été relus par un second passage sans actualisation ; leur
mise à jour n'est jamais automatique en CI.

## Vérification finale

- `quality:check` : réussi, y compris architecture, frontières, gouvernance,
  déclarations SDK et absence de nouvelle dette structurelle.
- Typage complet, lint et build : réussis ; `verify:app-load` charge l'AppModule
  compilé. Les derniers fichiers de test modifiés ont aussi été contrôlés.
- Campagne Jest globale : **473 suites, 3 352 tests**, dont 472 suites et
  3 351 tests réussis au premier passage final. L'unique échec était l'ancienne
  assertion exigeant le rejet global de deux programmes ; le diagnostic est
  désormais précisément `game.json.victory.kind` pour leurs objectifs couplés
  incompatibles. L'assertion vérifie maintenant également la valeur reçue et la
  raison. Reprise ciblée : **25/25 tests réussis** dans cette suite, aucun autre
  échec dans la campagne globale.
- **156 campagnes déterministes réussies**, 39 jeux × quatre graines, jusqu'à
  64 commandes par campagne, avec comparaison des états et vues après reprise.
- Les **six snapshots de référence** passent également sous **Node 24**, version
  utilisée en CI, sans réactualisation des empreintes.
- Réconciliation du backlog après retrait : **29 points fermés documentés,
  un point ouvert**. Le point 30 demeure tronqué dans la source reçue ; sa suite
  a été demandée, sans inventer sa correction attendue.
