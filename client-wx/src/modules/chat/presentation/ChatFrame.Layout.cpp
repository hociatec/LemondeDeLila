#include "shared/text/Encoding.h"
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
#include "shared/text/UiTexts.h"

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
        lila::shared::text::FromUtf8(lila::shared::text::ui::ChatFrameHeader));
    auto* subtitleLabel = new wxStaticText(
        headerPanel,
        wxID_ANY,
        lila::shared::text::FromUtf8(lila::shared::text::ui::ChatFrameSubtitle));
    statusLabel_ = new wxTextCtrl(
        headerPanel,
        wxID_ANY,
        lila::shared::text::FromUtf8(lila::shared::text::ui::ChatFrameOpeningMessage),
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
        lila::shared::text::FromUtf8(lila::shared::text::ui::ChatMessagesHeader));
    historyList_ = new wxListBox(contentPanel, wxID_ANY);
    emptyHistoryCtrl_ = new wxTextCtrl(
        contentPanel,
        wxID_ANY,
        lila::shared::text::FromUtf8(lila::shared::text::ui::ChatNoMessage),
        wxDefaultPosition,
        wxDefaultSize,
        wxTE_MULTILINE | wxTE_READONLY | wxTE_RICH2 | wxBORDER_NONE);
    // Keep the composer visible even on smaller screens. The history expands
    // into the remaining space instead of forcing the composer below the viewport.
    historyList_->SetMinSize(wxSize(-1, 240));
    emptyHistoryCtrl_->SetMinSize(wxSize(-1, 90));
    // Before the asynchronous history load completes, expose a stable history
    // target to Tab instead of an empty/disabled list box.
    historyList_->Show(false);
    emptyHistoryCtrl_->Show(true);

    auto* historyActionSizer = new wxBoxSizer(wxHORIZONTAL);
    editMessageButton_ = new wxButton(
        contentPanel,
        wxID_ANY,
        lila::shared::text::FromUtf8(lila::shared::text::ui::ChatEditMessageAction));
    deleteMessageButton_ = new wxButton(
        contentPanel,
        wxID_ANY,
        lila::shared::text::FromUtf8(lila::shared::text::ui::ChatDeleteMessageAction));
    historyActionSizer->Add(editMessageButton_, 0, wxRIGHT, 10);
    historyActionSizer->Add(deleteMessageButton_, 0);

    auto* inputLabel = new wxStaticText(
        contentPanel,
        wxID_ANY,
        lila::shared::text::FromUtf8(lila::shared::text::ui::ChatYourMessageHint));
    inputCtrl_ = new wxTextCtrl(
        contentPanel,
        wxID_ANY,
        wxEmptyString,
        wxDefaultPosition,
        wxDefaultSize,
        wxTE_PROCESS_ENTER);

    // The composer is intentionally first: when the tchat opens the user can
    // immediately type, then Tab moves to the message history.
    contentSizer->Add(inputLabel, 0, wxBOTTOM, 8);
    contentSizer->Add(inputCtrl_, 0, wxEXPAND | wxBOTTOM, 18);
    contentSizer->Add(historyLabel, 0, wxBOTTOM, 8);
    contentSizer->Add(historyList_, 1, wxEXPAND | wxBOTTOM, 12);
    contentSizer->Add(emptyHistoryCtrl_, 1, wxEXPAND | wxBOTTOM, 12);
    contentSizer->Add(historyActionSizer, 0, wxBOTTOM, 12);
    lila::shared::accessibility::AccessibilityUtils::ConfigureLinearTabOrder(
        {inputCtrl_,
         historyList_,
         emptyHistoryCtrl_,
         editMessageButton_,
         deleteMessageButton_});
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
        lila::shared::text::FromUtf8(lila::shared::text::ui::ChatMessagesListAccessible));
    lila::shared::accessibility::AccessibilityUtils::SetAccessibleName(
        *emptyHistoryCtrl_,
        lila::shared::text::FromUtf8(lila::shared::text::ui::ChatMessagesEmptyAccessible));
    lila::shared::accessibility::AccessibilityUtils::SetAccessibleName(
        *editMessageButton_,
        lila::shared::text::FromUtf8(lila::shared::text::ui::ChatEditMessageAction));
    lila::shared::accessibility::AccessibilityUtils::SetAccessibleName(
        *deleteMessageButton_,
        lila::shared::text::FromUtf8(lila::shared::text::ui::ChatDeleteMessageAction));
    lila::shared::accessibility::AccessibilityUtils::SetAccessibleName(
        *inputCtrl_,
        lila::shared::text::FromUtf8(lila::shared::text::ui::ChatInputHintAccessible));
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
