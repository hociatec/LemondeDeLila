#include "modules/gameplay/presentation/GamePlayPanel.h"

#include <wx/listbox.h>
#include <wx/scrolwin.h>
#include <wx/sizer.h>
#include <wx/stattext.h>
#include <wx/textctrl.h>

#include "modules/gameplay/presentation/confirmation/GameActionConfirmationPanel.h"
#include "modules/gameplay/presentation/hand/GameHandPanel.h"
#include "modules/gameplay/presentation/prompt/GamePromptPanel.h"
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

    confirmationPanel_ = new confirmation::GameActionConfirmationPanel(this);
    root->Add(confirmationPanel_, 1, wxEXPAND | wxLEFT | wxRIGHT | wxBOTTOM, 8);

    promptPanel_ = new prompt::GamePromptPanel(this);
    root->Add(promptPanel_, 1, wxEXPAND | wxLEFT | wxRIGHT | wxBOTTOM, 8);

    contentPanel_ = new wxScrolledWindow(this, wxID_ANY, wxDefaultPosition, wxDefaultSize,
        wxVSCROLL | wxTAB_TRAVERSAL);
    contentPanel_->SetScrollRate(0, 12);
    contentPanel_->SetBackgroundColour(lila::shared::ui::Theme::PanelBackground());
    auto* content = new wxBoxSizer(wxVERTICAL);

    infoText_ = new wxTextCtrl(
        contentPanel_, wxID_ANY, wxString{}, wxDefaultPosition, wxDefaultSize,
        wxTE_MULTILINE | wxTE_READONLY | wxTE_DONTWRAP | wxWANTS_CHARS);
    infoText_->SetName(wxString(L"Informations de jeu"));
    infoText_->SetMinSize(wxSize(260, 70));
    content->Add(infoText_, 1, wxEXPAND | wxBOTTOM, 8);

    handPanel_ = new hand::GameHandPanel(contentPanel_);
    content->Add(handPanel_, 1, wxEXPAND | wxBOTTOM, 8);

    auto* actionsLabel = new wxStaticText(contentPanel_, wxID_ANY, wxString(L"Actions disponibles"));
    actionsLabel->SetForegroundColour(lila::shared::ui::Theme::Accent());
    content->Add(actionsLabel, 0, wxEXPAND | wxBOTTOM, 4);
    linesList_ = new wxListBox(contentPanel_, wxID_ANY, wxDefaultPosition, wxDefaultSize, 0, nullptr, wxLB_SINGLE | wxWANTS_CHARS);
    linesList_->SetName(wxString(L"Actions de jeu"));
    linesList_->SetMinSize(wxSize(260, 90));
    content->Add(linesList_, 1, wxEXPAND | wxBOTTOM, 8);

    logText_ = new wxTextCtrl(
        contentPanel_, wxID_ANY, wxString{}, wxDefaultPosition, wxDefaultSize,
        wxTE_MULTILINE | wxTE_READONLY | wxTE_DONTWRAP | wxWANTS_CHARS);
    logText_->SetName(wxString(L"Journal de jeu"));
    logText_->SetMinSize(wxSize(260, 90));
    content->Add(logText_, 1, wxEXPAND | wxBOTTOM, 8);

    shortcutsLabel_ = new wxStaticText(contentPanel_, wxID_ANY, wxString{});
    shortcutsLabel_->SetForegroundColour(lila::shared::ui::Theme::TextMuted());
    content->Add(shortcutsLabel_, 0, wxEXPAND | wxBOTTOM, 6);
    contentPanel_->SetSizer(content);
    root->Add(contentPanel_, 1, wxEXPAND | wxLEFT | wxRIGHT | wxBOTTOM, 8);

    statusLabel_ = new wxStaticText(this, wxID_ANY, wxString{});
    statusLabel_->SetForegroundColour(lila::shared::ui::Theme::Accent());
    root->Add(statusLabel_, 0, wxEXPAND | wxLEFT | wxRIGHT | wxBOTTOM, 8);
    SetSizer(root);
}
}
