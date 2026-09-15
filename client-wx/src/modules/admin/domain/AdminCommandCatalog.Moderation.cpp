#include "modules/admin/domain/AdminCommand.h"
#include "generated/protocol/WsMessageTypes.generated.h"

namespace lila::modules::admin::domain
{
namespace ws = lila::shared::network::ws::types;

void AppendModerationCommands(std::vector<AdminCommand>& c)
{
    using T = AdminTransport;
    c.insert(c.end(), {
        {"users.list", L"Rechercher les utilisateurs", L"Recherche, rôle, statut, dates et pagination.", T::HttpJson, "GET /api/admin/users", {}, R"({"search":"","role":"","status":"all","createdAfter":"","createdBefore":"","page":1,"limit":20})"},
        {"users.get", L"Consulter un utilisateur", L"Renseigner son identifiant.", T::HttpJson, "GET /api/admin/users/{id}", {}, R"({"id":1})"},
        {"users.create", L"Créer un utilisateur", L"Le mot de passe est optionnel.", T::HttpJson, "POST /api/admin/users", {}, R"({"email":"","username":"","password":"","roles":["ROLE_USER"],"avatar":""})"},
        {"users.update", L"Modifier un utilisateur", L"Seuls les champs fournis changent.", T::HttpJson, "PATCH /api/admin/users/{id}", {}, R"({"id":1,"email":"","username":"","password":"","roles":["ROLE_USER"],"avatar":"","bannedUntil":"","banReason":""})"},
        {"users.resetPassword", L"Réinitialiser le mot de passe", L"Le secret temporaire ne sera affiché qu'une fois.", T::HttpJson, "POST /api/admin/users/{id}/reset-password", {}, R"({"id":1})", true},
        {"users.ban", L"Bannir un compte", L"Motif et durée en jours.", T::HttpJson, "POST /api/admin/users/{id}/ban", {}, R"({"id":1,"reason":"","durationDays":1,"bannedUntil":""})", true},
        {"users.unban", L"Débannir un compte", L"Retirer le bannissement du compte.", T::HttpJson, "POST /api/admin/users/{id}/unban", {}, R"({"id":1})", true},
        {"users.delete", L"Supprimer un utilisateur", L"Suppression définitive du compte.", T::HttpJson, "DELETE /api/admin/users/{id}", {}, R"({"id":1})", true},

        {"chat.messages", L"Lister les messages", L"Inclure éventuellement les messages supprimés.", T::ApiWebSocket, std::string(ws::admin::chat::Messages), {}, R"({"limit":200,"includeDeleted":false})"},
        {"chat.delete", L"Supprimer un message", L"Suppression par identifiant.", T::ApiWebSocket, std::string(ws::admin::chat::Delete), {}, R"({"messageId":""})", true},
        {"chat.clear", L"Vider le tchat", L"Supprimer tous les messages.", T::ApiWebSocket, std::string(ws::admin::chat::Clear), {}, "{}", true},
        {"chat.ban", L"Bannir du tchat", L"Sanction indépendante du compte.", T::ApiWebSocket, std::string(ws::admin::chat::Ban), {}, R"({"id":1,"reason":"","durationDays":1})", true},
        {"chat.unban", L"Débannir du tchat", L"Retirer la sanction tchat.", T::ApiWebSocket, std::string(ws::admin::chat::Unban), {}, R"({"id":1})", true},
        {"chat.settings.get", L"Lire les paramètres", L"Historique et fenêtre d'édition.", T::ApiWebSocket, std::string(ws::admin::chat::SettingsGet)},
        {"chat.settings.update", L"Modifier les paramètres", L"Bornes contrôlées par le serveur.", T::ApiWebSocket, std::string(ws::admin::chat::SettingsUpdate), {}, R"({"chatHistoryLimit":200,"editWindowSeconds":300})"},

        {"contacts.threads", L"Lister les fils", L"Demandes ouvertes, en cours et traitées.", T::NotificationWebSocket, std::string(ws::notify::inbox::Threads), {}, R"({"limit":200})"},
        {"contacts.reply", L"Répondre", L"Réponse d'un membre du staff.", T::NotificationWebSocket, std::string(ws::notify::inbox::Reply), std::string(ws::notify::inbox::Sent), R"({"contactId":"","toUserId":1,"message":""})"},
        {"contacts.status", L"Changer le statut", L"open, in_progress ou handled.", T::NotificationWebSocket, std::string(ws::notify::inbox::SetStatus), {}, R"({"contactId":"","status":"in_progress"})"},
        {"contacts.cycle", L"Faire avancer le statut", L"Passer au prochain statut du workflow.", T::NotificationWebSocket, std::string(ws::notify::inbox::CycleStatus), {}, R"({"contactId":""})"},
        {"contacts.handled", L"Marquer traité", L"Marquer explicitement le fil.", T::NotificationWebSocket, std::string(ws::notify::inbox::SetHandled), {}, R"({"contactId":"","handled":true})"},
        {"contacts.delete", L"Supprimer un fil", L"Suppression du fil de contact.", T::NotificationWebSocket, std::string(ws::notify::inbox::DeleteThread), {}, R"({"contactId":""})", true},

        {"bugs.list", L"Rechercher les rapports", L"Recherche et classement par statut.", T::ApiWebSocket, std::string(ws::admin::bugReports::List), {}, R"({"search":"","status":"pending","offset":0,"limit":50})"},
        {"bugs.get", L"Consulter un rapport", L"Détail et nombre de commentaires.", T::ApiWebSocket, std::string(ws::admin::bugReports::Get), {}, R"({"id":""})"},
        {"bugs.create", L"Nouveau rapport", L"Le nouveau rapport sera automatiquement classé en attente.", T::ApiWebSocket, std::string(ws::admin::bugReports::Create), {}, R"({"subject":"","content":""})"},
        {"bugs.update", L"Modifier un rapport", L"Sujet et contenu.", T::ApiWebSocket, std::string(ws::admin::bugReports::Update), {}, R"({"id":"","subject":"","content":""})"},
        {"bugs.status", L"Changer le statut", L"Utiliser refused plutôt que rejected.", T::ApiWebSocket, std::string(ws::admin::bugReports::UpdateStatus), {}, R"({"id":"","status":"in_progress"})"},
        {"bugs.comments", L"Lister les commentaires", L"Commentaires paginés.", T::ApiWebSocket, std::string(ws::admin::bugReports::CommentsList), {}, R"({"reportId":"","offset":0,"limit":50})"},
        {"bugs.comment", L"Ajouter un commentaire", L"Commentaire de suivi.", T::ApiWebSocket, std::string(ws::admin::bugReports::CommentsAdd), {}, R"({"reportId":"","content":""})"},
        {"bugs.delete", L"Supprimer un rapport", L"Suppression définitive.", T::ApiWebSocket, std::string(ws::admin::bugReports::Delete), {}, R"({"id":""})", true},
    });
}
}
