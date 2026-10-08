#include "app/navigation/presentation/HostFrame.h"

#ifdef __WXMSW__

#include <utility>

namespace lila::app::navigation
{
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
    // Let the native focus announcement carry both title and item. A separate
    // controller utterance races with NVDA's processing of the focus event.
    // Keep this context until interaction, a focus change or deactivation:
    // NVDA can query accessible names after any number of UI event-loop turns.
    if (focusWhenFinished) focusWhenFinished(true);
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
