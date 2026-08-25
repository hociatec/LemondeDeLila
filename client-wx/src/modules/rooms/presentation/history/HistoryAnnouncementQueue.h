#pragma once

#include <deque>
#include <memory>

#include <wx/event.h>
#include <wx/string.h>
#include <wx/timer.h>

class wxStaticText;
class wxWindow;

namespace lila::shared::accessibility { class NvdaScreenReaderAnnouncer; }

namespace lila::modules::rooms::presentation::history
{
class HistoryAnnouncementQueue final : public wxEvtHandler
{
public:
    explicit HistoryAnnouncementQueue(wxWindow* parent);
    ~HistoryAnnouncementQueue() override;

    [[nodiscard]] wxStaticText* Control() const noexcept;
    void Enqueue(const wxString& message);
    void Reset();

private:
    void AnnounceNext();

    wxStaticText* liveRegion_ = nullptr;
    std::deque<wxString> pending_;
    wxString lastAnnounced_;
    wxTimer timer_;
    std::unique_ptr<lila::shared::accessibility::NvdaScreenReaderAnnouncer> screenReader_;
};
}
