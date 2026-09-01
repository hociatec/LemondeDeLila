#include "modules/gameplay/shell/presentation/panel/GamePlayPanel.h"

#include <algorithm>
#include <wx/string.h>

#include "modules/gameplay/information/application/GameValueTextBuilder.h"
#include "modules/gameplay/shell/presentation/formatting/GamePlayFormatters.h"

namespace lila::modules::gameplay::presentation
{
void GamePlayPanel::UpdateTimerAnnouncements()
{
    for (const auto& timer : state_.timers)
    {
        if (!timer.remainingMs || !timer.deadlineMs) continue;
        const auto milliseconds = std::max<std::int64_t>(0, *timer.remainingMs);
        if (milliseconds > 10000) continue;
        const auto key = timer.id + ":" + std::to_string(*timer.deadlineMs);
        if (!announcedTimers_.insert(key).second) continue;
        const auto seconds = (milliseconds + 999) / 1000;
        auto label = timer.label;
        if (label.empty() && !timer.actionType.empty())
            label = application::info::HumanLabel(timer.actionType);
        if (label.empty()) label = application::info::HumanLabel(timer.id);
        const auto message = FromUtf8(
            label + " : " + std::to_string(seconds) + " seconde(s) restantes.");
        UpdateStatus(message, false, true);
        if (onHistoryMessage_) onHistoryMessage_(message, false);
    }
}
}
