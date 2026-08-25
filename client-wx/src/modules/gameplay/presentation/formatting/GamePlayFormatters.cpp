#include "modules/gameplay/presentation/formatting/GamePlayFormatters.h"

#include <sstream>

#include <nlohmann/json.hpp>

#include "shared/text/presentation/encoding/Encoding.h"

namespace lila::modules::gameplay::presentation
{
namespace
{
std::string ReadJsonString(const nlohmann::json& object, const char* field)
{
    const auto found = object.find(field);
    return found != object.end() && found->is_string() ? found->get<std::string>() : std::string{};
}
}

wxString FromUtf8(const std::string& value)
{
    return lila::shared::text::FromUtf8(value);
}

std::string JsonToDisplay(const nlohmann::json& value)
{
    if (value.is_null()) return {};
    if (value.is_string()) return value.get<std::string>();
    if (value.is_number_integer()) return std::to_string(value.get<int>());
    if (value.is_boolean()) return value.get<bool>() ? "oui" : "non";
    return value.dump(2);
}

std::string PanelJsonToDisplay(const nlohmann::json& value)
{
    if (!value.is_object()) return JsonToDisplay(value);
    const auto title = ReadJsonString(value, "title");
    const auto message = ReadJsonString(value, "message");
    if (title.empty() && message.empty()) return JsonToDisplay(value);
    if (title.empty()) return message;
    if (message.empty()) return title;
    return title + "\n" + message;
}

void AppendJsonObjectLines(std::ostringstream& out, const nlohmann::json& object)
{
    if (!object.is_object()) return;
    for (const auto& item : object.items())
    {
        out << item.key() << " : " << JsonToDisplay(item.value()) << '\n';
    }
}
}
