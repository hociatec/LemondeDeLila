# Grande passe : sélections de pions et composition des règles

Les points **115 et 120** du snapshot courant sont clôturés. Le backlog et
son registre passent de **47 à 45 points ouverts**. Le point **121** avance
avec Taxi Express, mais reste ouvert pour les autres conditions standards.

## Point 115 : suppression de 15 fichiers de raccordement

Les définitions de choix, d'effets et de victoire rejoignent les fichiers
de règles existants. `game.ts` importe les déclarations et reste un fichier
de composition, conformément au contrôle d'architecture. Aucun fichier de
remplacement n'est créé pour renommer simplement les anciens raccordements.

Les `rule-bindings.ts` supprimés concernent :

- À Fond les Ballons, Aventure Sauvage, Ça Dérape, En Attendant Minuit ;
- Frousse Party, Galopons Ensemble, Mission Galaxie, Odyssée Quatre Cieux ;
- Pirates en Vadrouille, Primalis, La Parade Sucrée ;
- Corridor, Foulées Fantastiques, Jeu de l'Oie et Morpion.

Dans Ça Dérape, les choix rejoignent `actions.ts`, où leur résolution est
déjà implémentée. Les effets restent importés directement depuis `effects.ts`.
Cela conserve un graphe sans cycle et laisse `rules.ts` sous sa limite de
400 lignes. Les types génériques des effets et victoires extraits sont
explicites lorsque le contexte de `defineGame` les fournissait auparavant.

Les 11 `rule-bindings.ts` conservés portent des règles automatiques, de cycle
de vie ou de projection : Contes et Cacahuètes, Panier Express, Sac à Malices,
Voyage en Terre de Brumes, Cat Pattes, Entre Rites et Lumières, Gérard Président,
Nawak, Pimp My Ride, Zig et Zag et Lama. Leur rôle dépasse le simple
raccordement couvert par le point 115 ; ils restent concernés par les audits
plus larges du point 114.

## Point 120 : sélection générique des familles de pions

`sequentialPawnSelection` accepte des groupes déclarés par identifiant,
libellé et liste ordonnée de pions. Le moteur vérifie les groupes vides, les
identifiants dupliqués et les pions partagés entre groupes. Les définitions
sont copiées puis gelées pour éviter leur modification ultérieure.

À la résolution, l'existence du groupe, la disponibilité de tous ses pions
et la capacité du joueur sont vérifiées avant la première affectation.
Les groupes déjà pris disparaissent des choix suivants.

Foulées Fantastiques déclare ses familles de quatre pions dans cette recette.
Les identifiants des choix, l'ordre des familles et des pions, le passage
au joueur suivant et la transition vers la phase de jeu sont conservés.
Le test du jeu couvre la sélection successive, le refus d'une famille déjà
prise sans mutation d'état, les huit affectations et le replay déterministe.

Les dix autres jeux à sélection initiale de pion utilisent déjà cette recette.
La recherche dans les règles de jeux ne trouve plus d'appel direct à
`ctx.pawns.assign`. Le cas restant identifié dans le rapport précédent est
donc traité.

Le contrat de déclarations SDK passe de **6.2.0 à 6.3.0** pour cette option
additive : **110 fichiers de déclarations**, toujours **81 exports publics**.
La version du protocole runtime n'est pas modifiée.

## Point 121 : Taxi Express

La livraison d'un client utilise `thresholdVictory` pour son seuil de cinq
trajets. Le joueur qui livre reste celui qui déclenche la victoire ; le
moment de défausse et la raison `five-trips` sont conservés. Les autres
victoires standards du backlog demandent encore un traitement distinct.

## Validation et limites

- Première passe ciblée : **5 suites, 57 tests réussis**, dont le contrat
  couvrant les 39 jeux.
- Exécution complète du backend : **296 suites**, dont 290 réussies et six
  en échec sur le raccordement temporairement incorrect des effets de Ça
  Dérape pendant le regroupement des fichiers.
- Vérification des jeux et recettes après regroupement : **19 suites,
  79 tests réussis sur 80**. Le seul échec était une nouvelle assertion de
  Foulées Fantastiques qui lisait les pions dans `system` au lieu de `kits`.
- Après correction du raccordement et de cette assertion : **7 suites,
  67 tests réussis**, couvrant les six suites en échec et Foulées Fantastiques.
  Les suites se recoupent ; ces nombres ne doivent pas être additionnés.
- TypeScript, lint ciblé, contrat SDK, contrôles d'architecture général et
  moteur validés ; contrôle structurel sans nouvelle dette.
- Build réussi : **1674 fichiers compilés**, puis chargement de `AppModule`
  compilé réussi. Registre de dette synchronisé avec `corriger.txt`.

La suite complète n'a pas été rejouée intégralement après les dernières
corrections ; les suites en échec et les jeux touchés ont été revérifiés.
Les tests d'intégration nécessitant des services externes réels n'ont pas
été exécutés. Aucun déploiement ni migration de données.

Les deux fichiers `typeorm-entities.ts` et `typeorm-entities.spec.ts` sont
bien dans `src/app/database`, et absents de la racine de `src`.
