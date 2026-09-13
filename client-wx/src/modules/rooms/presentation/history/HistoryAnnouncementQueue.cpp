#include "modules/rooms/presentation/history/HistoryAnnouncementQueue.h"

#include <algorithm>

#include <wx/stattext.h>
#include <wx/window.h>

#include "shared/accessibility/presentation/AccessibilityUtils.h"
#include "shared/accessibility/infrastructure/NvdaScreenReaderAnnouncer.h"

namespace lila::modules::rooms::presentation::history
{
namespace
{
constexpr int SpeechStatePollMs = 75;
constexpr int MinimumLegacySpeechTimeMs = 700;
constexpr int MaximumLegacySpeechTimeMs = 10000;
constexpr int LegacyMillisecondsPerCharacter = 65;
const wxString AnnouncementAccessibleName(L"Annonces du jeu");

int LegacySpeechTime(const wxString& message)
{
    return std::clamp(
        static_cast<int>(message.length()) * LegacyMillisecondsPerCharacter,
        MinimumLegacySpeechTimeMs,
        MaximumLegacySpeechTimeMs);
}
}

HistoryAnnouncementQueue::HistoryAnnouncementQueue(wxWindow* parent)
    : liveRegion_(new wxStaticText(parent, wxID_ANY, wxString{})),
      timer_(this),
      screenReader_(std::make_unique<
          lila::shared::accessibility::NvdaScreenReaderAnnouncer>())
{
    liveRegion_->SetName(AnnouncementAccessibleName);
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
    if (screenReader_->IsSpeaking().value_or(false))
    {
        timer_.StartOnce(SpeechStatePollMs);
        return;
    }
    lastAnnounced_ = pending_.front();
    pending_.pop_front();

    if (!screenReader_->Speak(lastAnnounced_))
        lila::shared::accessibility::AccessibilityUtils::AnnounceLiveRegion(
            *liveRegion_, lastAnnounced_);
    timer_.StartOnce(LegacySpeechTime(lastAnnounced_));
}

void HistoryAnnouncementQueue::Reset()
{
    timer_.Stop();
    pending_.clear();
    lastAnnounced_.clear();
    liveRegion_->SetLabel(wxString{});
    liveRegion_->SetName(AnnouncementAccessibleName);
}
}
