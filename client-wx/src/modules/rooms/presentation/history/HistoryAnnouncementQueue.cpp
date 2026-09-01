#include "modules/rooms/presentation/history/HistoryAnnouncementQueue.h"

#include <wx/stattext.h>
#include <wx/window.h>

#include "shared/accessibility/presentation/AccessibilityUtils.h"
#include "shared/accessibility/infrastructure/NvdaScreenReaderAnnouncer.h"

namespace lila::modules::rooms::presentation::history
{
namespace
{
constexpr int AnnouncementSpacingMs = 150;
}

HistoryAnnouncementQueue::HistoryAnnouncementQueue(wxWindow* parent)
    : liveRegion_(new wxStaticText(parent, wxID_ANY, wxString{})),
      timer_(this),
      screenReader_(std::make_unique<
          lila::shared::accessibility::NvdaScreenReaderAnnouncer>())
{
    liveRegion_->SetName(wxString(L"Annonces du jeu"));
    liveRegion_->SetMinSize(wxSize(1, 1));
    liveRegion_->SetMaxSize(wxSize(1, 1));
    Bind(wxEVT_TIMER, [this](wxTimerEvent&) { AnnounceNext(); }, timer_.GetId());
}

HistoryAnnouncementQueue::~HistoryAnnouncementQueue()
{
    timer_.Stop();
}

wxStaticText* HistoryAnnouncementQueue::Control() const noexcept
{
    return liveRegion_;
}

void HistoryAnnouncementQueue::Enqueue(const wxString& message, bool allowRepeat)
{
    if (message.empty()) return;
    if (!allowRepeat &&
        ((!pending_.empty() && pending_.back() == message) ||
         (pending_.empty() && timer_.IsRunning() && lastAnnounced_ == message)))
        return;

    pending_.push_back(message);
    if (!timer_.IsRunning()) AnnounceNext();
}

void HistoryAnnouncementQueue::AnnounceNext()
{
    if (pending_.empty()) return;
    lastAnnounced_ = pending_.front();
    pending_.pop_front();

    if (!screenReader_->Speak(lastAnnounced_))
        lila::shared::accessibility::AccessibilityUtils::AnnounceLiveRegion(
            *liveRegion_, lastAnnounced_);
    timer_.StartOnce(AnnouncementSpacingMs);
}

void HistoryAnnouncementQueue::Reset()
{
    timer_.Stop();
    pending_.clear();
    lastAnnounced_.clear();
    liveRegion_->SetLabel(wxString{});
    liveRegion_->SetName(wxString{});
}
}
