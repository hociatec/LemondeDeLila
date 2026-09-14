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
        {"categories", "Catégories"}, {"questions", "Questions"},
        {"permissions", "Permissions"}, {"events", "Événements"},
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
    return "Élément " + std::to_string(index + 1);
}

void Append(std::ostringstream& output, const nlohmann::json& value, int depth);

void AppendObject(std::ostringstream& output, const nlohmann::json& value, int depth)
{
    const std::string indentation(static_cast<std::size_t>(depth) * 2, ' ');
    for (const auto& item : value.items())
    {
        output << indentation << Humanize(item.key()) << " : ";
        if (item.value().is_primitive()) output << Scalar(item.value()) << '\n';
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
}
