#include "app/navigation/presentation/HostFrame.h"

#ifdef __WXMSW__

#include <optional>
#include <utility>

#include <wx/weakref.h>

#include "shared/concurrency/application/BackgroundExecutor.h"
#include "shared/logging/application/Logger.h"
#include "shared/ui/presentation/BackgroundTask.h"

namespace lila::app::navigation
{
void HostFrame::BeginInitialFocusAnnouncement()
{
    initialFocusTitle_ = GetTitle();
    if (!initialFocusTitle_.empty()) SetTitle(wxString());
}

void HostFrame::CompleteInitialFocusAnnouncement(InitialFocusHandler focusWhenFinished)
{
    if (initialFocusTitle_.empty())
    {
        if (focusWhenFinished) focusWhenFinished();
        return;
    }

    const wxString title = std::exchange(initialFocusTitle_, wxString());
    const auto announcer = screenReader_;
    if (announcer == nullptr)
    {
        SetTitle(title);
        return;
    }

    const wxWeakRef<HostFrame> weakFrame(this);
    initialAnnouncementTask_ = lila::shared::ui::RunBackgroundTaskWithResult<bool>(
        this,
        [announcer, speech = title.ToStdWstring()]()
        {
            return announcer->SpeakAndWait(speech);
        },
        [weakFrame, title, focus = std::move(focusWhenFinished)](
            std::string error, std::optional<bool> spoken) mutable
        {
            auto* frame = weakFrame.get();
            if (frame == nullptr) return;
            frame->initialAnnouncementTask_.reset();
            frame->SetTitle(title);
            if (!error.empty() || !spoken.value_or(false))
            {
                lila::shared::logging::LogWarning(
                    "Startup", "NVDA n'a pas confirmé la fin de l'annonce initiale.");
                return;
            }
            frame->activationFocusContext_.Clear();
            if (focus) focus();
        },
        "L'annonce initiale par NVDA a échoué.",
        concurrency::BackgroundTaskPriority::High);

    if (!initialAnnouncementTask_->WasAccepted())
    {
        initialAnnouncementTask_.reset();
        SetTitle(title);
        lila::shared::logging::LogWarning(
            "Startup", "La tâche d'annonce initiale n'a pas pu démarrer.");
    }
}
}

#else

namespace lila::app::navigation
{
void HostFrame::BeginInitialFocusAnnouncement()
{
}

void HostFrame::CompleteInitialFocusAnnouncement(InitialFocusHandler focusWhenFinished)
{
    if (focusWhenFinished) focusWhenFinished();
}
}

#endif
