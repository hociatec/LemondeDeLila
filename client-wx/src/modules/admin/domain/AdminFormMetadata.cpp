#include "modules/admin/domain/AdminFormMetadata.h"
#include "modules/admin/domain/AdminFormMetadata.BugReports.h"
#include <array>
#include <unordered_map>
#include <nlohmann/json.hpp>
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
    {"botTurnDelayMs", L"Attente avant la réponse d’un bot (ms)"},
    {"botStartDelayMs", L"Attente avant la première action d’un bot (ms)"},
    {"botDrawDelayMs", L"Attente après la pioche d’un bot (ms)"},
    {"question", L"Question"}, {"answers", L"Réponses"},
    {"correctIndex", L"Index de la bonne réponse"},
    {"bioMinLength", L"Longueur minimale de biographie"},
    {"bioMaxLength", L"Longueur maximale de biographie"},
    {"chatHistoryLimit", L"Taille de l’historique"},
    {"editWindowSeconds", L"Délai d’édition en secondes"},
    {"windowSeconds", L"Fenêtre de mesure en secondes"},
};
void SetSoundChoices(AdminFieldMetadata& result)
{
    struct Choice final { const char* id; const wchar_t* label; };
    constexpr Choice choices[]{
        {"ClientOpened", L"Application — ouverture"}, {"ClientConnected", L"Application — connexion"},
        {"ClientDisconnected", L"Application — déconnexion"}, {"ClientClosing", L"Application — fermeture"},
        {"ClientUpdateWarning", L"Application — avertissement de mise à jour"},
        {"MainMenuMusic", L"Application — musique du menu principal"},
        {"TavernAmbience", L"Taverne — ambiance"}, {"TavernOpened", L"Taverne — entrée"},
        {"TavernClosed", L"Taverne — sortie"},
        {"RoomOpened", L"Table — création et entrée"}, {"RoomJoined", L"Table — rejoindre"},
        {"RoomExit", L"Table — sortie"},
        {"RoomMemberJoined", L"Table — un participant a rejoint"},
        {"RoomMemberLeft", L"Table — un participant est parti"},
        {"TableStarted", L"Table — démarrage de la partie"},
        {"InvitationSent", L"Table — invitation envoyée"},
        {"InvitationReceived", L"Table — invitation reçue"},
        {"DiceRolled", L"Jeu — lancer de dé"},
        {"DrawCard", L"Jeu — pioche"},
        {"PawnPicked", L"Jeu — pion sélectionné"}, {"PawnPlacedSelf", L"Jeu — votre pion placé"},
        {"PawnPlacedOpponent", L"Jeu — pion adverse placé"},
        {"WallPlacedSelf", L"Jeu — votre mur placé"}, {"WallPlacedOpponent", L"Jeu — mur adverse placé"},
        {"GameVictory", L"Jeu — victoire"}, {"GameDefeat", L"Jeu — défaite"},
        {"QuizCorrect", L"Jeu — bonne réponse"}, {"QuizWrong", L"Jeu — mauvaise réponse"},
        {"RoundEnded", L"Jeu — fin de manche"},
        {"ChatMessageSent", L"Tchat général — message envoyé"},
        {"ChatMessageReceived", L"Tchat général — message reçu"},
        {"TableChatMessageSent", L"Tchat de table — message envoyé"},
        {"TableChatMessageReceived", L"Tchat de table — message reçu"},
        {"PrivateMessageSent", L"Messages privés — message envoyé"},
        {"PrivateMessageReceived", L"Messages privés — message reçu"},
        {"AdminContactSent", L"Contact administration — message envoyé"},
        {"AdminContactReceived", L"Contact administration — réponse reçue"},
        {"BugReportCommentReceived", L"Rapports de bug — commentaire reçu"},
        {"FriendConnected", L"Amis — connexion"}, {"FriendDisconnected", L"Amis — déconnexion"},
        {"FriendInvitationSent", L"Amis — demande envoyée"},
        {"FriendInvitationReceived", L"Amis — demande reçue"},
    };
    result.kind = AdminFieldKind::Choice;
    for (const auto& choice : choices)
    {
        result.choices.emplace_back(choice.id);
        result.choiceLabels.emplace_back(choice.label);
    }
    for (int index = 1; index <= 20; ++index)
    {
        result.choices.emplace_back("TableAmbience" + std::to_string(index));
        result.choiceLabels.emplace_back(
            L"Ambiances de table — emplacement " + std::to_wstring(index));
    }
}
bool IsCommandOptional(std::string_view command, std::string_view field)
{
    if (command == "users.create")
        return field == "password" || field == "roles" || field == "avatar";
    if (command == "users.update") return field != "id";
    if (command == "users.ban")
        return field == "durationDays" || field == "bannedUntil";
    if (command == "games.update") return field != "gameType";
    if (command == "roles.update") return field != "name";
    if (command == "mnemo.questions")
        return field == "categoryId" || field == "status";
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
    if (fieldName == "soundId" && commandId.starts_with("sounds."))
        SetSoundChoices(result);
    if (fieldName == "status")
    {
        result.kind = AdminFieldKind::Choice;
        if (commandId == "users.list")
        {
            result.choices = {"all", "active", "banned"};
            result.choiceLabels = {L"Tous", L"Actifs", L"Bannis"};
        }
        else if (commandId.starts_with("games."))
        {
            result.choices = {"construction", "beta", "finished"};
            result.choiceLabels = {L"En construction", L"Bêta", L"Terminé"};
        }
        else if (commandId.starts_with("contacts."))
        {
            result.choices = {"open", "in_progress", "handled"};
            result.choiceLabels = {L"Ouvert", L"En cours", L"Traité"};
        }
        else if (commandId.starts_with("mnemo."))
        {
            result.choices = {"validated", "pending", "to_edit", "trash"};
            result.choiceLabels = {L"Validée", L"En attente", L"À modifier", L"Corbeille"};
        }
        else
        {
            result.choices = {"pending", "in_progress", "to_test", "done", "refused"};
            result.choiceLabels = {L"En attente", L"En cours", L"À tester", L"Terminé", L"Refusé"};
        }
    }
    ApplyBugReportFieldMetadata(commandId, fieldName, result);

    constexpr std::array<std::string_view, 8> FilterFields{
        "search", "role", "createdAfter", "createdBefore", "filter",
        "includeDeleted", "includeStarted", "includePrivate"};
    for (const auto value : FilterFields)
        if (fieldName == value) result.optional = true;
    result.optional = result.optional || IsCommandOptional(commandId, fieldName);
    result.includedByDefault = !result.optional ||
        (fieldName != "search" && fieldName != "role" && fieldName != "createdAfter" &&
         fieldName != "createdBefore" && !IsCommandOptional(commandId, fieldName));
    return result;
}

