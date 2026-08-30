# Matrice d'autorisation et de protection IDOR

Statut : audit complet validé le 2026-08-30.

| Ressource | Lecture | Mutation | Autorité et preuve |
|---|---|---|---|
| messages privés | expéditeur ou destinataire | acteur membre du message | `private-messaging.service.spec.ts` teste suppression et lecture avec l'ID d'un tiers |
| notifications/inbox | `userId` issu de la session | repository filtré par `(userId, id)` ; workflow staff par rôle | `notification-inbox-typeorm.repository.spec.ts` vérifie qu'un ID appartenant à un tiers n'est jamais supprimé |
| rooms | public selon visibilité, sinon participant/propriétaire | propriétaire ou participant selon commande | specs `room.gateway.spectate`, `room.gateway.roles`, `room.start-flow` et test réel Room |
| vault | propriétaire du snapshot | repository `*ForOwner(id, ownerUserId)` | `vault-room-snapshots.service.spec.ts` couvre un snapshot appartenant à un tiers |
| relations sociales | acteur issu de la session | acteur partie à la relation | `social-relationship.service.spec.ts` couvre l'acceptation non autorisée |
| statistiques utilisateur | propriétaire, admin ou profil visible | aucune mutation publique | `StatsWsHandler.user` vérifie la visibilité avant la requête stats |
| chat | lecture authentifiée | auteur et fenêtre temporelle | `chat-mutation-services.spec.ts` couvre l'auteur différent |
| bots de room | participant visible en lecture | propriétaire de la room | `bot-room-policy.service.spec.ts` |
| bug reports | admin uniquement | admin uniquement | garde WS `requireAdmin` et garde HTTP JWT + rôle admin |
| administration utilisateurs | admin uniquement | admin uniquement (utilisateurs, rôles, logs, maintenance) | `requireAdmin` sur WS ; `HttpJwtGuard` + `AdminRoleGuard` sur HTTP |
| sons et updates | téléchargement public borné | admin JWT ou token CI dédié | gardes de contrôleur et politiques d'upload |
| profil utilisateur | session courante | session courante | handler injecte toujours l'identité de session |

Les identifiants fournis par le client ne remplacent jamais l'identité de
session. Un nouvel endpoint mutable ou une nouvelle ressource IDOR doit ajouter
sa ligne et un test avec un identifiant valide appartenant à un autre acteur.
