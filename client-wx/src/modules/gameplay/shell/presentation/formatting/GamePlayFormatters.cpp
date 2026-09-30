#include "modules/gameplay/shell/presentation/formatting/GamePlayFormatters.h"

#include "modules/gameplay/information/application/GameValueTextBuilder.h"
#include "shared/text/presentation/encoding/Encoding.h"

namespace lila::modules::gameplay::presentation
{
namespace
{
std::string ObjectText(const domain::GameValue::Object& object, const char* field)
{
    const auto found = object.find(field);
    if (found == object.end()) return {};
    const auto* text = found->second.Text();
    return text == nullptr ? std::string{} : *text;
}
}

wxString FromUtf8(const std::string& value)
{
    return lila::shared::text::FromUtf8(value);
}

std::string CurrentPlayerLabel(const domain::GameState& state)
{
    if (!state.system.turn.currentPlayerId) return {};
    const int playerId = *state.system.turn.currentPlayerId;
    for (const auto& player : state.system.players)
        if (player.id == playerId) return player.username;
    return "Joueur " + std::to_string(playerId);
}

std::string TurnLabel(const domain::GameState& state)
{
    const auto player = CurrentPlayerLabel(state);
    return player.empty() ? "Aucun tour actif" : "Tour de " + player;
}

std::string GameValueToDisplay(const domain::GameValue& value)
{
    if (std::holds_alternative<std::monostate>(value.value)) return {};
    return application::info::ValueLines(value);
}

std::string PanelGameValueToDisplay(const domain::GameValue& value)
{
    const auto* object = value.ObjectValue();
    if (object == nullptr) return GameValueToDisplay(value);
    const auto title = ObjectText(*object, "title");
    const auto message = ObjectText(*object, "message");
    if (title.empty() && message.empty()) return GameValueToDisplay(value);
    if (title.empty()) return message;
    if (message.empty()) return title;
    return title + "\n" + message;
}

}