std::optional<AdminFormValidationError> ValidateAdminFormPayload(
    std::string_view commandId,
    const nlohmann::json& payload)
{
    if (!payload.is_object()) return AdminFormValidationError{"", L"Formulaire invalide."};
    for (const auto& field : payload.items())
    {
        const auto metadata = GetAdminFieldMetadata(commandId, field.key());
        if (!metadata.optional && field.key() != "filePath" && field.value().is_string() &&
            field.value().get_ref<const std::string&>().find_first_not_of(" \t\r\n") ==
                std::string::npos)
            return AdminFormValidationError{field.key(), metadata.label + L" est requis."};
    }

    if (const auto answers = payload.find("answers"); answers != payload.end())
    {
        if (!answers->is_array() || answers->size() != 4)
            return AdminFormValidationError{"answers", L"Saisissez exactement quatre réponses."};
        for (const auto& answer : *answers)
            if (!answer.is_string() ||
                answer.get_ref<const std::string&>().find_first_not_of(" \t\r\n") ==
                    std::string::npos)
                return AdminFormValidationError{
                    "answers", L"Chaque réponse doit contenir du texte."};
    }
    if (const auto index = payload.find("correctIndex"); index != payload.end() &&
        (!index->is_number_integer() || index->get<long long>() < 0 ||
         index->get<long long>() > 3))
        return AdminFormValidationError{
            "correctIndex", L"L’index de la bonne réponse doit être compris entre 0 et 3."};

    const auto invalidRange = [&payload](std::string_view minimum, std::string_view maximum)
    {
        const auto min = payload.find(minimum);
        const auto max = payload.find(maximum);
        return min != payload.end() && max != payload.end() && min->is_number() &&
            max->is_number() && min->get<double>() > max->get<double>();
    };
    if (invalidRange("minPlayers", "maxPlayers"))
        return AdminFormValidationError{
            "maxPlayers", L"Le maximum de joueurs doit être supérieur ou égal au minimum."};
    if (invalidRange("bioMinLength", "bioMaxLength"))
        return AdminFormValidationError{
            "bioMaxLength", L"La longueur maximale doit être supérieure ou égale au minimum."};
    return std::nullopt;
}
}
