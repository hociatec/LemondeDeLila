# Compilation, états persistés et automatisation

## Noyau et packs d'effets

`runtime/contracts` contient uniquement l'IR et les capacités stables du noyau.
Les programmes sérialisables et leurs implémentations sont placés sous
`runtime/effect-packs/<domaine>-<mécanique>/`. Chaque nom commence par l'un des
domaines `board`, `cards`, `choice`, `collection`, `race` ou `spatial`. Leur
contrat ne peut dépendre que de l'IR bas niveau. L'audit de séparation refuse un
`*-program.ts` dans les contrats centraux, un pack non générique, un domaine
incohérent ou un nom lié à un jeu plutôt qu'à une mécanique.

Chaque pack reste fermé, validé par son schéma et compilé avant l'exécution. Pour
toute nouvelle règle, l'ordre de préférence est : effet existant, recette ou
pattern réutilisable, puis nouvelle primitive ou nouveau pack générique dans le
domaine approprié. Aucun emplacement d'extension propre à un jeu n'existe ; les
jeux ne fournissent que des données et composent ces capacités.

## Définition auteur et artefact runtime

`defineGame` compose les patterns, composants, actions, hooks et politiques,
valide la définition et produit un artefact distinct, gelé récursivement.
Le même objet auteur est compilé une seule fois pendant la vie du processus :
une WeakMap retourne ensuite le même artefact. L'objet auteur est gelé après
compilation ; pour une nouvelle définition, il faut créer un nouvel objet.
Deux objets auteurs distincts sont deux entrées de compilation, même si leurs
identifiants sont identiques. La compilation n'est pas un cache distribué.

Le constructeur de `DeclarativeGameRuntime` exige un artefact réellement produit
par le compilateur. Une copie superficielle ou un objet auteur qui imite ses
champs est refusé. Les schémas d'entrée parsés à chaque commande servent à la
validation des données reçues ; les règles et patterns ne sont pas recompilés.

Le contenu statique est validé avant son hash et avant compilation. Les fonctions,
cycles, nombres non finis et objets non statiques sont refusés. Les erreurs de
clonage sont converties en `GameContentValidationError`. Les Map et Set admis dans
le contenu sont inclus dans le hash avec leurs entrées et leur ordre d'itération.
Un contenu utilisant ces collections peut donc obtenir une nouvelle version
après cette correction du hash ; son ancien snapshot sera refusé si elle diffère.

## Versions et restauration

Trois valeurs indépendantes sont persistées dans l'en-tête moteur :
`schemaVersion` (format de l'état du jeu), `contentVersion` (contenu statique),
`rulesVersion` (règles). Elles sont distinctes de la version du SDK moteur.
La projection publique générique possède son propre `viewVersion` ; un pack
d'effets ne peut pas le remplacer. La version des règles reste portée par
`rulesVersion`.

`loadDeclarativeState` vérifie les données avant le clonage, exige l'en-tête,
compare les trois versions puis valide le scheduler. Toute divergence de version
produit `GameStateViolationError`, avec les versions attendues et stockées.
Le runtime ne charge pas silencieusement un ancien contenu avec les nouvelles
règles. Il faut conserver le runtime compatible ou fournir une migration explicite.
Aucune migration générale des états ni recherche historique de contenu n'est
ajoutée par ce lot. Le snapshot source n'est jamais modifié par son chargement.

Les postconditions vérifient tout l'état avant son retour à l'orchestrateur de
commit. Les fonctions, symboles, BigInt, cycles, getters/setters, collections
non JSON et nombres non finis sont rejetés. La profondeur est limitée à 128.
Les champs optionnels undefined restent autorisés selon le contrat historique.
Le timestamp `metadata.roomStartedAt` accepte encore Date ou texte ISO à la
frontière room ; ce cas explicite ne permet pas des Date arbitraires dans le jeu.

## Phases et règles automatiques

La compilation vérifie la phase initiale, les actions déclarées par phase, les
destinations `next` et les actions/durées des timeouts. Une transition dynamique
via le contexte refuse également une phase inconnue. La preuve d'atteignabilité
et l'identification des phases terminales restent ouvertes : les callbacks
arbitraires des jeux ne constituent pas encore un graphe statique complet.

Les règles automatiques sont ordonnées une fois à la compilation, par priorité
décroissante puis ordre de déclaration. Après les effets et la victoire, le
runtime applique la première règle dont le prédicat est vrai, puis réévalue.
Une règle doit rendre son prédicat faux ou conduire vers un état convergent.
L'unicité de son identifiant ne garantit pas son idempotence. Une règle toujours
vraie, même sans modification d'état, consomme la limite de stabilisation.
Après 32 itérations, une erreur métier contient la trace des règles, phases et
effets concernés. Le test vérifie cette borne et la conservation de l'état source.

## Timers et déterminisme

Le jeu utilise `ctx.scheduler`, une capacité du runtime. Il ne manipule ni BullMQ,
ni Redis, ni timer système. Le scheduler conserve des données : identifiant,
échéance absolue, action/payload, visibilité et `schemaVersion: 1`. Les callbacks
ne sont jamais stockés. Un timer sans version issu d'un ancien snapshot est
interprété comme version 1 et normalisé dans la copie chargée ; une version future
inconnue est refusée. Les données d'action suivent aussi la `rulesVersion` du jeu.

Le runtime valide un timer avant de le stocker. Les identifiants sont nettoyés
et les noms de prototype JavaScript restent de simples identifiants. Les égalités
d'échéance sont départagées par ordre des points de code, sans dépendance à la
locale système. La consommation est possible à l'échéance, une seule fois.
Un aller-retour JSON conserve le payload et le comportement du timer.

Les mécanismes déterministes utilisent l'état RNG/seed et l'horloge d'exécution
injectée. Le seed seul ne suffit pas à reproduire des échéances : l'ordre des
commandes et leurs instants d'exécution font partie des entrées de replay.
L'infrastructure est responsable de livrer les commandes aux échéances ; le
runtime est responsable de leurs effets sur l'état et de leur validation.
