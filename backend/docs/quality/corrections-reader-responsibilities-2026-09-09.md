# Contrats et implémentations Reader

Revue des douze déclarations `Reader` : catalogue de jeux, sessions actives,
versions client, releases WX, amis acceptés, utilisateurs sociaux, utilisateurs de
messagerie, messages non lus et participants actifs. Les quatre classes concrètes
lisent les fichiers ou exécutent des requêtes SELECT/count ; les huit interfaces
exposent uniquement des lectures et projections. Les données retournées par les
lecteurs de participants et d'amis sont des projections dédiées.

Le port temps réel se nomme désormais `ClientVersionReader` pour exprimer sa
lecture asynchrone ; le service de projection des mises à jour est
`ClientUpdateQueryService`. Les deux contrats `SocialUserReader` et
`MessagingUserReader` restent dans leurs fichiers de ports existants et ne
contiennent aucune opération d'écriture.

L'audit détecte les fichiers Reader et les déclarations de classes/interfaces
portant ce suffixe. Il refuse les méthodes de mutation des contrats, les appels
d'écriture ORM/filesystem connus et les instructions SQL de mutation littérales.
Il complète la revue des implémentations ; la classification sémantique de tout
SQL construit dynamiquement ne repose pas sur ce garde.

Les interfaces de lecture n'exposent aucune commande même lorsqu'un service
plus large les implémente. Les audits de couplage ORM et de performance des
projections restent suivis par leurs points distincts.

Le point 685 est clôturé après cette revue et les vingt tests des audits réussis.
L'audit d'architecture ne trouve aucune violation sur 1 287 fichiers et 75
composants ; aucune baseline n'a été élargie. Le typage et le chargement AppModule
valident les associations de providers après renommage. Journaux
`logs/corrections-policy-audit-tests.log` et `logs/corrections-policy-build.log`.
