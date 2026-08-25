#include "modules/gameplay/prompts/application/GamePromptInputCodec.h"

#include <algorithm>
#include <charconv>
#include <cctype>
#include <system_error>

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
    if (kind == "number")
    {
        const auto text = Trim(std::move(rawValue));
        int value = 0;
        const auto parsed = std::from_chars(text.data(), text.data() + text.size(), value);
        if (text.empty() || parsed.ec != std::errc{} || parsed.ptr != text.data() + text.size())
            return Invalid("Saisissez un nombre entier.");
        if (field.minimum && value < *field.minimum)
            return Invalid("La valeur minimale est " + std::to_string(*field.minimum) + ".");
        if (field.maximum && value > *field.maximum)
            return Invalid("La valeur maximale est " + std::to_string(*field.maximum) + ".");
        return {true, value, {}};
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
