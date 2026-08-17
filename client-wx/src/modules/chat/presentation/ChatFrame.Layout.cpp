#include "modules/chat/presentation/ChatFrame.h"

#include <wx/button.h>
#include <wx/listbox.h>
#include <wx/panel.h>
#include <wx/sizer.h>
#include <wx/stattext.h>
#include <wx/textctrl.h>

#include "shared/accessibility/NonFocusablePanel.h"
#include "shared/accessibility/AccessibilityUtils.h"
#include "shared/ui/Theme.h"
#include "shared/errors/ErrorMessages.h"

namespace lila::modules::chat::presentation
{
void ChatFrame::BuildLayout()
{
    auto* root = new lila::shared::accessibility::NonFocusablePanel(this);
    auto* rootSizer = new wxBoxSizer(wxVERTICAL);

    auto* headerPanel = new lila::shared::accessibility::NonFocusablePanel(root);
    auto* headerSizer = new wxBoxSizer(wxVERTICAL);
    auto* titleLabel = new wxStaticText(
        headerPanel,
        wxID_ANY,
        wxString::FromUTF8(lila::shared::errors::ChatFrameHeader));
    auto* subtitleLabel = new wxStaticText(
        headerPanel,
        wxID_ANY,
        wxString::FromUTF8(lila::shared::errors::ChatFrameSubtitle));
    statusLabel_ = new wxTextCtrl(
        headerPanel,
        wxID_ANY,
        wxString::FromUTF8(lila::shared::errors::ChatFrameOpeningMessage),
        wxDefaultPosition,
        wxDefaultSize,
        wxTE_READONLY | wxTE_CENTER | wxBORDER_NONE);
    headerSizer->Add(titleLabel, 0, wxALIGN_CENTER_HORIZONTAL);
    headerSizer->Add(subtitleLabel, 0, wxALIGN_CENTER_HORIZONTAL | wxTOP, 4);
    headerSizer->Add(statusLabel_, 0, wxALIGN_CENTER_HORIZONTAL | wxTOP, 6);
    headerPanel->SetSizer(headerSizer);

    auto* contentPanel = new lila::shared::accessibility::NonFocusablePanel(root);
    auto* contentSizer = new wxBoxSizer(wxVERTICAL);
    auto* historyLabel = new wxStaticText(
        contentPanel,
        wxID_ANY,
        wxString::FromUTF8(lila::shared::errors::ChatMessagesHeader));
    historyList_ = new wxListBox(contentPanel, wxID_ANY);
    emptyHistoryCtrl_ = new wxTextCtrl(
        contentPanel,
        wxID_ANY,
        wxString::FromUTF8(lila::shared::errors::ChatNoMessage),
        wxDefaultPosition,
        wxDefaultSize,
        wxTE_MULTILINE | wxTE_READONLY | wxTE_RICH2 | wxBORDER_NONE);
    historyList_->SetMinSize(wxSize(-1, 420));
    emptyHistoryCtrl_->SetMinSize(wxSize(-1, 90));

    auto* historyActionSizer = new wxBoxSizer(wxHORIZONTAL);
    editMessageButton_ = new wxButton(
        contentPanel,
        wxID_ANY,
        wxString::FromUTF8(lila::shared::errors::ChatEditMessageAction));
    deleteMessageButton_ = new wxButton(
        contentPanel,
        wxID_ANY,
        wxString::FromUTF8(lila::shared::errors::ChatDeleteMessageAction));
    historyActionSizer->Add(editMessageButton_, 0, wxRIGHT, 10);
    historyActionSizer->Add(deleteMessageButton_, 0);

    auto* inputLabel = new wxStaticText(
        contentPanel,
        wxID_ANY,
        wxString::FromUTF8(lila::shared::errors::ChatYourMessageHint));
    inputCtrl_ = new wxTextCtrl(
        contentPanel,
        wxID_ANY,
        wxEmptyString,
        wxDefaultPosition,
        wxDefaultSize,
        wxTE_PROCESS_ENTER);

    contentSizer->Add(historyLabel, 0, wxBOTTOM, 8);
    contentSizer->Add(historyList_, 1, wxEXPAND | wxBOTTOM, 12);
    contentSizer->Add(emptyHistoryCtrl_, 0, wxEXPAND | wxBOTTOM, 12);
    contentSizer->Add(historyActionSizer, 0, wxBOTTOM, 18);
    contentSizer->Add(inputLabel, 0, wxBOTTOM, 8);
    contentSizer->Add(inputCtrl_, 0, wxEXPAND | wxBOTTOM, 12);
    lila::shared::accessibility::AccessibilityUtils::ConfigureLinearTabOrder(
        {historyList_,
         emptyHistoryCtrl_,
         editMessageButton_,
         deleteMessageButton_,
         inputLabel,
         inputCtrl_});
    contentPanel->SetSizer(contentSizer);

    rootSizer->Add(headerPanel, 0, wxEXPAND | wxTOP | wxLEFT | wxRIGHT, 28);
    rootSizer->Add(contentPanel, 1, wxEXPAND | wxALL, 24);
    root->SetSizer(rootSizer);

    auto* frameSizer = new wxBoxSizer(wxVERTICAL);
    frameSizer->Add(root, 1, wxEXPAND);
    SetSizer(frameSizer);
}

void ChatFrame::ApplyTheme()
{
    using lila::shared::ui::Theme;

    SetBackgroundColour(Theme::Background());
    SetForegroundColour(Theme::TextPrimary());

    for (wxWindow* child : GetChildren())
    {
        if (child == nullptr)
        {
            continue;
        }

        child->SetBackgroundColour(Theme::PanelBackground());
        child->SetForegroundColour(Theme::TextPrimary());
    }

    historyList_->SetBackgroundColour(wxColour(12, 21, 35));
    historyList_->SetForegroundColour(Theme::TextPrimary());
    emptyHistoryCtrl_->SetBackgroundColour(wxColour(12, 21, 35));
    emptyHistoryCtrl_->SetForegroundColour(Theme::TextPrimary());
    inputCtrl_->SetBackgroundColour(wxColour(12, 21, 35));
    inputCtrl_->SetForegroundColour(Theme::TextPrimary());
    statusLabel_->SetForegroundColour(Theme::Accent());
    editMessageButton_->SetBackgroundColour(Theme::PanelBackground());
    editMessageButton_->SetForegroundColour(Theme::TextPrimary());
    deleteMessageButton_->SetBackgroundColour(Theme::PanelBackground());
    deleteMessageButton_->SetForegroundColour(Theme::TextPrimary());
    
    lila::shared::accessibility::AccessibilityUtils::SetAccessibleStatus(*statusLabel_, statusLabel_->GetValue());
    lila::shared::accessibility::AccessibilityUtils::SetAccessibleName(
        *historyList_,
        wxString::FromUTF8(lila::shared::errors::ChatMessagesListAccessible));
    lila::shared::accessibility::AccessibilityUtils::SetAccessibleName(
        *emptyHistoryCtrl_,
        wxString::FromUTF8(lila::shared::errors::ChatMessagesEmptyAccessible));
    lila::shared::accessibility::AccessibilityUtils::SetAccessibleName(
        *editMessageButton_,
        wxString::FromUTF8(lila::shared::errors::ChatEditMessageAction));
    lila::shared::accessibility::AccessibilityUtils::SetAccessibleName(
        *deleteMessageButton_,
        wxString::FromUTF8(lila::shared::errors::ChatDeleteMessageAction));
    lila::shared::accessibility::AccessibilityUtils::SetAccessibleName(
        *inputCtrl_,
        wxString::FromUTF8(lila::shared::errors::ChatInputHintAccessible));
}

void ChatFrame::UpdateStatus(const wxString& message, bool isError)
{
    statusLabel_->SetValue(message);
    statusLabel_->SetInsertionPointEnd();
    statusLabel_->SetForegroundColour(
        isError ? lila::shared::ui::Theme::Error() : lila::shared::ui::Theme::Accent());
    lila::shared::accessibility::AccessibilityUtils::SetAccessibleStatus(*statusLabel_, message);
    Layout();
}
}
