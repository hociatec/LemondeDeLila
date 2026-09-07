# Sauvegarde et reprise

Propriétaire : équipe exploitation backend. Dernière revue : 2026-09-01.
Prochain exercice obligatoire : 2026-12-01.

Objectifs initiaux : RPO maximal de 15 minutes, RTO maximal de 60 minutes.
MySQL doit disposer de sauvegardes complètes chiffrées quotidiennes et de binlogs
permettant une restauration à un instant donné. Redis contient des sessions et
de l'état de jeu : AOF `everysec`, réplication et snapshot chiffré quotidien sont
requis. Les clés de chiffrement restent dans le gestionnaire de secrets, jamais
dans Git ni dans l'archive.

L'exercice trimestriel restaure la dernière sauvegarde MySQL et le snapshot
Redis dans un réseau isolé, applique les migrations, vérifie les invariants
métier et mesure séparément l'âge de la sauvegarde et le temps de restauration.
Il échoue si RPO/RTO dépassent les objectifs ou si un contrôle d'intégrité
échoue. Le rapport horodaté, les versions, les checksums et les durées sont
conservés 12 mois dans le stockage d'audit.

Procédure d'incident : figer les écritures, noter l'heure cible, choisir le
dernier backup antérieur, restaurer en environnement isolé, appliquer les
binlogs jusqu'à l'heure cible, exécuter migrations et tests d'intégrité, puis
basculer par changement atomique de connexion. L'ancienne base reste en lecture
seule jusqu'à validation fonctionnelle et ne doit jamais être écrasée.
