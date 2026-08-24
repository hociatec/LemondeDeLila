#include "modules/rooms/presentation/RoomPanel.h"

#include <wx/sizer.h>
#include <wx/stattext.h>
#include <wx/textctrl.h>

#include "modules/rooms/presentation/RoomGameZoneAnchor.h"
#include "shared/accessibility/presentation/AccessibilityUtils.h"
#include "shared/accessibility/presentation/ActionButton.h"
#include "shared/ui/presentation/theme/Theme.h"

namespace lila::modules::rooms::presentation
{
void RoomPanel::BuildLayout()
{
    SetBackgroundColour(lila::shared::ui::Theme::Background());
    auto* rootSizer = new wxBoxSizer(wxVERTICAL);

    auto* header = new wxBoxSizer(wxHORIZONTAL);
    gameNameLabel_ = new wxStaticText(this, wxID_ANY, wxString{});
    gameNameLabel_->SetFont(lila::shared::ui::Theme::TitleFont());
    gameNameLabel_->SetForegroundColour(lila::shared::ui::Theme::TextPrimary());
    auto* badge = new wxStaticText(this, wxID_ANY, wxString(L"Table de jeu"));
    badge->SetForegroundColour(lila::shared::ui::Theme::Accent());
    header->Add(gameNameLabel_, 0, wxALIGN_CENTER_VERTICAL | wxRIGHT, 16);
    header->Add(badge, 0, wxALIGN_CENTER_VERTICAL);
    rootSizer->Add(header, 0, wxEXPAND | wxALL, 20);

    auto* content = new wxBoxSizer(wxHORIZONTAL);
    auto* roomColumn = new wxBoxSizer(wxVERTICAL);
    auto* roomTitle = new wxStaticText(this, wxID_ANY, wxString(L"Salle"));
    roomTitle->SetFont(lila::shared::ui::Theme::TitleFont());
    roomTitle->SetForegroundColour(lila::shared::ui::Theme::TextPrimary());
    detailsLabel_ = new wxStaticText(this, wxID_ANY, wxString{});
    detailsLabel_->SetFont(lila::shared::ui::Theme::BodyFont());
    detailsLabel_->SetForegroundColour(lila::shared::ui::Theme::TextMuted());
    detailsLabel_->Hide();
    auto* zoneTitle = new wxStaticText(this, wxID_ANY, wxString(L"Zone de jeu"));
    zoneTitle->SetForegroundColour(lila::shared::ui::Theme::TextPrimary());
    gameZoneAnchor_ = new RoomGameZoneAnchor(this);
    gameZoneAnchor_->SetMinSize(wxSize(360, 80));
    roomColumn->Add(roomTitle, 0, wxBOTTOM, 12);
    roomColumn->Add(detailsLabel_, 0, wxEXPAND | wxBOTTOM, 18);
    roomColumn->Add(zoneTitle, 0, wxBOTTOM, 8);
    roomColumn->Add(gameZoneAnchor_, 1, wxEXPAND);

    auto* secondaryColumn = new wxBoxSizer(wxVERTICAL);
    chatTitle_ = new wxStaticText(this, wxID_ANY, wxString(L"Chat"));
    chatTitle_->SetForegroundColour(lila::shared::ui::Theme::TextPrimary());
    chatInput_ = new wxTextCtrl(this, wxID_ANY, wxString{}, wxDefaultPosition, wxDefaultSize, wxTE_PROCESS_ENTER);
    chatInput_->SetName(wxString(L"Message"));
    auto* historyTitle = new wxStaticText(this, wxID_ANY, wxString(L"Historique"));
    historyTitle->SetForegroundColour(lila::shared::ui::Theme::TextPrimary());
    history_ = new wxTextCtrl(
        this, wxID_ANY, wxString{}, wxDefaultPosition, wxDefaultSize,
        wxTE_MULTILINE | wxTE_READONLY | wxTE_RICH2 | wxTE_DONTWRAP);
    history_->SetName(wxString(L"Historique"));
    history_->SetMinSize(wxSize(440, 160));
    secondaryColumn->SetMinSize(wxSize(440, 160));
    secondaryColumn->Add(chatTitle_, 0, wxBOTTOM, 6);
    secondaryColumn->Add(chatInput_, 0, wxEXPAND | wxBOTTOM, 16);
    secondaryColumn->Add(historyTitle, 0, wxBOTTOM, 6);
    secondaryColumn->Add(history_, 1, wxEXPAND);
    content->Add(roomColumn, 3, wxEXPAND | wxRIGHT, 16);
    content->Add(secondaryColumn, 2, wxEXPAND);
    rootSizer->Add(content, 1, wxEXPAND | wxLEFT | wxRIGHT | wxBOTTOM, 20);

    statusLabel_ = new wxStaticText(this, wxID_ANY, wxString{});
    statusLabel_->Hide();
    rootSizer->Add(statusLabel_, 0, wxEXPAND | wxLEFT | wxRIGHT | wxBOTTOM, 24);
    SetSizer(rootSizer);
}
}
