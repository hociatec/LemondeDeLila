#include "modules/gameplay/shortcuts/presentation/GameShortcutResolver.h"

#include <algorithm>
#include <wx/event.h>

#include "modules/gameplay/shell/presentation/formatting/GamePlayFormatters.h"

namespace lila::modules::gameplay::presentation::shortcuts
{
namespace
{
const domain::GameShortcut* FindAvailableAction(
    const domain::GameState& state,
    const std::vector<domain::GameLine>& lines,
    const std::string& normalizedKey)
{
    const auto found = std::find_if(
        state.system.shortcuts.begin(), state.system.shortcuts.end(),
        [&state, &lines, &normalizedKey](const domain::GameShortcut& shortcut)
        {
            return shortcut.normalizedKey == normalizedKey &&
                shortcut.kind == domain::GameShortcutKind::Action &&
                GameShortcutResolver::ResolveAction(
                    state, lines, shortcut.actionType, -1).has_value();
        });
    return found == state.system.shortcuts.end() ? nullptr : &*found;
}

const domain::GameShortcut* FindInterface(
    const domain::GameState& state,
    const std::string& normalizedKey)
{
    const auto found = std::find_if(
        state.system.shortcuts.begin(), state.system.shortcuts.end(),
        [&normalizedKey](const domain::GameShortcut& shortcut)
        {
            return shortcut.normalizedKey == normalizedKey &&
                shortcut.kind == domain::GameShortcutKind::Interface;
        });
    return found == state.system.shortcuts.end() ? nullptr : &*found;
}
}

const domain::GameShortcut* GameShortcutResolver::Find(
    const domain::GameState& state,
    const std::vector<domain::GameLine>& lines,
    const std::string& normalizedKey)
{
    // A currently available game action wins over an interface panel using the same key.
    if (const auto* action = FindAvailableAction(state, lines, normalizedKey)) return action;
    return FindInterface(state, normalizedKey);
}

std::optional<domain::GameAction> GameShortcutResolver::ResolveAction(
    const domain::GameState& state,
    const std::vector<domain::GameLine>& lines,
    const std::string& actionType,
    int selectedLine)
{
    if (actionType.empty()) return std::nullopt;
    if (selectedLine >= 0 && static_cast<std::size_t>(selectedLine) < lines.size())
    {
        const auto& line = lines[static_cast<std::size_t>(selectedLine)];
        if (line.actionIndex < state.actions.size() &&
            state.actions[line.actionIndex].type == actionType &&
            !state.actions[line.actionIndex].disabled)
            return state.actions[line.actionIndex];
    }
    const auto found = std::find_if(
        state.actions.begin(), state.actions.end(),
        [&actionType](const domain::GameAction& action)
        {
            return action.type == actionType && !action.disabled;
        });
    return found == state.actions.end() ? std::nullopt : std::optional<domain::GameAction>(*found);
}

std::string GameShortcutResolver::NormalizeKey(const wxKeyEvent& event)
{
    if (event.ControlDown() || event.AltDown() || event.MetaDown()) return {};

    const int key = event.GetKeyCode();
    if (key == WXK_RETURN || key == WXK_NUMPAD_ENTER) return "ENTER";
    if (key == WXK_SPACE || key == WXK_NUMPAD_SPACE) return "SPACE";
    if (key == WXK_BACK) return "BACK";
    if (key == WXK_F5) return "F5";
    if (key >= 'A' && key <= 'Z')
    {
        const std::string letter(1, static_cast<char>(key));
        return event.ShiftDown() ? "SHIFT+" + letter : letter;
    }
    if (key >= 'a' && key <= 'z')
    {
        const std::string letter(1, static_cast<char>(key - 'a' + 'A'));
        return event.ShiftDown() ? "SHIFT+" + letter : letter;
    }
    if (key >= '0' && key <= '9') return std::string(1, static_cast<char>(key));
    if (key >= WXK_NUMPAD0 && key <= WXK_NUMPAD9)
        return std::string(1, static_cast<char>('0' + key - WXK_NUMPAD0));
    return {};
}

wxString GameShortcutResolver::BuildHelpText(const domain::GameState& state)
{
    wxString result;
    for (const auto& shortcut : state.system.shortcuts)
    {
        if (!result.empty()) result += wxString(L" | ");
        result += FromUtf8(shortcut.normalizedKey);
        if (shortcut.kind == domain::GameShortcutKind::Interface)
            result += wxString(L" ") + FromUtf8(shortcut.id);
        else if (shortcut.kind == domain::GameShortcutKind::Action)
            result += wxString(L" ") + FromUtf8(shortcut.actionType);
    }
    return result;
}
}
