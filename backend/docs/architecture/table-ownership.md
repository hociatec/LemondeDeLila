# Ownership des tables

Inventaire des 26 entités TypeORM déclarées dans `src`, vérifié le 8 septembre
2026 : chaque nom de table apparaît une seule fois et possède un owner désigné.
L'owner est responsable de son schéma et de ses invariants. Cet inventaire
n'affirme pas que tous les accès historiques respectent déjà cette frontière :
en particulier, les accès transverses à `users` restent à migrer.

| Module | Agrégat ou données dont il est responsable |
| --- | --- |
| admin | Définitions de rôles ; orchestration de backoffice pour les autres données. |
| bot | Catalogue et sélection des noms de bots ; les bots d'une salle appartiennent à room. |
| bug-reports | Signalements et commentaires associés. |
| catalog | Projection du catalogue des jeux ; persistance des catégories et overrides possédée par game. |
| chat | Messages du tchat et paramètres du tchat. |
| health | Diagnostic des dépendances ; aucune table métier. |
| messaging | Messages privés et état de lecture/suppression par destinataire. |
| notification | Boîte de notifications et distribution ; transport Redis. |
| presence | Connexions et états de présence éphémères, agrégation distribuée et cache des bannissements ; aucune table propre. |
| room | Salles, participants, bots des salles et paramètres de maintenance. |
| social | Profils, préférences de profil et relations sociales. |
| sounds | Bibliothèque et ressources sonores ; aucune entité TypeORM propre. |
| stats | Matchs terminés et participants des matchs. |
| update | Publications des mises à jour et ressources associées ; aucune entité TypeORM propre. |
| user | Compte utilisateur, credentials et attributs du compte. |
| vault | Snapshots de salles sauvegardés par propriétaire. |
| game | Sessions, snapshots et événements de jeu, paramètres des bots moteur, catégories et overrides du catalogue. |

Les couches techniques de platform possèdent leurs mécanismes de stockage
(sessions Redis, files, transports), mais aucune des 26 tables métier ci-dessous.
Les migrations et tables techniques de suivi des migrations ne sont pas des
agrégats applicatifs et ne figurent pas dans cet inventaire des entités.

| Table | Module owner | Entity |
| --- | --- | --- |
| bot_settings | game | `src/game/core/infrastructure/persistence/typeorm/entities/bot-settings.entity.ts` |
| game_session_events | game | `src/game/core/infrastructure/persistence/typeorm/entities/game-session-event.entity.ts` |
| game_session_snapshots | game | `src/game/core/infrastructure/persistence/typeorm/entities/game-session-snapshot.entity.ts` |
| game_sessions | game | `src/game/core/infrastructure/persistence/typeorm/entities/game-session.entity.ts` |
| game_catalog_overrides | game | `src/game/engine/infrastructure/persistence/typeorm/entities/game-catalog-override.entity.ts` |
| game_category_assignments | game | `src/game/engine/infrastructure/persistence/typeorm/entities/game-category-assignment.entity.ts` |
| game_categories | game | `src/game/engine/infrastructure/persistence/typeorm/entities/game-category.entity.ts` |
| role_definitions | admin | `src/modules/admin/infrastructure/persistence/typeorm/entities/role-definition.entity.ts` |
| bot_names | bot | `src/modules/bot/infrastructure/persistence/typeorm/entities/bot-name.entity.ts` |
| bug_report_comments | bug-reports | `src/modules/bug-reports/infrastructure/persistence/typeorm/entities/bug-report-comment.entity.ts` |
| bug_reports | bug-reports | `src/modules/bug-reports/infrastructure/persistence/typeorm/entities/bug-report.entity.ts` |
| chat_messages | chat | `src/modules/chat/infrastructure/persistence/typeorm/entities/chat-message.entity.ts` |
| chat_settings | chat | `src/modules/chat/infrastructure/persistence/typeorm/entities/chat-settings.entity.ts` |
| messaging_private_messages | messaging | `src/modules/messaging/infrastructure/persistence/typeorm/entities/private-message.entity.ts` |
| notification_inbox_items | notification | `src/modules/notification/infrastructure/persistence/typeorm/entities/notification-inbox-item.entity.ts` |
| room_bots | room | `src/modules/room/infrastructure/persistence/typeorm/entities/room-bot.entity.ts` |
| room_maintenance_settings | room | `src/modules/room/infrastructure/persistence/typeorm/entities/room-maintenance-settings.entity.ts` |
| room_participants | room | `src/modules/room/infrastructure/persistence/typeorm/entities/room-participant.entity.ts` |
| rooms | room | `src/modules/room/infrastructure/persistence/typeorm/entities/room.entity.ts` |
| social_profile_settings | social | `src/modules/social/infrastructure/persistence/typeorm/entities/social-profile-settings.entity.ts` |
| social_profiles | social | `src/modules/social/infrastructure/persistence/typeorm/entities/social-profile.entity.ts` |
| social_relationships | social | `src/modules/social/infrastructure/persistence/typeorm/entities/social-relationship.entity.ts` |
| game_match_players | stats | `src/modules/stats/infrastructure/persistence/typeorm/entities/game-match-player.entity.ts` |
| game_matches | stats | `src/modules/stats/infrastructure/persistence/typeorm/entities/game-match.entity.ts` |
| users | user | `src/modules/user/infrastructure/persistence/typeorm/entities/user.entity.ts` |
| vault_room_snapshots | vault | `src/modules/vault/infrastructure/persistence/typeorm/entities/vault-room-snapshot.entity.ts` |
