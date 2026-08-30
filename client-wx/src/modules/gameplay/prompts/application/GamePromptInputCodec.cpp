#include "modules/gameplay/prompts/application/GamePromptInputCodec.h"

#include <algorithm>
#include <cctype>
#include <cmath>
#include <locale>
#include <sstream>

namespace lila::modules::gameplay::application
{
namespace
{
std::string Trim(std::string value)
{
    const auto notSpace = [](unsigned char ch) { return std::isspace(ch) == 0; };
    value.erase(value.begin(), std::find_if(value.begin(), value.end(), notSpace));
    value.erase(std::find_if(value.rbegin(), value.rend(), notSpace).base(), value.end());
    return value;
}

std::string ToLower(std::string value)
{
    std::transform(value.begin(), value.end(), value.begin(),
        [](unsigned char ch) { return static_cast<char>(std::tolower(ch)); });
    return value;
}

GamePromptInputResult Invalid(std::string message)
{
    return {false, nullptr, std::move(message)};
}
}

GamePromptInputResult GamePromptInputCodec::Parse(
    const domain::GamePromptField& field,
    std::string rawValue)
{
    const auto kind = ToLower(Trim(field.kind));
    if (field.optional && Trim(rawValue).empty())
        return {true, nullptr, {}};
    if (kind == "number")
    {
        const auto text = Trim(std::move(rawValue));
        double value = 0.0;
        std::istringstream input(text);
        input.imbue(std::locale::classic());
        input >> std::noskipws >> value;
        if (text.empty() || input.fail() || !input.eof() || !std::isfinite(value))
            return Invalid("Saisissez un nombre.");
        if (field.integer && std::trunc(value) != value)
            return Invalid("Saisissez un nombre entier.");
        if (field.minimum && value < *field.minimum)
            return Invalid("La valeur minimale est " + std::to_string(*field.minimum) + ".");
        if (field.maximum && value > *field.maximum)
            return Invalid("La valeur maximale est " + std::to_string(*field.maximum) + ".");
        return field.integer
            ? GamePromptInputResult{true, static_cast<long long>(value), {}}
            : GamePromptInputResult{true, value, {}};
    }

    if (kind == "array" || kind == "object" || kind == "json")
    {
        auto value = nlohmann::json::parse(rawValue, nullptr, false);
        if (value.is_discarded()) return Invalid("Saisissez une valeur JSON valide.");
        if (kind == "array" && !value.is_array()) return Invalid("Une liste JSON est attendue.");
        if (kind == "object" && !value.is_object()) return Invalid("Un objet JSON est attendu.");
        if (field.minimum && value.is_array() && value.size() < static_cast<std::size_t>(*field.minimum))
            return Invalid("La liste est trop courte.");
        if (field.maximum && value.is_array() && value.size() > static_cast<std::size_t>(*field.maximum))
            return Invalid("La liste est trop longue.");
        return {true, std::move(value), {}};
    }

    if (kind == "boolean")
    {
        const auto text = ToLower(Trim(std::move(rawValue)));
        if (text == "oui" || text == "yes" || text == "true" || text == "1" || text == "on")
            return {true, true, {}};
        if (text == "non" || text == "no" || text == "false" || text == "0" || text == "off")
            return {true, false, {}};
        return Invalid("Répondez par oui ou non.");
    }

    return {true, std::move(rawValue), {}};
}
}
