#include "modules/gameplay/presentation/GamePlayPanel.h"

#include <wx/listbox.h>
#include <wx/sizer.h>
#include <wx/stattext.h>
#include <wx/textctrl.h>

#include "shared/ui/presentation/theme/Theme.h"

namespace lila::modules::gameplay::presentation
{
void GamePlayPanel::BuildLayout()
{
    SetBackgroundColour(lila::shared::ui::Theme::PanelBackground());
    auto* root = new wxBoxSizer(wxVERTICAL);

    headerLabel_ = new wxStaticText(this, wxID_ANY, wxString(L"Zone de jeu"));
    headerLabel_->SetForegroundColour(lila::shared::ui::Theme::TextPrimary());
    headerLabel_->SetFont(lila::shared::ui::Theme::TitleFont());
    root->Add(headerLabel_, 0, wxEXPAND | wxALL, 8);

    auto* body = new wxBoxSizer(wxHORIZONTAL);
    linesList_ = new wxListBox(this, wxID_ANY, wxDefaultPosition, wxDefaultSize, 0, nullptr, wxLB_SINGLE | wxWANTS_CHARS);
    linesList_->SetName(wxString(L"Actions de jeu"));
    linesList_->SetMinSize(wxSize(260, 180));
    infoText_ = new wxTextCtrl(
        this, wxID_ANY, wxString{}, wxDefaultPosition, wxDefaultSize,
        wxTE_MULTILINE | wxTE_READONLY | wxTE_DONTWRAP | wxWANTS_CHARS);
    infoText_->SetName(wxString(L"Informations de jeu"));
    infoText_->SetMinSize(wxSize(260, 180));
    body->Add(linesList_, 1, wxEXPAND | wxRIGHT, 8);
    body->Add(infoText_, 1, wxEXPAND);
    root->Add(body, 1, wxEXPAND | wxLEFT | wxRIGHT | wxBOTTOM, 8);

    logText_ = new wxTextCtrl(
        this, wxID_ANY, wxString{}, wxDefaultPosition, wxDefaultSize,
        wxTE_MULTILINE | wxTE_READONLY | wxTE_DONTWRAP | wxWANTS_CHARS);
    logText_->SetName(wxString(L"Journal de jeu"));
    logText_->SetMinSize(wxSize(260, 90));
    root->Add(logText_, 0, wxEXPAND | wxLEFT | wxRIGHT | wxBOTTOM, 8);

    shortcutsLabel_ = new wxStaticText(this, wxID_ANY, wxString{});
    shortcutsLabel_->SetForegroundColour(lila::shared::ui::Theme::TextMuted());
    root->Add(shortcutsLabel_, 0, wxEXPAND | wxLEFT | wxRIGHT | wxBOTTOM, 6);

    statusLabel_ = new wxStaticText(this, wxID_ANY, wxString{});
    statusLabel_->SetForegroundColour(lila::shared::ui::Theme::Accent());
    root->Add(statusLabel_, 0, wxEXPAND | wxLEFT | wxRIGHT | wxBOTTOM, 8);
    SetSizer(root);
}
}
