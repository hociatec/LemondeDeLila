#include "modules/gameplay/shell/presentation/panel/GamePlayPanel.h"

#include <algorithm>
#include <wx/string.h>

#include "modules/gameplay/shell/presentation/formatting/GamePlayFormatters.h"

namespace lila::modules::gameplay::presentation
{
void GamePlayPanel::UpdateTimerAnnouncements()
{
    if (!state_.timers.is_object()) return;
    for (const auto& timer : state_.timers.items())
    {
        if (!timer.value().is_object()) continue;
        const auto remaining = timer.value().find("remainingMs");
        const auto deadline = timer.value().find("deadlineMs");
        if (remaining == timer.value().end() || !remaining->is_number_integer() ||
            deadline == timer.value().end() || !deadline->is_number_integer()) continue;
        const auto milliseconds = std::max<long long>(0, remaining->get<long long>());
        if (milliseconds > 10000) continue;
        const auto key = timer.key() + ":" + std::to_string(deadline->get<long long>());
        if (!announcedTimers_.insert(key).second) continue;
        const auto seconds = (milliseconds + 999) / 1000;
        const auto message = FromUtf8(
            timer.key() + " : " + std::to_string(seconds) + " seconde(s) restantes.");
        UpdateStatus(message, false, true);
        if (onHistoryMessage_) onHistoryMessage_(message);
    }
}
}
