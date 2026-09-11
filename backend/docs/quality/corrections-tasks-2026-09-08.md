# Tâches obsolètes et restaurations — 8 septembre 2026

Suite du lot de 100 : **3 clôtures supplémentaires**, points **276, 277, 278**.
Le cumul du lot passe de 7 à 10 clôtures. Il reste 90 clôtures à réaliser dans
ce lot et 293 exigences au fichier de travail.

## Corrections

| Point | Garantie et implémentation |
| --- | --- |
| 276 | Chaque restauration reçoit un nouveau `metadata.restoreId`, créé par le stockage mémoire ou SQL, persisté avec l'état et renvoyé à l'appelant après succès. Il change même si le run, le numéro de version et le contenu restauré sont identiques. Les tâches comparent cet identifiant avant exécution et le CAS automatique le vérifie aussi sous le verrou de ligne SQL. |
| 277 | L'identité du job contient salle, jeu, run, restauration, génération, signature, versions de schéma, contenu et règles. Les anciennes tâches sans identité ne correspondent pas aux états qui en possèdent une. Les données persistées sont décodées avant verrou métier, métriques et exécution ; les données invalides échouent sans retry automatique via `UnrecoverableError`. |
| 278 | Une tâche obsolète ne produit pas d'action et replanifie depuis l'état courant si un plan existe. Les états absents ou terminés ne sont pas exécutés. Le nettoyage ne supprime que les générations plus anciennes du même run/restauration/versions : un producteur retardé ne peut plus effacer la nouvelle génération. Une livraison anticipée retourne dans les tâches différées avec son token BullMQ, sans être perdue par déduplication. |

Les identifiants de commandes automatiques sont désormais des empreintes SHA-256
de l'identité complète et de l'index d'action. Leur longueur est fixe (74 caractères),
inférieure à la limite de 128 du journal d'idempotence. L'ancienne concaténation
pouvait dépasser cette limite et être ignorée. Changer la génération, la restauration
ou les versions crée une autre identité ; une livraison répétée conserve la même.

Les commits conservent l'identifiant de restauration même si un état candidat
omet ce champ. La comparaison supplémentaire du CAS est explicitement demandée
par les automatisations. Les autres appelants existants gardent leur contrat
de comparaison par version.

## Vérifications

- Suite Jest complète : **219 suites, 812 tests réussis**.
- Tests ciblés : versions séparées, ancienne restauration à génération égale,
  CAS refusé avant écriture SQL, reprise après arrêt, double livraison, échec de
  publication après commit, données malformées, échéance future et taille des IDs.
- Les adaptateurs SQL et BullMQ sont testés avec dépendances simulées ; aucun
  test avec un serveur SQL/Redis réel n'est revendiqué pour cette série.
- Typecheck, lint, build/chargement AppModule, verify:dist et quality:check.
  Journaux : `logs/corrections-tasks-*.log`.
- Aucun changement des seuils ou baselines, aucune migration de données ni déploiement.

Les versions déjà persistées restent lisibles. Les nouvelles restaurations
ajoutent leur identité au JSON de l'état sans migration SQL. Les garanties
d'exécution décrites ici sont celles des workers mis à jour ; aucun worker
déployé n'a été remplacé pendant ce travail.

Les verrous de maintenance, métriques encore demandées, cohérence du déploiement
et autres exigences opérationnelles restent présents dans le backlog.
