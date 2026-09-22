# Poursuite des corrections — 22 septembre 2026

Ce rapport complète [la première vérification](dette-restante-2026-09-22.md).

État historique : les mesures de taille ci-dessous sont remplacées par
[la finalisation](dette-finalisation-2026-09-22.md), qui rétablit le plafond
historique de 13 344 lignes.

## Défauts corrigés et vérifiés

- **Ratios SLO à faible trafic** : le dénominateur était plafonné par le bas à
  une requête par seconde, ce qui sous-estimait les proportions d'erreurs. Les
  tests reproduisent 50 % d'erreurs à seulement deux requêtes par minute et
  vérifient le déclenchement des alertes HTTP et WebSocket. Les séries d'erreurs
  absentes et le trafic nul sont également testés.
- **Échecs BullMQ** : le calcul `increase` utilisait une jauge qui peut diminuer
  lors du nettoyage des jobs. Il utilise maintenant un vrai compteur de tentatives
  échouées, alimenté par l'événement `failed` du worker, y compris si le contenu
  du job est invalide. Les tests séparent ce compteur du stock de jobs conservés.
- **Disparition des métriques** : une nouvelle alerte couvre une cible indisponible
  et l'absence complète du job `lila-backend`. Son déclenchement, sa résolution
  et l'absence d'alerte en situation saine sont testés.
- **Faux succès des replays** : une campagne ne peut plus s'arrêter avec succès
  lorsqu'une partie active n'a plus d'action après épuisement de ses timers.
  Un test injecte un blocage après la première commande et exige son rejet.
  Chaque scénario des 39 jeux doit désormais terminer la partie ou atteindre
  les 64 étapes prévues.
- **Duplication des bots** : sept adaptateurs réutilisent la sélection commune
  d'une action disponible, en conservant le payload, l'ordre des actions et le
  résultat nul si la recette n'est pas disponible. Ces comportements sont testés.

## Preuves locales

- Suite générale finale : **432 suites, 2 519 tests réussis**, aucun échec
  (`dette-suite-regression.log`, 774,971 secondes). Les **156 scénarios**
  des 39 jeux terminent la partie ou atteignent leurs 64 étapes ; aucun blocage
  silencieux n'est accepté.
- `promtool` 3.5.0 : **25 scénarios d'alertes** et **5 scénarios SLO** passent.
  Toutes les **12 alertes déclarées** ont un déclenchement et une résolution
  vérifiés. L'audit refuse une nouvelle alerte sans ces assertions.
- Prometheus 3.5.0 → Alertmanager 0.28.1 → webhook local : **12 notifications
  d'alerte et 12 notifications de résolution reçues**. Journal
  `dette-suite-observability-final.log`. Les exécutables sont réels ; les données
  de l'exporteur sont simulées et les durées accélérées uniquement dans les copies
  temporaires des règles. La disponibilité du collecteur est testée par une vraie
  réponse HTTP 503, puis 200. La CI exécute également ce circuit.
- **4 suites ciblées, 15 tests réussis** : progression des jeux, sélection des
  bots, métriques et événements du worker (`dette-suite-targeted.log`).
- Typage TypeScript complet réussi (`dette-suite-typecheck-final.log`).
- Contrôle qualité global réussi (`dette-suite-quality.log`), dont architecture,
  persistance, contrats, absence de code mort et gouvernance.
- Lint complet réussi (`dette-suite-lint.log`). Build TypeScript/SWC réussi,
  **1 839 fichiers compilés**, puis chargement du module de l'application réussi
  (`dette-suite-build.log`).

## Taille et portée de la certification

La mutualisation ramène les effect packs de 13 614 à **13 581 lignes** ; le plafond
est resserré à cette mesure (comportement : 13 505). La limite de 13 500 octets par
fichier reste bloquante. Le plafond global historique de 13 344 lignes n'est pas
atteint : aucune réduction artificielle du comptage ni suppression de tests
n'a été utilisée pour le masquer.

Le texte complet du point 63 et l'environnement cible n'ont pas été fournis.
La validation porte donc sur le code et le circuit local. Les migrations sur la
base cible, le chargement effectif de Grafana/Prometheus et l'acheminement vers les
destinataires réels restent des vérifications de déploiement. Une suite de tests
finie ne prouve pas toutes les combinaisons métier possibles.
