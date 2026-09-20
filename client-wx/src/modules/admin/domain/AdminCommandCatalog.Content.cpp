#include "modules/admin/domain/AdminCommand.h"
#include "generated/protocol/WsMessageTypes.generated.h"

namespace lila::modules::admin::domain
{
namespace ws = lila::shared::network::ws::types;

void AppendContentCommands(std::vector<AdminCommand>& c)
{
    using T = AdminTransport;
    c.insert(c.end(), {
        {"rooms.list", L"Lister les salles", L"Inclure les salles privées ou démarrées.", T::ApiWebSocket, std::string(ws::admin::rooms::List), {}, R"({"limit":200,"includePrivate":true,"includeStarted":false})"},
        {"rooms.joinable", L"Lister les salles intégrables", L"Salles ouvertes avec joueurs actifs.", T::ApiWebSocket, std::string(ws::admin::rooms::List), {}, R"({"limit":200,"joinableOnly":true})"},
        {"rooms.join", L"Intégrer une salle", L"Utiliser le flux normal comme joueur ou spectateur.", T::LocalAction, "join-room", {}, R"({"roomId":1,"spectator":true})"},
        {"rooms.destroy", L"Détruire une salle", L"Supprimer immédiatement une salle.", T::ApiWebSocket, std::string(ws::admin::rooms::Destroy), {}, R"({"roomId":1,"confirm":true})", true},
        {"rooms.cleanup.preview", L"Prévisualiser le nettoyage", L"Simulation excluant les joueurs actifs.", T::ApiWebSocket, std::string(ws::admin::rooms::Cleanup), {}, R"({"confirm":true,"dryRun":true,"includePrivate":false,"includeStarted":false,"olderThanMinutes":60,"limit":1000})"},
        {"rooms.cleanup", L"Exécuter le nettoyage", L"Supprimer les salles correspondant aux filtres.", T::ApiWebSocket, std::string(ws::admin::rooms::Cleanup), {}, R"({"confirm":true,"dryRun":false,"includePrivate":false,"includeStarted":false,"olderThanMinutes":60,"limit":1000})", true},
        {"rooms.settings.get", L"Lire le nettoyage automatique", L"Paramètres courants.", T::ApiWebSocket, std::string(ws::admin::rooms::SettingsGet)},
        {"rooms.settings.update", L"Modifier le nettoyage automatique", L"Activation, âge, intervalle et limite.", T::ApiWebSocket, std::string(ws::admin::rooms::SettingsUpdate), {}, R"({"autoCleanupEnabled":true,"autoCleanupOlderThanMinutes":60,"autoCleanupIntervalSeconds":300,"autoCleanupLimit":1000})"},

        {"games.list", L"Lister les jeux", L"Catalogue incluant les jeux désactivés.", T::ApiWebSocket, std::string(ws::admin::games::List)},
        {"games.enable", L"Activer ou désactiver un jeu", L"Modification rapide de disponibilité.", T::ApiWebSocket, std::string(ws::admin::games::SetEnabled), {}, R"({"gameType":"","enabled":true})"},
        {"games.update", L"Modifier un jeu", L"Personnalisation du catalogue et du tchat.", T::ApiWebSocket, std::string(ws::admin::games::Update), {}, R"({"gameType":"","enabled":true,"name":"","description":"","rules":"","minPlayers":2,"maxPlayers":8,"status":"finished","chatEnabled":true,"chatSoundsEnabled":true})"},
        {"games.reset", L"Réinitialiser un jeu", L"Supprimer toutes ses personnalisations.", T::ApiWebSocket, std::string(ws::admin::games::Reset), {}, R"({"gameType":""})", true},
        {"categories.list", L"Lister les catégories", L"Arbre et affectations.", T::ApiWebSocket, std::string(ws::admin::games::Categories)},
        {"categories.create", L"Créer une catégorie", L"La catégorie parente est facultative.", T::ApiWebSocket, std::string(ws::admin::games::CategoryCreate), std::string(ws::admin::games::Categories), R"({"name":"","parentId":null})"},
        {"categories.update", L"Modifier une catégorie", L"Nom ou parent.", T::ApiWebSocket, std::string(ws::admin::games::CategoryUpdate), std::string(ws::admin::games::Categories), R"({"id":"","name":"","parentId":null})"},
        {"categories.assign", L"Affecter une catégorie", L"Associer un jeu, null pour retirer.", T::ApiWebSocket, std::string(ws::admin::games::CategoryAssign), {}, R"({"gameType":"","categoryId":null})"},
        {"categories.delete", L"Supprimer une catégorie", L"Suppression et réconciliation.", T::ApiWebSocket, std::string(ws::admin::games::CategoryDelete), std::string(ws::admin::games::Categories), R"({"id":""})", true},

        {"bots.names", L"Lister les noms", L"Noms disponibles et activation.", T::ApiWebSocket, std::string(ws::admin::bots::NamesList)},
        {"bots.create", L"Créer un nom", L"Nom de bot, 150 caractères maximum.", T::ApiWebSocket, std::string(ws::admin::bots::NameCreate), std::string(ws::admin::bots::NamesList), R"({"name":"","enabled":true})"},
        {"bots.update", L"Modifier un nom", L"Nom et activation.", T::ApiWebSocket, std::string(ws::admin::bots::NameUpdate), std::string(ws::admin::bots::NamesList), R"({"id":1,"name":"","enabled":true})"},
        {"bots.delete", L"Supprimer un nom", L"Retirer un nom de bot.", T::ApiWebSocket, std::string(ws::admin::bots::NameDelete), std::string(ws::admin::bots::NamesList), R"({"id":1})", true},
        {"bots.settings.get", L"Lire les temporisations des bots", L"Délais actuels avant les actions automatiques.", T::ApiWebSocket, std::string(ws::admin::bots::SettingsGet)},
        {"bots.settings.update", L"Régler les attentes des bots", L"Durées en millisecondes, de 0 à 600000.", T::ApiWebSocket, std::string(ws::admin::bots::SettingsUpdate), {}, R"({"botTurnDelayMs":500,"botStartDelayMs":500,"botDrawDelayMs":500})"},

        {"mnemo.categories", L"Lister les catégories", L"Catégories du quiz Mnemo.", T::ApiWebSocket, std::string(ws::admin::quiz::mnemo::Categories)},
        {"mnemo.category.create", L"Créer une catégorie", L"Nom de la catégorie.", T::ApiWebSocket, std::string(ws::admin::quiz::mnemo::CategoryCreate), std::string(ws::admin::quiz::mnemo::Categories), R"({"name":""})"},
        {"mnemo.category.update", L"Renommer une catégorie", L"Identifiant et nouveau nom.", T::ApiWebSocket, std::string(ws::admin::quiz::mnemo::CategoryUpdate), std::string(ws::admin::quiz::mnemo::Categories), R"({"id":"","name":""})"},
        {"mnemo.category.delete", L"Supprimer une catégorie", L"Suppression définitive.", T::ApiWebSocket, std::string(ws::admin::quiz::mnemo::CategoryDelete), std::string(ws::admin::quiz::mnemo::Categories), R"({"id":""})", true},
        {"mnemo.questions", L"Lister les questions", L"Filtres facultatifs catégorie/statut.", T::ApiWebSocket, std::string(ws::admin::quiz::mnemo::Questions), {}, R"({"categoryId":"","status":"pending","offset":0,"limit":50})"},
        {"mnemo.question.create", L"Créer une question", L"Exactement quatre réponses.", T::ApiWebSocket, std::string(ws::admin::quiz::mnemo::QuestionCreate), std::string(ws::admin::quiz::mnemo::Questions), R"({"categoryId":"","question":"","answers":["","","",""],"correctIndex":0,"status":"pending"})"},
        {"mnemo.question.update", L"Modifier une question", L"Seuls les champs fournis changent.", T::ApiWebSocket, std::string(ws::admin::quiz::mnemo::QuestionUpdate), std::string(ws::admin::quiz::mnemo::Questions), R"({"id":"","question":"","answers":["","","",""],"correctIndex":0,"status":"pending"})"},
        {"mnemo.question.delete", L"Supprimer une question", L"Suppression définitive.", T::ApiWebSocket, std::string(ws::admin::quiz::mnemo::QuestionDelete), std::string(ws::admin::quiz::mnemo::Questions), R"({"id":""})", true},

        {"roles.list", L"Lister les rôles", L"Rôles et définitions.", T::ApiWebSocket, std::string(ws::admin::roles::List)},
        {"roles.definitions", L"Lister les définitions", L"Descriptions et permissions.", T::ApiWebSocket, std::string(ws::admin::roles::Definitions)},
        {"roles.create", L"Créer un rôle", L"Permissions déclaratives.", T::ApiWebSocket, std::string(ws::admin::roles::Create), std::string(ws::admin::roles::Definitions), R"({"name":"ROLE_","description":"","permissions":["admin.users"]})"},
        {"roles.update", L"Modifier un rôle", L"Renommage, description ou permissions.", T::ApiWebSocket, std::string(ws::admin::roles::Update), std::string(ws::admin::roles::Definitions), R"({"name":"ROLE_","newName":"","description":"","permissions":["admin.users"]})"},
        {"roles.delete", L"Supprimer un rôle", L"Suppression de la définition.", T::ApiWebSocket, std::string(ws::admin::roles::Delete), std::string(ws::admin::roles::Definitions), R"({"name":"ROLE_"})", true},
    });
}
}
