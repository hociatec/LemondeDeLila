#include "modules/admin/presentation/AdminFrame.h"
#include <algorithm>
#include <utility>
#include "shared/ui/presentation/controls/VerticalMenu.h"

namespace lila::modules::admin::presentation
{
void AdminFrame::SaveGameNavigation()
{
    if (gameResultCommand_ == nullptr) return;
    gameNavigation_.push_back({gameResultCommand_, gameResult_, gameResultPayload_,
        selectedResultIndex_.value_or(0), commandsMenu_->GetSelectedIndex(), showingItemActions_});
}

bool AdminFrame::RestoreGameNavigation()
{
    if (gameNavigation_.empty()) return false;
    auto entry = std::move(gameNavigation_.back());
    gameNavigation_.pop_back();
    RestoreAreaFromItem();
    activeRequestPayload_ = entry.payload;
    ResetPagination(*entry.command, entry.payload);
    ShowResult(*entry.command, entry.result);
    if (!resultItems_.empty())
    {
        const auto index = std::min(entry.resultIndex, resultItems_.size() - 1);
        resultsMenu_->SetSelectedIndexSilently(index);
        ShowResultDetails(index);
        if (entry.itemActions)
        {
            restoringGameNavigation_ = true;
            OpenResultActions(index);
            restoringGameNavigation_ = false;
            commandsMenu_->SetSelectedIndexSilently(entry.actionIndex);
            FocusCurrentMenu();
            return true;
        }
    }
    if (entry.command->id.starts_with("mnemo.")) commandsMenu_->Hide();
    Layout();
    FocusResult();
    return true;
}

}
