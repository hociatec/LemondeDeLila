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
        {"games", "Jeux"}, {"categories", "Catégories"},
        {"questions", "Questions"}, {"definitions", "Définitions"},
        {"roles", "Rôles"}, {"permissions", "Permissions"},
        {"events", "Événements"}, {"sections", "Fils de contact"},
        {"names", "Noms de bots"}, {"page", "Page"}, {"limit", "Par page"},
        {"content", "Contenu"}, {"reason", "Motif"},
        {"bannedUntil", "Banni jusqu’au"}, {"createdBy", "Créé par"},
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
    if (key == "status" && value.is_string())
    {
        const auto status = value.get<std::string>();
        static const std::pair<std::string_view, std::string_view> Statuses[]{
            {"active", "Actif"}, {"banned", "Banni"}, {"open", "Ouvert"},
            {"in_progress", "En cours"}, {"handled", "Traité"},
            {"pending", "En attente"}, {"to_test", "À tester"},
            {"done", "Terminé"}, {"refused", "Refusé"},
            {"validated", "Validé"}, {"to_edit", "À modifier"},
            {"trash", "Corbeille"}, {"construction", "En construction"},
            {"finished", "Terminé"}, {"beta", "Bêta"},
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
        for (const auto key : Keys)
        {
            const auto found = value.find(key);
            if (found != value.end() && (found->is_string() || found->is_number()))
                return Scalar(*found);
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
        "questions", "definitions", "roles", "events", "sections", "names"};
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
