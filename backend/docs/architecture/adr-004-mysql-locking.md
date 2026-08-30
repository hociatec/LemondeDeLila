# ADR-004 — MySQL, verrouillage et concurrence

Statut : accepté.

MySQL est la source de vérité des agrégats durables. Une commande de jeu est
d'abord ordonnée dans sa queue locale, puis exécutée sous un verrou nommé MySQL
par room. `GET_LOCK` utilise une connexion dédiée, un délai borné et libère le
verrou dans un `finally`. Le temps d'attente et les acquisitions sont mesurés.

Le verrou réduit les conflits mais ne constitue pas la garantie de correction.
Chaque écriture d'état reste une transaction compare-and-set sur sa version ;
une version obsolète produit une erreur métier de concurrence et incrémente la
métrique CAS. Les contraintes uniques restent l'autorité pour les créations
concurrentes et les erreurs MySQL passent par le traducteur SQL commun.

Les tests MySQL réels couvrent migrations à vide, migrations avec données,
index/plans, verrou entre deux connexions, CAS, transaction atomique et
contraintes d'unicité. Une nouvelle écriture multi-repositories doit rejoindre
`transaction-boundaries.md` et exposer un port atomique ou une compensation.

