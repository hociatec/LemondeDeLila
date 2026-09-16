#include "modules/admin/presentation/AdminResultFormatter.h"

#include <cctype>
#include <sstream>
#include <string_view>

#include <nlohmann/json.hpp>

namespace lila::modules::admin::presentation
{
namespace
{
std::string Humanize(std::string_view key)
{
    static const std::pair<std::string_view, std::string_view> Known[]{
        {"id", "Identifiant"}, {"name", "Nom"}, {"username", "Utilisateur"},
        {"email", "Adresse électronique"}, {"status", "Statut"},
        {"enabled", "Activé"}, {"message", "Message"}, {"subject", "Sujet"},
        {"description", "Description"}, {"createdAt", "Créé le"},
        {"updatedAt", "Modifié le"}, {"roles", "Rôles"}, {"total", "Total"},
        {"ok", "Succès"}, {"error", "Erreur"}, {"items", "Éléments"},
        {"users", "Utilisateurs"}, {"rooms", "Salles"}, {"messages", "Messages"},
        {"games", "Jeux"}, {"reports", "Rapports"}, {"categories", "Catégories"},
        {"questions", "Questions"}, {"definitions", "Définitions"},
        {"roles", "Rôles"}, {"permissions", "Permissions"},
        {"events", "Événements"}, {"sounds", "Sons"}, {"sections", "Fils de contact"},
        {"names", "Noms de bots"}, {"page", "Page"}, {"limit", "Par page"},
        {"content", "Contenu"}, {"reason", "Motif"},
        {"bannedUntil", "Banni jusqu’au"}, {"createdBy", "Créé par"},
        {"createdByUsername", "Auteur"}, {"commentsCount", "Commentaires"},
        {"activePlayers", "Joueurs connectés"}, {"botsCount", "Nombre de bots"},
        {"gameType", "Type de jeu"}, {"isPrivate", "Salle privée"},
        {"maxPlayers", "Nombre maximal de joueurs"},
        {"ownerUsername", "Propriétaire"}, {"playersCount", "Participants inscrits"},
        {"roomId", "Identifiant de salle"}, {"roomIds", "Identifiants des salles"},
        {"started", "Partie démarrée"}, {"spectatorOnly", "Spectateurs uniquement"},
        {"bots", "Bots"}, {"matched", "Salles trouvées"},
        {"deleted", "Éléments supprimés"}, {"delivered", "Destinataires atteints"},
        {"userId", "Identifiant utilisateur"}, {"messageId", "Identifiant du message"},
        {"reportId", "Identifiant du rapport"}, {"contactId", "Identifiant du contact"},
        {"categoryId", "Identifiant de catégorie"}, {"parentId", "Catégorie parente"},
        {"chatEnabled", "Tchat activé"}, {"chatSoundsEnabled", "Sons du tchat activés"},
        {"minPlayers", "Nombre minimal de joueurs"}, {"rules", "Règles"},
        {"createdBefore", "Créé avant"}, {"createdAfter", "Créé après"},
        {"temporaryPassword", "Mot de passe temporaire"},
        {"banReason", "Motif du bannissement"}, {"rolesUpdated", "Rôles modifiés"},
        {"assignments", "Affectations"}, {"answers", "Réponses"},
        {"correctIndex", "Index de la bonne réponse"}, {"handled", "Traité"},
        {"includeDeleted", "Inclure les éléments supprimés"},
        {"includePrivate", "Inclure les salles privées"},
        {"includeStarted", "Inclure les parties démarrées"},
        {"joinableOnly", "Salles intégrables uniquement"},
        {"dryRun", "Simulation"}, {"olderThanMinutes", "Âge minimal en minutes"},
        {"autoCleanupEnabled", "Nettoyage automatique activé"},
        {"autoCleanupOlderThanMinutes", "Âge minimal du nettoyage automatique"},
        {"autoCleanupIntervalSeconds", "Intervalle du nettoyage en secondes"},
        {"autoCleanupLimit", "Limite du nettoyage"},
        {"chatHistoryLimit", "Taille de l’historique du tchat"},
        {"editWindowSeconds", "Délai de modification en secondes"},
        {"bioMinLength", "Longueur minimale de biographie"},
        {"bioMaxLength", "Longueur maximale de biographie"},
        {"botTurnDelayMs", "Délai d’un tour de bot en millisecondes"},
        {"botStartDelayMs", "Délai de démarrage du bot en millisecondes"},
        {"botDrawDelayMs", "Délai de pioche du bot en millisecondes"},
        {"generatedAt", "Généré le"}, {"windowSeconds", "Fenêtre en secondes"},
        {"count", "Nombre"}, {"averageMs", "Moyenne en millisecondes"},
        {"p95Ms", "95e centile en millisecondes"},
        {"maxMs", "Maximum en millisecondes"}, {"lastAt", "Dernière mesure le"},
        {"lastValue", "Dernière valeur"}, {"file", "Fichier"},
        {"lines", "Lignes"}, {"logs", "Journaux"}, {"tail", "Nombre de lignes"},
        {"statusCode", "Code de réponse"}, {"scheduled", "Planifié"},
        {"service", "Service"}, {"unit", "Unité système"}, {"command", "Commande"},
        {"state", "État"}, {"activeState", "État du service"},
        {"subState", "Sous-état du service"}, {"loadState", "État du chargement"},
    };
    for (const auto& [value, label] : Known)
        if (key == value) return std::string(label);
    std::string result;
    for (const auto character : key)
    {
        if (character == '_' || character == '-') result += ' ';
        else if (std::isupper(static_cast<unsigned char>(character)) != 0)
        {
            result += ' ';
            result += static_cast<char>(std::tolower(static_cast<unsigned char>(character)));
        }
        else result += character;
    }
    if (!result.empty()) result.front() = static_cast<char>(std::toupper(
        static_cast<unsigned char>(result.front())));
    return result;
}

std::string Scalar(const nlohmann::json& value)
{
    if (value.is_string()) return value.get<std::string>();
    if (value.is_boolean()) return value.get<bool>() ? "Oui" : "Non";
    if (value.is_null()) return "—";
    return value.dump();
}

std::string ScalarForKey(std::string_view key, const nlohmann::json& value)
{
    if ((key == "status" || key == "state" || key == "activeState" ||
         key == "subState" || key == "loadState") && value.is_string())
    {
        const auto status = value.get<std::string>();
        static const std::pair<std::string_view, std::string_view> Statuses[]{
            {"active", "Actif"}, {"banned", "Banni"}, {"open", "Ouvert"},
            {"in_progress", "En cours"}, {"handled", "Traité"},
            {"pending", "En attente"}, {"to_test", "À tester"},
            {"done", "Terminé"}, {"refused", "Refusé"},
            {"validated", "Validé"}, {"to_edit", "À modifier"},
            {"trash", "Corbeille"}, {"construction", "En construction"},
            {"finished", "Terminé"}, {"beta", "Bêta"}, {"setup", "Préparation"},
            {"waiting", "En attente de joueurs"}, {"ready", "Prête"},
            {"started", "En cours"}, {"closed", "Fermée"},
            {"up", "Disponible"}, {"down", "Indisponible"},
            {"online", "En ligne"}, {"offline", "Hors ligne"},
            {"inactive", "Inactif"}, {"failed", "Échec"},
        };
        for (const auto& [raw, label] : Statuses)
            if (status == raw) return std::string(label);
    }
    return Scalar(value);
}

std::string ItemTitle(const nlohmann::json& value, std::size_t index)
{
    constexpr std::string_view Keys[]{"username", "name", "title", "subject", "id", "type"};
    if (value.is_object())
    {
        const auto subject = value.find("subject");
        const auto status = value.find("status");
        if (subject != value.end() && subject->is_string() &&
            status != value.end() && status->is_string())
        {
            auto title = Scalar(*subject) + " — " + ScalarForKey("status", *status);
            const auto author = value.find("createdByUsername");
            if (author != value.end() && author->is_string())
                title += " — " + Scalar(*author);
            return title;
        }
        for (const auto key : Keys)
        {
            const auto found = value.find(key);
            if (found != value.end() && (found->is_string() || found->is_number()))
                return Scalar(*found);
        }
    }
    if (value.is_primitive()) return Scalar(value);
    return "Élément " + std::to_string(index + 1);
}

std::pair<std::string_view, const nlohmann::json*> FindPrimaryList(
    const nlohmann::json& payload)
{
    if (payload.is_array()) return {"Résultats", &payload};
    if (!payload.is_object()) return {{}, nullptr};
    constexpr std::string_view Keys[]{
        "items", "users", "rooms", "messages", "games", "categories",
        "questions", "definitions", "roles", "events", "sounds", "sections", "names", "reports"};
    for (const auto key : Keys)
    {
        const auto found = payload.find(key);
        if (found != payload.end() && found->is_array()) return {key, &*found};
    }
    return {{}, nullptr};
}

void Append(std::ostringstream& output, const nlohmann::json& value, int depth);

void AppendObject(std::ostringstream& output, const nlohmann::json& value, int depth)
{
    const std::string indentation(static_cast<std::size_t>(depth) * 2, ' ');
    for (const auto& item : value.items())
    {
        output << indentation << Humanize(item.key()) << " : ";
        if (item.value().is_primitive())
            output << ScalarForKey(item.key(), item.value()) << '\n';
        else
        {
            output << '\n';
            Append(output, item.value(), depth + 1);
        }
    }
}

void AppendArray(std::ostringstream& output, const nlohmann::json& value, int depth)
{
    const std::string indentation(static_cast<std::size_t>(depth) * 2, ' ');
    output << indentation << value.size() << " élément" << (value.size() > 1 ? "s" : "") << '\n';
    for (std::size_t index = 0; index < value.size(); ++index)
    {
        output << indentation << "• " << ItemTitle(value[index], index) << '\n';
        if (value[index].is_object()) AppendObject(output, value[index], depth + 1);
        else if (value[index].is_array()) AppendArray(output, value[index], depth + 1);
        else output << indentation << "  " << Scalar(value[index]) << '\n';
        if (index + 1 != value.size()) output << '\n';
    }
}

void Append(std::ostringstream& output, const nlohmann::json& value, int depth)
{
    if (value.is_object()) AppendObject(output, value, depth);
    else if (value.is_array()) AppendArray(output, value, depth);
    else output << Scalar(value) << '\n';
}
}

std::string FormatAdminResult(const nlohmann::json& payload)
{
    std::ostringstream output;
    Append(output, payload, 0);
    auto result = output.str();
    if (result.empty()) result = "Opération terminée sans contenu.";
    return result;
}

AdminResultPresentation BuildAdminResultPresentation(const nlohmann::json& payload)
{
    AdminResultPresentation presentation;
    const auto [key, list] = FindPrimaryList(payload);
    if (list == nullptr)
    {
        presentation.details = FormatAdminResult(payload);
        presentation.summary = "Résultat disponible en lecture seule.";
        return presentation;
    }

    const auto label = key == "Résultats" ? std::string(key) : Humanize(key);
    presentation.summary = label + " : " + std::to_string(list->size()) + " élément" +
        (list->size() > 1 ? "s." : ".");
    presentation.entries.reserve(list->size());
    for (std::size_t index = 0; index < list->size(); ++index)
    {
        presentation.entries.push_back({
            std::to_string(index + 1) + ". " + ItemTitle((*list)[index], index),
            FormatAdminResult((*list)[index]),
        });
    }
    presentation.details = presentation.entries.empty()
        ? "La liste est vide." : presentation.entries.front().details;
    return presentation;
}
}
