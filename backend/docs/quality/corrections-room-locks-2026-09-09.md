# Verrous des commandes de partie

Points **593, 595, 596 et 597 clôturés et retirés** ; 268 points restent ouverts.

## Garanties

La file locale sérialise les commandes d'une room. Son port distribué est associé
à `MysqlGameRoomLockService` dans les providers Game WS, également utilisés par
l'automatisation des tâches. Chaque acquisition emploie une connexion dédiée,
le nom paramétré `lmdl:game-room:<roomId>` et un délai d'attente configuré et borné.
BullMQ transporte les tâches ; son verrou de worker ne remplace pas le verrou
de room. La transaction et le CAS de version restent l'autorité du commit.

En cas de réponse d'acquisition ou de libération incertaine, l'adaptateur détruit
la connexion au lieu de la rendre au pool avec un verrou potentiellement détenu.
La perte de la connexion propriétaire libère le verrou côté MySQL. Une mutation
interrompue avant son commit ne devient pas un état partiellement validé ; les
mécanismes transactionnels, de CAS et de remise des tâches restent distincts.

Les commandes imbriquées sont désormais refusées avant la mise en file, qu'elles
visent la même room ou une autre. Une portée asynchrone privée à l'instance suit
l'appel en cours ; son implémentation Node est derrière un port d'application.
La file n'acquiert donc jamais plusieurs verrous de room. Les workflows portant
sur plusieurs rooms doivent enchaîner leurs opérations après libération ; une
future opération atomique sur plusieurs rooms nécessiterait un contrat distinct
avec une acquisition triée, pas des appels imbriqués à cette file.

Le nettoyage de la file précède maintenant la résolution de la promesse retournée.
Une continuation détachée après la fin de sa commande ne conserve pas une fausse
interdiction d'acquisition. Les rooms indépendantes restent exécutables en parallèle.

## Vérification réelle et portée

Une instance MySQL **9.1.0** isolée, liée à `127.0.0.1:13307`, utilise un répertoire
de données créé sous `logs/mysql-locks-isolated-20260909`. Les services WAMP
habituels restent arrêtés. Aucun accès aux données de production.

`npm run test:db:locks` vérifie sur ce serveur : contention de deux connexions,
libération après destruction de la connexion propriétaire, acquisition par la
seconde connexion, exclusion par l'adaptateur réel, indépendance de deux rooms,
erreur de commande, nouvelle acquisition et absence de verrou restant.
Il ne crée ni table ni donnée métier. Les erreurs d'accusé de réception et la
destruction des connexions incertaines sont couvertes par les tests unitaires.

Ces vérifications ne prétendent pas simuler toutes les partitions réseau : le
CAS reste nécessaire si la connexion de verrou est perdue pendant un calcul.
Les autres verrous de l'application et le graceful shutdown restent des points
distincts du backlog.

Journaux : `logs/corrections-room-locks-*.log`.

Validation : **5 suites / 40 tests ciblés réussis**, typage complet, build/AppModule,
lint, quality:check et contrôle du diff réussis. Test des verrous sur MySQL réel
réussi. En complément, les 39 migrations et contrôles SQL existants passent sur
l’instance isolée (`logs/corrections-isolated-migrations.log`). La dernière suite
globale précédente comptait 233 suites / 921 tests ; elle n’est pas présentée
comme une nouvelle exécution après ces changements de file.
