# Texte de présentation et données exécutables

Points **25, 27, 429 et 501 clôturés et retirés** ; 272 points restent ouverts.

## Corrections

- Sac à Malices : références explicites des cases, groupes, équipements et
  destinations des cartes pour les sept variantes. Les groupes ne dépendent plus
  de la ponctuation ou du libellé des couleurs. [Détail](corrections-sac-references-2026-09-08.md).
- Voyage : les choix de quiz portent un identifiant et un libellé distincts ;
  `answerId` détermine la réponse correcte. Deux choix peuvent afficher le même
  texte sans ambiguïté. Le catalogue embarqué ne contient actuellement aucun quiz ;
  les tests exercent le chemin utilisé par les catalogues externes.
- Panier Express : les 30 questions source portent directement leur indice de
  réponse. Le catalogue normalisé et son empreinte restent strictement identiques.
- Dame Nature : les 70 questions portent `choices` et `answerIndex`, avec une
  validation des bornes indépendante des libellés. Les réponses restent identiques.
  Les règles actuelles défaussent les cartes quiz ; ce travail ne leur ajoute pas
  une nouvelle phase de jeu.

## Contrôle transversal

Revue des comparaisons, recherches et opérations sur chaînes des 38 jeux : les
effets utilisent les champs structurés, les quiz utilisent des indices ou IDs,
les familles utilisent leurs IDs. Dans Gérard, le champ de commande `name` contient
un ID de carte, pas son prénom affiché. Les couleurs de Zig et Zag sont des codes
énumérés ; leur libellé d'affichage est distinct. Le découpage du texte Ballons ne
sert qu'au message d'annonce ; les effets proviennent de `card.effects`.

L'audit d'architecture refuse désormais `match`, `matchAll`, `search`, `test` et
`normalize` dans les fichiers des jeux pour empêcher le retour des interpréteurs
de prose. Les validations génériques restent dans le SDK. Les conversions d'ID
vers un libellé de présentation restent admises. Les fixtures testent refus et
acceptation ; ce garde-fou complète la revue des données et règles, sans prétendre
être une analyse générale de tous les flux de données possibles.

## Compatibilité et validation

Sac et Voyage utilisent les règles 2 ; leurs anciens snapshots sont refusés et
restent concernés par le chantier de maintien des anciennes définitions. Dame
Nature ne persiste que les IDs de ces cartes et conserve ses règles : une transition
exacte `593ce53d` vers `5fc7c131` conserve les sauvegardes existantes, sans autoriser
les autres versions inconnues. Les anciens fichiers de contenu externe doivent
être convertis avant activation ; aucune interprétation du texte n'est conservée
comme chemin de compatibilité.

Les scripts de comparaison confirment 35 catalogues strictement identiques,
Voyage identique en données, les 70 réponses Dame Nature préservées et les seules
corrections Sac détaillées dans son rapport. Les sources originales sont sauvegardées
dans `logs/`. Aucun déploiement ni migration de données de production.

Validation : **233 suites / 921 tests réussis**, compilation/chargement AppModule,
typage, lint, quality:check, verify:dist et contrôle du diff réussis. Après correction
d’une annotation de test, le typage complet et les huit tests de compatibilité ont
été relancés avec succès. Journaux : `logs/corrections-text-content-*.log`.
Les tests SQL/BullMQ ne constituent pas une validation sur services réels ;
la suite de couverture de scénarios indique MySQL indisponible.
Le point 30 reste ouvert : les références de l'ensemble des composants demandent
une vérification plus large que les seules corrections de texte.
