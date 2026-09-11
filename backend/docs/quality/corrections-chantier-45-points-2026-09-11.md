# Chantier des 45 points : compilation, setup, présence et architecture

Cette passe couvre plusieurs sous-ensembles du backlog. Les points **184 et
194** sont clôturés ; **43 points restent ouverts**. Les corrections ci-dessous
ne constituent pas une clôture générale de la validation, de la présence ou du
moteur déclaratif.

## Compilation des composants et JSON — points 136, 137 et 178

- Les composants fournis directement à `defineGame` passent les validations des
  fabriques de cartes, dés, grilles, inventaires, pistes, propriétés, pions,
  quiz et marchés. Cela évite de contourner les garanties en fournissant un
  littéral au lieu d'appeler une fabrique. Les erreurs portent le chemin du
  composant ; les objets d'une pioche doivent avoir des identifiants uniques.
- Les quotas de pions sont des entiers positifs compatibles avec le catalogue,
  y compris à la fabrique. Les fractions ne sont plus arrondies silencieusement.
- Les collections déclarées vérifient leurs références d'inventaire dans les
  groupes comme dans le total, indépendamment de l'ordre des composants.
- La grammaire JSON limite le total des textes et clés à 8 Mio en UTF-8,
  conserve la limite individuelle de 65 536 caractères et refuse les nombres
  dont la valeur absolue dépasse `Number.MAX_SAFE_INTEGER`. Les contrôles de
  profondeur, cycles, accesseurs et champs inconnus restent actifs.

Les valeurs libres répétées dans une pioche restent autorisées. Les identifiants
de cartes sont locaux à chaque catalogue. Cette passe ne prétend pas valider
statiquement les références calculées par tous les callbacks TypeScript, ni
couvrir à elle seule toutes les entrées JSON des modules applicatifs.

## Initialisation des jeux — points 116, 185 et 191

La recette `sequentialPawnSelection` fournit une initialisation qui ouvre la
sélection dans l'ordre déclaré et crée un nouvel état par partie. Elle remplace
les `setup-rules.ts` identiques de cinq jeux : Aventure Sauvage, Frousse Party,
Galopons Ensemble, En Attendant Minuit et À Fond les Ballons. Le dernier conserve
son état initial `awaitingCardDraw: false`.

La sélection des pions rejoint `pawn-selection.recipes.ts`, séparément des
recettes de cartes et de dés. L'API publique du SDK conserve le même import et
ajoute la méthode `setup` : contrat **6.4.0**, **111 fichiers de déclarations**,
**81 exports publics**. Les autres setups spécifiques restent à examiner ; le
point 116 n'est pas clôturé.

## Responsabilités des règles — points 185 et 186

Le `support.ts` de Gérard Président est supprimé. Ses déclarations rejoignent
trois fichiers : `game-constants.ts` pour les identifiants, types et phases,
`round-rules.ts` pour la collecte et la fin de manche, et
`special-card-rules.ts` pour les cartes spéciales et leurs effets sur les
joueurs. Les consommateurs importent directement le fichier responsable.

Le relais `advanceSubmission`, qui appelait seulement `updateCollectionPhase`,
est supprimé avec ses références. Le contrôle du moteur confirme que le
découpage n'introduit aucun cycle. D'autres wrappers et fichiers de support
restent au backlog ; ces deux points ne sont pas clôturés globalement.

## Présence — points 147, 148, 156, 165 et 199

Le cache des origines capture uniquement les champs publics et gèle ses copies,
y compris les salles imbriquées. Modifier une annonce déjà reçue ou un objet
retourné par une lecture ne peut plus modifier le cache. Les annonces contenant
des joueurs invalides ou dupliqués sont rejetées sans consommer leur séquence.

La fusion des annonces conserve la priorité des activités, départage les
métadonnées à égalité par identifiant d'origine et trie le résultat par joueur.
Le résultat ne dépend plus de l'ordre de réception des mêmes annonces. La
projection locale énumère ses champs publics au lieu d'exclure seulement
`contextLocked` d'un objet complet.

L'expiration à partir de l'horloge de réception, les séquences et les mécanismes
de rattrapage par snapshot complet sont conservés. Ces tests locaux ne valent
pas exécution d'une campagne de panne sur plusieurs instances réelles.

## Clôture du point 184 : périmètre de shared

`RoomCreateCommand` rejoint `modules/room/application/models`. Les services et
l'adaptateur Room importent le modèle local ; le port consommateur de Vault
déclare son propre `VaultRoomCreateInput`, compatible structurellement avec
l'adaptateur. Aucun contrat de création de salle ne demeure dans `shared`.

Le réexport inutilisé `shared/identifiers.ts` est supprimé après recherche de
ses consommateurs. `shared` conserve 13 fichiers de production : identifiants
nominaux, horloge, identité authentifiée et utilitaires techniques. Le contrôle
d'architecture interdit ses dépendances vers les modules applicatifs.

## Clôture du point 194 : exceptions temporaires

Les registres `architecture-baseline.json` et
`structural-quality-baseline.json` ne contiennent aucune exception. Le contrôle
final de dette échoue désormais si une entrée y est réintroduite, même après
une régénération du registre. Deux tests négatifs en répertoires temporaires
isolés vérifient ce refus ; le test du dépôt réel vérifie le cas valide.

Les règles permanentes de composition et les exemptions structurelles par rôle
ne sont pas des exceptions temporaires de migration. Elles restent déclarées
dans les contrats d'architecture.

## Vérifications

- Suite complète : **298 suites, 1 496 tests réussis**.
- Après le découpage de Gérard Président : **5 suites, 54 tests réussis**,
  comprenant ce jeu, les contrats des 39 jeux, la sélection de pions,
  l'adaptateur Room/Vault et la compensation des restaurations.
- Contrôle final d'architecture : **3 tests Node réussis**, dont deux tests
  négatifs contre les exceptions réintroduites.
- TypeScript et lint ciblé réussis ; audits général, moteur et structurel
  sans régression. Contrat SDK 6.4.0 vérifié.
- Build final réussi : **1 674 fichiers compilés**, puis chargement de
  `AppModule` compilé réussi. Vérification des différences sans erreur et
  registre de dette synchronisé avec les 43 points ouverts.
- Audits des frontières de sécurité et de persistance réussis. Ils complètent
  les tests et ne prouvent pas seuls la clôture des points de sécurité ouverts.

Les ensembles de tests se recoupent. La suite complète précède le dernier
découpage de Gérard Président, couvert ensuite par la relance ciblée. Les
intégrations contre des services externes réels ne sont pas exécutées.

Les points non clôturés restent dans `corriger.txt` et son registre. Aucun
déploiement ni migration de données n'est effectué.
