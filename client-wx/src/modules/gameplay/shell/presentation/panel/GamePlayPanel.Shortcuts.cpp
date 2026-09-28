#include "modules/gameplay/shell/presentation/panel/GamePlayPanel.h"

#include <utility>

#include <wx/button.h>
#include <wx/choicdlg.h>
#include <wx/listbox.h>

#include "modules/gameplay/grid/application/GameGridCoordinate.h"
#include "modules/gameplay/shortcuts/presentation/GameShortcutResolver.h"
#include "shared/logging/application/Logger.h"
#include "shared/text/presentation/encoding/Encoding.h"

namespace lila::modules::gameplay::presentation
{
bool GamePlayPanel::HandleShortcut(const std::string& normalizedKey)
{
    const auto* found = shortcuts::GameShortcutResolver::Find(state_, lines_, normalizedKey);
    if (found == nullptr)
    {
        lila::shared::logging::LogInfo("GameInput", "No server shortcut for key=" + normalizedKey);
        return false;
    }
    if (found->kind == domain::GameShortcutKind::Interface)
        return HandleInterfaceShortcut(found->id);
    if (found->kind != domain::GameShortcutKind::Action) return false;
    auto action = ResolveShortcutAction(found->actionType);
    if (!action)
    {
        lila::shared::logging::LogWarning(
            "GameInput", "Shortcut action is unavailable for key=" + normalizedKey);
        return true;
    }
    if (action->payload.contains("orientation"))
    {
        std::vector<domain::GameAction> candidates;
        wxArrayString labels;
        for (const auto& candidate : state_.actions)
        {
            if (candidate.disabled || candidate.type != action->type) continue;
            const auto& payload = candidate.payload;
            if (!payload.contains("x") || !payload["x"].is_number_integer() ||
                !payload.contains("y") || !payload["y"].is_number_integer() ||
                !payload.contains("orientation") || !payload["orientation"].is_string()) continue;
            const auto orientation = payload["orientation"].get<std::string>();
            if (orientation != "h" && orientation != "v") continue;
            const auto coordinate = application::grid::GridCoordinate(
                payload["x"].get<int>(), payload["y"].get<int>());
            labels.Add(lila::shared::text::FromUtf8("Mur " + std::string(
                orientation == "h" ? "horizontal sous " : "vertical à droite de ") + coordinate));
            candidates.push_back(candidate);
        }
        if (candidates.empty()) return true;
        const auto version = state_.version;
        const auto run = state_.runId;
        wxSingleChoiceDialog dialog(this, L"Choisissez un emplacement et une orientation.",
            L"Poser un mur", labels);
        if (auto* button = wxDynamicCast(dialog.FindWindow(wxID_OK), wxButton)) button->SetLabel(L"Poser");
        if (auto* button = wxDynamicCast(dialog.FindWindow(wxID_CANCEL), wxButton)) button->SetLabel(L"Annuler");
        if (dialog.ShowModal() != wxID_OK) return true;
        if (version != state_.version || run != state_.runId)
        {
            UpdateStatus(L"Le plateau a changé. Choisissez de nouveau votre mur.", true, true);
            return true;
        }
        const auto selection = dialog.GetSelection();
        if (selection < 0 || static_cast<std::size_t>(selection) >= candidates.size()) return true;
        action = candidates[static_cast<std::size_t>(selection)];
    }
    lila::shared::logging::LogInfo(
        "GameInput", "Shortcut action resolved: key=" + normalizedKey + ", type=" + action->type);
    PrepareAndExecuteAction(std::move(*action));
    return true;
}

std::optional<domain::GameAction> GamePlayPanel::ResolveShortcutAction(
    const std::string& actionType) const
{
    return shortcuts::GameShortcutResolver::ResolveAction(
        state_, lines_, actionType, linesList_->GetSelection());
}

std::string GamePlayPanel::NormalizeKey(const wxKeyEvent& event) const
{
    return shortcuts::GameShortcutResolver::NormalizeKey(event);
}
}
