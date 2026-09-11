# Arrêt du serveur — 9 septembre 2026

Points **388–394 clôturés et retirés** après validation. Le fichier conserve 258 points ouverts.

| Points | Correction et preuve |
| --- | --- |
| 388–389 | Entrée SIGTERM/SIGINT idempotente dédiée, arrêt de l'écoute HTTP, refus des requêtes/upgrades/messages nouveaux avant fermeture des ressources. Test du chemin SIGTERM avec Nest réel. |
| 390 | Fermeture WS 1001 après fin de commande, attente des callbacks de déconnexion, terminaison des sockets non coopératives après une seconde. Connexion WS réelle et test de la borne temporelle. |
| 391–392 | Hooks Nest de fermeture DB/Redis appelés après drainage HTTP/WS/consumers ; quota Redis suivi avant les interceptors. Revue des propriétaires de connexions et test Nest de l'ordre des hooks. |
| 393 | worker.close() attend les jobs actifs avant fermeture de la queue et de Redis ; arrêt enregistré comme source de travail. Test du worker, de la queue et de la connexion avec doubles contrôlés. |
| 394 | Promesses métier conservées après abandon HTTP, écritures de déconnexion attendues, statistiques/invitations/inbox suivies, file de dispatch du scheduler extraite et lots parallèles drainés avant propagation de leur première erreur. |

Contrat et limites : [graceful-shutdown.md](../architecture/graceful-shutdown.md).
L'arrêt natif app.close() ne doit pas être utilisé comme entrée d'arrêt de production.
Les processus système détachés ont leur propre cycle de vie. SIGKILL, panne matérielle
ou perte réseau restent des arrêts non gracieux ; aucune garantie contre ces événements
n'est déduite des tests d'arrêt ordonné. Cette série ne revendique pas de test Redis/BullMQ réel.

Validation finale : **245 suites / 1 045 tests réussis**, typage complet, lint,
build/AppModule et quality:check réussis. Contrôle structurel : zéro nouvelle dette.
Journaux : logs/corrections-shutdown-batches-{all-tests,typecheck,lint,build,quality}.log.
Les catalogues sont inchangés ; verify:dist et comparaison de contenu passent.

Le contrôle automatique backlog:check rapproche désormais les points retirés de
leurs rapports et refuse tout point clôturé encore présent ou retrait sans référence.
