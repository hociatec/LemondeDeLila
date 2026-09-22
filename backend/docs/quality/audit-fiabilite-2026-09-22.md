# Audit de fiabilité — 22 septembre 2026

Cet audit ciblé a trouvé trois bugs supplémentaires dans les sondes de santé
et la reprise des automatisations. Les cas défaillants ont été reproduits avant
correction. Les modifications précédentes de l'espace de travail sont conservées.

## Corrections

| Défaut | Conséquence | Correction |
| --- | --- | --- |
| Fichier de sonde disque nommé uniquement avec le PID | Des appels concurrents provoquaient des échecs `EEXIST` et pouvaient supprimer le fichier d'un autre appel | Nom UUID par sonde, ouverture exclusive, fermeture du handle et nettoyage conditionné à sa création effective |
| Quarantaine conservée après disparition d'une session SQL | Comptage de sessions différées et alerte persistants sans session à reprendre | Marquage des entrées rencontrées et purge des absentes uniquement à la fin d'un balayage complet |
| Redis des baux absent des contrôles de readiness | Backend déclaré disponible malgré l'impossibilité d'acquérir les verrous distribués | Contrôle de cette capacité avec les mêmes priorités d'URL que le service de baux, sans duplication des sondes |

Le nettoyage de quarantaine ne supprime aucune donnée SQL. Il conserve les
délais des sessions toujours présentes, même lorsqu'elles ne sont pas encore
éligibles à une nouvelle tentative. Une erreur SQL ou un balayage partiel
ne suffisent pas à supprimer une entrée.

## Preuves

- Avant correction : deux tests échouent dans `audit-reliability-before.log`,
  puis deux cas de readiness échouent dans `audit-readiness-before.log`.
- Après correction : **19 suites, 107 tests réussis**, dont **9 nouveaux tests**,
  sur la santé, Redis, le shutdown et les tâches/reprises de jeux
  (`audit-reliability-tests.log`, 11,731 secondes).
- Tests de sondes : huit appels concurrents avec un fichier témoin préexistant,
  conservation du témoin, absence de temporaires résiduels, erreur d'ouverture
  sans suppression et erreur d'écriture suivie du nettoyage du fichier possédé.
- Tests de reprise : disparition d'une session, conservation des délais des
  sessions différées et conservation de la quarantaine après une erreur SQL.
- Tests de readiness : panne du Redis dédié aux baux, repli sur `REDIS_URL`,
  priorité d'`UPDATE_REDIS_URL` et déduplication des connexions partagées.
- Typage TypeScript complet et lint : réussis.
- Compilation de **1 841 fichiers**, puis chargement du module de l'application : réussis.
- Contrôle qualité global : réussi, dont architecture, persistance, contrats
  des 39 jeux et contrat SDK. Journaux `audit-reliability-{typecheck,lint,build,quality}.log`.

Les mesures et empreintes sont consignées dans
[le rapport JSON](audit-fiabilite-2026-09-22.json).

Les journaux sont dans `backend/logs`. Les règles métier des jeux et les schémas
SQL n'ont pas été modifiés. Les tests ont porté sur les composants concernés ;
la suite générale précédente de 433 suites et 2 532 tests reste une preuve
historique, distincte de ce passage ciblé.

Cet audit ne constitue pas une garantie d'absence de tout bug dans l'ensemble du
projet. Aucun déploiement ni changement de données de production n'a été effectué.
