#include "modules/admin/domain/AdminFormMetadata.h"

#include <array>
#include <unordered_map>

namespace lila::modules::admin::domain
{
namespace
{
const std::unordered_map<std::string_view, std::wstring_view> Labels{
    {"id", L"Identifiant"}, {"userId", L"Identifiant utilisateur"},
    {"toUserId", L"Destinataire"}, {"roomId", L"Identifiant de salle"},
    {"messageId", L"Identifiant du message"}, {"reportId", L"Identifiant du rapport"},
    {"contactId", L"Identifiant du contact"}, {"gameType", L"Type de jeu"},
    {"categoryId", L"Catégorie"}, {"parentId", L"Catégorie parente"},
    {"soundId", L"Identifiant du son"}, {"filePath", L"Fichier audio"},
    {"email", L"Adresse électronique"}, {"username", L"Nom d’utilisateur"},
    {"password", L"Mot de passe"}, {"avatar", L"Avatar"},
    {"roles", L"Rôles"}, {"role", L"Rôle"}, {"name", L"Nom"},
    {"newName", L"Nouveau nom"}, {"description", L"Description"},
    {"permissions", L"Permissions"}, {"reason", L"Motif"},
    {"banReason", L"Motif du bannissement"}, {"durationDays", L"Durée en jours"},
    {"bannedUntil", L"Banni jusqu’au"}, {"search", L"Recherche"},
    {"status", L"Statut"}, {"createdAfter", L"Créé après"},
    {"createdBefore", L"Créé avant"}, {"page", L"Page"}, {"limit", L"Limite"},
    {"offset", L"Décalage"}, {"message", L"Message"}, {"content", L"Contenu"},
    {"subject", L"Sujet"}, {"filter", L"Filtre"}, {"lines", L"Nombre de lignes"},
    {"tail", L"Nombre de lignes"}, {"enabled", L"Activé"},
    {"handled", L"Traité"}, {"spectator", L"Mode spectateur"},
    {"includeDeleted", L"Inclure les éléments supprimés"},
    {"includePrivate", L"Inclure les salles privées"},
    {"includeStarted", L"Inclure les salles démarrées"},
    {"joinableOnly", L"Salles intégrables uniquement"},
    {"confirm", L"Confirmation serveur"}, {"dryRun", L"Simulation"},
    {"olderThanMinutes", L"Âge minimal en minutes"},
    {"autoCleanupEnabled", L"Nettoyage automatique"},
    {"autoCleanupOlderThanMinutes", L"Âge minimal automatique"},
    {"autoCleanupIntervalSeconds", L"Intervalle en secondes"},
    {"autoCleanupLimit", L"Limite du nettoyage"}, {"minPlayers", L"Joueurs minimum"},
    {"maxPlayers", L"Joueurs maximum"}, {"rules", L"Règles"},
    {"chatEnabled", L"Tchat activé"}, {"chatSoundsEnabled", L"Sons du tchat activés"},
    {"botTurnDelayMs", L"Délai d’un tour de bot (ms)"},
    {"botStartDelayMs", L"Délai de démarrage du bot (ms)"},
    {"botDrawDelayMs", L"Délai de pioche du bot (ms)"},
    {"question", L"Question"}, {"answers", L"Réponses"},
    {"correctIndex", L"Index de la bonne réponse"},
    {"bioMinLength", L"Longueur minimale de biographie"},
    {"bioMaxLength", L"Longueur maximale de biographie"},
    {"chatHistoryLimit", L"Taille de l’historique"},
    {"editWindowSeconds", L"Délai d’édition en secondes"},
    {"windowSeconds", L"Fenêtre de mesure en secondes"},
};

bool IsUpdateOptional(std::string_view command, std::string_view field)
{
    if (command == "users.update") return field != "id";
    if (command == "games.update") return field != "gameType";
    if (command == "roles.update") return field != "name";
    constexpr std::array<std::string_view, 4> IdUpdates{
        "categories.update", "bots.update", "mnemo.category.update", "mnemo.question.update"};
    for (const auto value : IdUpdates)
        if (command == value) return field != "id";
    return false;
}
}

AdminFieldMetadata GetAdminFieldMetadata(
    std::string_view commandId,
    std::string_view fieldName)
{
    AdminFieldMetadata result;
    if (const auto found = Labels.find(fieldName); found != Labels.end()) result.label = found->second;
    else result.label.assign(fieldName.begin(), fieldName.end());

    if (fieldName == "content" || fieldName == "description" || fieldName == "rules" ||
        fieldName == "message" || fieldName == "question")
        result.kind = AdminFieldKind::Multiline;
    if (fieldName == "roles" || fieldName == "permissions" || fieldName == "answers")
        result.kind = AdminFieldKind::StringList;
    if (fieldName == "status")
    {
        result.kind = AdminFieldKind::Choice;
        if (commandId == "users.list")
            result.choices = {"all", "active", "banned"};
        else if (commandId.starts_with("games."))
            result.choices = {"construction", "beta", "finished"};
        else if (commandId.starts_with("contacts."))
            result.choices = {"open", "in_progress", "handled"};
        else if (commandId.starts_with("mnemo."))
            result.choices = {"validated", "pending", "to_edit", "trash"};
        else
            result.choices = {"pending", "in_progress", "to_test", "done", "refused"};
    }

    constexpr std::array<std::string_view, 8> FilterFields{
        "search", "role", "createdAfter", "createdBefore", "filter",
        "includeDeleted", "includeStarted", "includePrivate"};
    for (const auto value : FilterFields)
        if (fieldName == value) result.optional = true;
    result.optional = result.optional || IsUpdateOptional(commandId, fieldName);
    result.includedByDefault = !result.optional ||
        (fieldName != "search" && fieldName != "role" && fieldName != "createdAfter" &&
         fieldName != "createdBefore" && !IsUpdateOptional(commandId, fieldName));
    return result;
}
}
