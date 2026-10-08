#include "app/navigation/presentation/HostFrame.h"

#ifdef __WXMSW__

#include <utility>

#include <wx/weakref.h>

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
    // Keyboard and accessibility focus must never depend on NVDA finishing speech.
    // Expose the title together with the focused item, then announce without waiting.
    FinishInitialFocus(std::move(focusWhenFinished), true);
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
