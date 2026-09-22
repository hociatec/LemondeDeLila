# Rétablissement des plafonds et validation — 22 septembre 2026

Ce rapport poursuit [la vérification précédente](dette-suite-2026-09-22.md).
Il remplace ses mesures de taille et ses résultats de régression pour l'état
actuel du code. Les preuves MySQL et monitoring précédentes restent historiques :
ces composants n'ont pas été modifiés pendant cette étape.

## Corrections

- Les effect packs passent de **13 581 à 13 320 lignes**. Le plafond historique
  de **13 344 lignes** est rétabli, ainsi que celui de **13 268 lignes de
  comportement** (mesure : **13 244**). Le plafond de **13 500 octets par fichier**
  reste bloquant. Les tests de gouvernance vérifient ces trois limites.
- Les fabriques capturent leur configuration clonée et, le cas échéant, leur
  catalogue une seule fois. Les fonctions privées cessent de retransmettre ces
  mêmes paramètres. Elles restent dans leurs modules et dans le comptage.
- Les bots réutilisent la sélection commune ; les bots pioche/lancer conservent
  explicitement la priorité des recettes, même si l'ordre des actions disponibles
  est différent. Les payloads et les tirages aléatoires restent au même endroit.
- Les effets sans données qui exigent un acteur partagent leur validation et
  leur garde `actorPlayerId != null`. Les effets qui doivent aussi agir sans
  acteur conservent leur comportement propre.
- Six adaptateurs de choix de pion utilisent le résolveur validé fourni par
  `sequentialPawnSelection`. Le comparateur de cartes spéciales déjà existant
  remplace sa copie dans les règles de thème/nom.
- Trois profils passent sous le seuil de revue de 300 lignes : domaine public
  (298), familles à effets (273) et pions appariés (286). Les 19 revues encore
  requises restent contrôlées ; le seuil n'a pas été augmenté. Les deux séquences
  structurelles déjà documentées conservent leurs justifications.
- Contrat auteur **6.20.0**, 111 fichiers de déclarations : ajout compatible du
  résolveur de choix, documentation et référence mises à jour après vérification
  des signatures. Aucune migration d'état de jeu n'est nécessaire.

## Vérifications

- Tests ciblés : **4 suites, 29 tests réussis**. Ils couvrent les priorités et
  l'absence d'actions des bots, les effets avec/sans acteur, la validation des
  choix avant mutation et l'isolation des configurations/catalogues entre deux
  fabriques malgré une mutation ultérieure de leur entrée.
- Typage TypeScript complet et lint : réussis.
- Compilation : **1 840 fichiers**, puis chargement du module de l'application
  réussi (`dette-finalisation-build.log`).
- Contrôle qualité global : réussi (`dette-finalisation-quality.log`), dont
  architecture, persistance, gouvernance, SDK et contrats des 39 jeux.
- Régression complète : **433 suites et 2 532 tests réussis**, aucun échec
  (`dette-finalisation-regression.log`, 785,488 secondes).
- **156 scénarios de replay**, soit les 39 jeux avec les graines 0, 1, 17 et
  65535. Chaque scénario termine la partie ou atteint 64 commandes ; les états,
  leur persistance JSON et les vues des joueurs sont comparés pendant le replay.

Les journaux de cette étape sont dans `backend/logs/dette-finalisation-*.log`.
Les mesures et empreintes finales sont consignées dans
[le rapport JSON associé](dette-finalisation-2026-09-22.json).

## Périmètre

Les vérifications portent sur le dépôt local. Le texte du point 63 reste tronqué
dans la source initiale. L'application des migrations et la livraison des alertes
aux destinataires de l'environnement cible restent à vérifier lors du déploiement.
Le risque combinatoire des 39 jeux est encadré par leurs contrats et leurs replays ;
une suite finie ne démontre pas tous les états possibles.
