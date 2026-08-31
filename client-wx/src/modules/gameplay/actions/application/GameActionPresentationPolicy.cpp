#include "modules/gameplay/actions/application/GameActionPresentationPolicy.h"

#include <cstddef>
#include <cctype>
#include <optional>
#include <sstream>
#include <vector>

#include "modules/gameplay/cards/application/GameCardActionResolver.h"
#include "modules/gameplay/dice/application/GameDiceActionResolver.h"

namespace lila::modules::gameplay::application
{
namespace
{
std::string PayloadKey(std::string key)
{
    if (key == "playerId") return "Joueur";
    if (key == "ownerId") return "Propriétaire";
    if (key == "cardId" || key == "card") return "Carte";
    if (key == "pawnId") return "Pion";
    if (key == "cellId") return "Case";
    if (key == "boardId") return "Plateau";
    std::string label;
    for (const char character : key)
    {
        if (character == '_' || character == '-' || character == '.') label += ' ';
        else
        {
            if (std::isupper(static_cast<unsigned char>(character)) && !label.empty()) label += ' ';
            label += static_cast<char>(std::tolower(static_cast<unsigned char>(character)));
        }
    }
    if (!label.empty()) label[0] = static_cast<char>(std::toupper(
        static_cast<unsigned char>(label[0])));
    return label;
}

std::string CompactPayloadLabel(const nlohmann::json& payload)
{
    if (!payload.is_object() || payload.empty()) return {};
    std::ostringstream out;
    bool first = true;
    for (const auto& item : payload.items())
    {
        if (!first) out << ", ";
        first = false;
        out << PayloadKey(item.key()) << " : ";
        if (item.value().is_string()) out << item.value().get<std::string>();
        else if (item.value().is_number_integer()) out << item.value().get<int>();
        else if (item.value().is_boolean()) out << (item.value().get<bool>() ? "true" : "false");
        else out << item.value().dump();
    }
    return out.str();
}

std::vector<domain::GameLine> BuildLines(const std::vector<domain::GameAction>& actions)
{
    std::vector<domain::GameLine> lines;
    lines.reserve(actions.size());
    for (std::size_t index = 0; index < actions.size(); ++index)
    {
        const auto& action = actions[index];
        domain::GameLine line;
        line.id = action.type + "|" + action.payload.dump();
        line.label = action.label.empty() ? action.type : action.label;
        const auto details = CompactPayloadLabel(action.payload);
        if (!details.empty()) line.label += " (" + details + ")";
        if (action.disabled) line.label += " — indisponible";
        line.detail = action.documentation;
        if (!details.empty())
            line.detail += (line.detail.empty() ? std::string{} : "\n") + details;
        line.kind = domain::GameLineKind::Action;
        line.actionIndex = index;
        line.enabled = !action.disabled;
        lines.push_back(std::move(line));
    }
    return lines;
}

void Mark(std::vector<bool>& represented, std::optional<std::size_t> index)
{
    if (index.has_value() && *index < represented.size()) represented[*index] = true;
}
}

std::vector<domain::GameLine> GameActionPresentationPolicy::GenericLines(
    const domain::GameState& state)
{
    std::vector<bool> represented(state.actions.size(), false);
    const auto& hand = state.kits.VisibleHand();
    for (std::size_t index = 0; index < hand.size(); ++index)
    {
        Mark(
            represented,
            cards::GameCardActionResolver::ResolveIndex(
                hand, state.actions, index));
    }

    if (const auto* diceState = state.kits.Dice())
    {
        const auto count = diceState->dice.empty()
            ? std::size_t{1}
            : diceState->dice.size();
        for (std::size_t index = 0; index < count; ++index)
        {
            const auto actionIndex = dice::GameDiceActionResolver::ResolveIndex(
                *diceState, state.actions, index);
            Mark(represented, actionIndex);
        }
    }

    std::vector<domain::GameLine> lines;
    const auto allLines = BuildLines(state.actions);
    lines.reserve(allLines.size());
    for (const auto& line : allLines)
    {
        if (line.actionIndex >= represented.size() || !represented[line.actionIndex])
            lines.push_back(line);
    }
    return lines;
}
}
