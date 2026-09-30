#pragma once

#include <wx/debug.h>
#include <wx/thread.h>

namespace lila::shared::ui
{
inline void AssertUiThread()
{
    wxASSERT_MSG(wxIsMainThread(), "wxWidgets callback executed outside the UI thread");
}
}
