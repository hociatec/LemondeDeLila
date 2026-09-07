# Dette backend résiduelle — Le Monde de Lila

**Dépôt :** `hociatec/LemondeDeLila`  
**Périmètre :** `backend/`, configuration racine et workflows GitHub liés au backend  
**Dernière vérification :** 1er septembre 2026  
**État :** 6 constats encore ouverts ou partiels

Ce document ne contient plus les dettes entièrement corrigées. Il doit être
supprimé lorsque les six constats ci-dessous et leurs critères de sortie sont
tous satisfaits.

## Preuves actuelles

- build et chargement du `AppModule` réussis;
- lint, typecheck et audits qualité réussis;
- 164 suites et 546 tests réussis;
- 39 migrations testées avec rollback/réapplication;
- intégrations réelles MySQL, Redis, BullMQ, WebSocket et deux instances réussies;
- exercice chiffré de restauration MySQL/Redis réussi en 0,695 seconde;
- couverture globale : 59,29 % lignes et 44,58 % branches;
- `.dotnet/` et `backend/data/` absents de l'index courant, mais pack Git
  historique de 2,10 Gio.

## Priorité haute

### TEST-01 — Couverture globale insuffisante

- **État actuel :** 59,29 % lignes, 44,58 % branches, 49,61 % fonctions et
  59,09 % statements. Les seuils CI du pool global sont relevés à 58/43/48/58
  (les cinq fichiers à seuils renforcés sont comptés séparément par Jest) et le
  résumé JSON est désormais régénéré à chaque mesure. Les utilitaires de fusion
  de présence atteignent 100 % des statements et le service 89,68 %.
- **Dette restante :** des modules et branches d'erreur, d'autorisation,
  d'idempotence et de reprise restent insuffisamment testés.
- **Action :** ajouter des tests métier utiles et relever progressivement les
  seuils, sans exclure artificiellement des fichiers de la couverture.
- **Critère de sortie :** au moins 70 % lignes et 60 % branches globalement,
  avec au moins 85 % sur auth, admin et updates.

### REPO-01 — Cache `.dotnet` encore présent dans l'historique Git

- **État actuel :** 2 823 fichiers retirés de l'index et `.dotnet/` ajouté au
  `.gitignore`; la copie locale est conservée.
- **Dette restante :** les objets des anciens commits restent dans le pack Git.
- **Action :** sauvegarde miroir, purge ciblée avec `git filter-repo`, validation
  des branches/tags, puis force-push coordonné et nouveau clone des contributeurs.
- **Critère de sortie :** aucun objet `.dotnet/` dans l'historique publié et
  réduction mesurée de la taille du clone.

### REPO-02 — Médias de runtime encore présents dans l'historique Git

- **État actuel :** 87 fichiers sous `backend/data/` retirés de l'index; les
  données locales restent disponibles et le stockage persistant est pris en charge.
- **Dette restante :** WAV, MP3 et anciennes données demeurent dans les commits
  historiques; le cycle de vie objet/CDN n'est pas complètement formalisé.
- **Action :** purger les médias historiques pendant la même réécriture que
  `REPO-01`, puis formaliser intégrité, rétention et sauvegarde du stockage média.
- **Critère de sortie :** aucun média lourd de runtime dans Git et clone réduit
  d'au moins 80 % par rapport aux 2,10 Gio actuels.

## Priorité moyenne

### OBS-02 — Observabilité distribuée incomplète

- **État actuel :** logs corrélés, endpoint Prometheus, métriques Node/process et
  métriques RED HTTP à cardinalité bornée.
- **Dette restante :** tracing OpenTelemetry HTTP/WS/jobs/DB, métriques USE,
  tableaux de bord, alertes et SLO de production absents.
- **Action :** instrumenter les frontières et dépendances, exporter traces et
  métriques vers la plateforme d'observabilité, versionner dashboards et alertes.
- **Critère de sortie :** SLO et alertes opérationnels pour disponibilité,
  latence HTTP/WS, erreurs, files BullMQ et saturation DB/Redis, avec test d'alerte.

## Amélioration continue

### QLT-01 — Contrôles internes sans revue indépendante démontrée

- **État actuel :** baselines de violations à zéro, régressions interdites et
  tests des auditeurs structurels, d'architecture et de persistance.
- **Dette restante :** aucune revue indépendante périodique ni campagne de
  mutation externe complète n'est démontrée.
- **Action :** faire réviser règles et exceptions par une autre personne, injecter
  des violations représentatives et conserver le rapport de détection.
- **Critère de sortie :** revue datée et signée, mutations critiques toutes
  détectées, aucune tolérance injustifiée.

### DATA-02 — Pipeline de contenu encore couplé au backend

- **État actuel :** données d'exploitation et médias sortis de l'index Git;
  définitions de jeux et contenu versionné disposent déjà de validations internes.
- **Dette restante :** code exécutable, définitions éditoriales, manifests et
  publication du contenu utilisent encore le même cycle backend.
- **Action :** définir un paquet de contenu versionné avec schéma, validation,
  checksum et pipeline de publication indépendant des binaires backend.
- **Critère de sortie :** contenu publiable et réversible sans reconstruire le
  backend, avec compatibilité de version contrôlée au chargement.

## Ordre recommandé

1. Relever la couverture par lots fonctionnels.
2. Mettre en place la télémétrie distribuée.
3. Réaliser la revue indépendante des contrôles et séparer le pipeline contenu.
4. Planifier la réécriture Git, geler les contributions, sauvegarder, purger,
   vérifier puis forcer la mise à jour du dépôt distant.
