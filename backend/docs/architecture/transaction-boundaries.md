# Frontières transactionnelles métier

Inventaire des écritures composées et de leur garantie :

| Cas d'usage | Écritures | Garantie |
|---|---|---|
| création de room | room + participant propriétaire | transaction TypeORM dans `createOwnedRoom` |
| état de jeu | session + événements + snapshots | transaction TypeORM et CAS de version |
| début/fin de statistiques | match + joueurs | transaction TypeORM via `createMatchWithPlayers` / `saveMatchWithPlayers` |
| définition des rôles | définition + permissions | transaction TypeORM |
| restauration Vault | room, participants, bots, état de jeu, notifications | saga; destruction compensatoire de la room si une étape obligatoire échoue |
| cache, présence, pub/sub, notifications secondaires | source durable puis diffusion | invalidation ou diffusion best-effort; resynchronisation à la lecture |

Une méthode applicative ne doit pas enchaîner plusieurs sauvegardes obligatoires
sans appeler un port atomique ou déclarer une compensation testée. Les effets
non durables (cache, WebSocket, pub/sub) ne participent pas à la transaction :
ils sont exécutés après le commit et sont reconstruits depuis la source durable.
