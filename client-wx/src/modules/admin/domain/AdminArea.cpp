#include "modules/admin/domain/AdminArea.h"

namespace lila::modules::admin::domain
{
const std::vector<AdminArea>& GetAdminAreas()
{
    static const std::vector<AdminArea> areas{
        {"categories", L"JEUX", L"Gérer les catégories", L"Créer, modifier et attribuer les catégories de jeux.",
         {"categories.create", "categories.list"}, "categories.list", AdminItemKind::Category},
        {"games", L"JEUX", L"Gérer les jeux", L"Catalogue, disponibilité, règles et paramètres des jeux.",
         {"games.list"}, "games.list", AdminItemKind::Game},
        {"bots", L"JEUX", L"Gérer les bots", L"Noms disponibles et délais des bots.",
         {"bots.settings.get", "bots.settings.update", "bots.create", "bots.names"},
         "bots.names", AdminItemKind::Bot},
        {"rooms", L"JEUX", L"Gérer les rooms", L"Intégrer, détruire et nettoyer les rooms.",
         {"rooms.cleanup", "rooms.joinable", "rooms.list", "rooms.settings.get",
          "rooms.settings.update"}, "rooms.list", AdminItemKind::Room},
        {"users", L"UTILISATEURS", L"Gérer les utilisateurs", L"Recherche, profils, rôles et bannissements.",
         {"settings.profile.get", "settings.profile.update", "users.list"},
         "users.list", AdminItemKind::User},
        {"roles", L"UTILISATEURS", L"Gérer les rôles", L"Définitions globales et permissions.",
         {"roles.create", "roles.definitions"}, "roles.definitions", AdminItemKind::Role},
        {"storybook", L"UTILISATEURS", L"Livre des contes", L"Consulter le livre d’un utilisateur.",
         {"users.list"}, "users.list", AdminItemKind::User},
        {"broadcast", L"COMMUNICATION", L"Envoyer un message global", L"Diffuser une annonce à tous les utilisateurs.",
         {"settings.broadcast"}, {}, AdminItemKind::None},
        {"notifications", L"COMMUNICATION", L"Notifications", L"Demandes adressées à l’équipe d’administration.",
         {"contacts.threads"}, "contacts.threads", AdminItemKind::Contact},
        {"reports", L"COMMUNICATION", L"Rapports de bug", L"Rapports regroupés par statut et commentaires.",
         {"bugs.create"}, "bugs.list", AdminItemKind::BugReport},
        {"chat", L"OUTILS", L"Tchat (modération)", L"Messages, sanctions et paramètres du tchat.",
         {"chat.clear", "chat.settings.get", "chat.settings.update", "chat.messages"},
         "chat.messages", AdminItemKind::ChatMessage},
        {"updates", L"OUTILS", L"Mises à jour client", L"État et distribution du client Windows.",
         {"maintenance.deploy.status"}, {}, AdminItemKind::None},
        {"sounds", L"OUTILS", L"Gérer les sons", L"Catalogue, événements et ambiances sonores.",
         {"sounds.cleanup", "sounds.reencode.all", "sounds.reencode.invalid", "sounds.catalog"},
         "sounds.catalog", AdminItemKind::Sound},
        {"ambiences", L"ADMINISTRATION", L"Gérer les ambiances", L"Créer, renommer, activer et sonoriser les ambiances de table.",
         {"sounds.ambience.create", "sounds.ambiences"},
         "sounds.ambiences", AdminItemKind::Ambience},
        {"diagnostics", L"OUTILS", L"Diagnostics latence", L"Mesures et événements récents.",
         {"perf.snapshot"}, "perf.snapshot", AdminItemKind::None},
        {"logs", L"OUTILS", L"Consulter les logs", L"Télécharger et filtrer les journaux serveur.",
         {"logs.download"}, {}, AdminItemKind::None},
        {"maintenance", L"OUTILS", L"Maintenance", L"Backend, service et système.",
         {"maintenance.health", "maintenance.service.status", "maintenance.migrations",
          "maintenance.dryRun", "maintenance.buildRestart", "maintenance.restart",
          "maintenance.daemonReload"}, {}, AdminItemKind::None},
    };
    return areas;
}
}
