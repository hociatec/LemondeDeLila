#include "modules/gameplay/information/application/GameValueTextBuilder.h"

#include <cctype>
#include <cmath>
#include <map>
#include <sstream>

namespace lila::modules::gameplay::application::info
{
std::string HumanLabel(std::string id)
{
    static const std::map<std::string, std::string> labels{
        {"remainingMs", "Temps restant"}, {"deadlineMs", "Échéance"},
        {"skipTurnsByPlayer", "Tours à passer"}, {"extraTurnsByPlayer", "Tours supplémentaires"},
        {"playerId", "Joueur"}, {"ownerId", "Propriétaire"}, {"sourcePlayerId", "Joueur source"},
        {"cardId", "Carte"}, {"itemId", "Objet"}, {"resourceId", "Ressource"},
        {"count", "Quantité"}, {"value", "Valeur"}, {"total", "Total"},
        {"phase", "Phase"}, {"status", "État"}, {"remaining", "Restant"},
        {"playing", "En cours"}, {"started", "Démarrée"}, {"finished", "Terminée"},
        {"coins", "Pièces"}, {"points", "Points"}, {"cards", "Cartes"}};
    if (const auto found = labels.find(id); found != labels.end()) return found->second;
    std::string result;
    result.reserve(id.size() + 4);
    for (std::size_t index = 0; index < id.size(); ++index)
    {
        const char ch = id[index];
        if (ch == '_' || ch == '-' || ch == '.') result += ' ';
        else
        {
            if (index > 0 && std::isupper(static_cast<unsigned char>(ch)) &&
                !result.empty() && result.back() != ' ') result += ' ';
            result += static_cast<char>(std::tolower(static_cast<unsigned char>(ch)));
        }
    }
    if (!result.empty()) result[0] = static_cast<char>(std::toupper(
        static_cast<unsigned char>(result[0])));
    return result;
}

std::string ValueLines(const domain::GameValue& value, const std::string& prefix)
{
    std::ostringstream out;
    if (const auto* boolean = std::get_if<bool>(&value.value)) out << (*boolean ? "oui" : "non");
    else if (const auto* number = std::get_if<double>(&value.value))
    {
        if (std::trunc(*number) == *number) out << static_cast<long long>(*number);
        else out << *number;
    }
    else if (const auto* text = std::get_if<std::string>(&value.value)) out << *text;
    else if (const auto* array = std::get_if<domain::GameValue::Array>(&value.value))
        for (const auto& item : *array) out << prefix << "- " << ValueLines(item, prefix + "  ") << '\n';
    else if (const auto* object = std::get_if<domain::GameValue::Object>(&value.value))
        for (const auto& [key, item] : *object)
        {
            out << prefix << HumanLabel(key);
            if (std::holds_alternative<domain::GameValue::Array>(item.value) ||
                std::holds_alternative<domain::GameValue::Object>(item.value))
                out << '\n' << ValueLines(item, prefix + "  ");
            else out << " : " << ValueLines(item) << '\n';
        }
    else out << "non renseigné";
    return out.str();
}
}
