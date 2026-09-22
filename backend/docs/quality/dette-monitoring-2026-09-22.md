# Collecte réelle des métriques — 22 septembre 2026

Cette étape poursuit [la finalisation précédente](dette-finalisation-2026-09-22.md).
Elle traite deux défauts de monitoring reproduits avant leur correction.

## Défauts et corrections

1. **Format HTTP de `/metrics`.** Nest renvoyait `text/html; charset=utf-8` pour
   le texte du registre. Le nouveau test HTTP attend le format Prometheus et
   échoue sur l'ancienne réponse (`logs/dette-metrics-before.log`). Le contrôleur
   émet maintenant le type de contenu du registre. Les gardes JWT/admin et
   l'interdiction de mise en cache restent actifs. Le test compare les paramètres
   du type de contenu sans dépendre de leur ordre, qu'Express peut modifier.
2. **Double comptage de la file BullMQ.** Deux instances observant chacune les
   mêmes 60 jobs déclenchaient l'alerte de seuil 100. `promtool` reproduit cette
   fausse alerte (`logs/dette-monitoring-promtool-before.log`). L'alerte et le
   panneau Grafana dédupliquent désormais les observations par `(queue, state)`.
   Les états waiting/delayed et les files distinctes restent additionnés.

Les accents corrompus de cinq titres Grafana ont également été rétablis.

## Preuves

- **21 suites et 77 tests réussis** sur l'authentification, l'observabilité et les
  vérifications de santé (`logs/dette-monitoring-tests.log`). Les cinq nouveaux
  tests HTTP couvrent le format/cache, l'absence de jeton, le jeton malformé,
  le jeton expiré et le rôle non administrateur.
- **Collecte réelle réussie**, via `tools/metrics-scrape-integration.cjs` : module
  Nest d'observabilité, registre réel, JWT RS256 temporaire et Prometheus 3.5.0.
  Une valeur de jauge est lue dans Prometheus ; la collecte échoue avec des
  credentials invalides ou non administrateurs, puis reprend après leur
  remplacement. Journal : `logs/dette-metrics-scrape.log`.
- **28 scénarios d'alertes, un scénario Grafana et cinq scénarios SLO réussis**
  avec `promtool` 3.5.0 (`logs/dette-monitoring-promtool.log`). L'audit exige que
  l'expression BullMQ du dashboard soit effectivement testée.
- **12 notifications d'alerte et 12 résolutions reçues** avec Prometheus et
  Alertmanager réels, après la modification de la règle de backlog
  (`logs/dette-monitoring-delivery.log`).
- Typage TypeScript complet et lint : réussis. Compilation de **1 841 fichiers**
  et chargement du module de l'application réussis.
- Contrôle qualité global : réussi (`logs/dette-monitoring-quality.log`),
  dont architecture, persistance, SDK et les 76 assertions des cinq suites
  de contrats moteur.

Les résultats et empreintes sont conservés dans
[le rapport JSON](dette-monitoring-2026-09-22.json).

La collecte du véritable endpoint complète le test précédent de livraison des
alertes, dont l'exporteur reste simulé pour injecter toutes les pannes.
Les deux tests utilisent uniquement des interfaces locales ; aucun message
externe n'est envoyé. Le test de collecte est ajouté au workflow CI.

## Portée

Le dernier passage de la suite générale reste celui de la finalisation :
433 suites et 2 532 tests. Cette étape a exécuté les 77 tests ciblés sur les
composants concernés ; elle ne présente pas cette sélection comme un nouveau
passage de toute la suite. Les règles des jeux sont inchangées.

Le point 63 initial reste tronqué et aucun environnement cible précis n'a été
fourni. La collecte locale et les routes d'alertes locales sont vérifiées ;
les migrations, credentials, routes réseau et destinataires de production
restent des vérifications de déploiement.
