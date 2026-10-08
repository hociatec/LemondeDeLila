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
void HostFrame::FinishInitialFocus(InitialFocusHandler focus, bool speakFallback)
{
    if (focus) focus(speakFallback);
    const wxWeakRef<HostFrame> weakFrame(this);
    CallAfter([weakFrame, speakFallback]()
    {
        auto* frame = weakFrame.get();
        if (frame == nullptr) return;
        if (speakFallback && frame->screenReader_ != nullptr)
        {
            const wxString announcement = frame->activationFocusContext_.Announcement();
            if (!announcement.empty())
                static_cast<void>(frame->screenReader_->Speak(announcement.ToStdWstring()));
        }
        frame->activationFocusContext_.Clear();
    });
}

void HostFrame::BeginInitialFocusAnnouncement()
{
    initialFocusTitle_ = GetTitle();
}

void HostFrame::CompleteInitialFocusAnnouncement(InitialFocusHandler focusWhenFinished)
{
    if (initialFocusTitle_.empty())
    {
        if (focusWhenFinished) focusWhenFinished(false);
        return;
    }

    const wxString title = std::exchange(initialFocusTitle_, wxString());
    // Restore the real window title before speech starts so it remains exposed
    // to Windows, Alt+Tab and screen-reader window navigation at all times.
    SetTitle(title);
    const auto announcer = screenReader_;
    if (announcer == nullptr)
    {
        FinishInitialFocus(std::move(focusWhenFinished), true);
        return;
    }

    const wxWeakRef<HostFrame> weakFrame(this);
    initialAnnouncementTask_ = lila::shared::ui::RunBackgroundTaskWithResult<bool>(
        this,
        [announcer, speech = title.ToStdWstring()]()
        {
            return announcer->SpeakAndWait(speech);
        },
        [weakFrame, focus = focusWhenFinished](
            std::string error, std::optional<bool> spoken) mutable
        {
            auto* frame = weakFrame.get();
            if (frame == nullptr) return;
            frame->initialAnnouncementTask_.reset();
            const bool synchronousAnnouncementCompleted =
                error.empty() && spoken.value_or(false);
            if (!synchronousAnnouncementCompleted)
            {
                lila::shared::logging::LogWarning(
                    "Startup",
                    "Annonce NVDA synchrone indisponible; utilisation du focus accessible.");
            }
            frame->FinishInitialFocus(
                std::move(focus), !synchronousAnnouncementCompleted);
        },
        "L'annonce initiale par NVDA a échoué.",
        concurrency::BackgroundTaskPriority::High);

    if (!initialAnnouncementTask_->WasAccepted())
    {
        initialAnnouncementTask_.reset();
        lila::shared::logging::LogWarning(
            "Startup", "La tâche d'annonce initiale n'a pas pu démarrer.");
        FinishInitialFocus(std::move(focusWhenFinished), true);
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
    if (focusWhenFinished) focusWhenFinished(false);
}
}

#endif
