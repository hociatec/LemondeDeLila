#include "shared/text/Encoding.h"
#include "modules/messaging/presentation/MessagingView.h"
#include "modules/messaging/presentation/MessagingPresentationModel.h"

#include <array>
#include <wx/button.h>
#include <wx/listbox.h>
#include <wx/simplebook.h>
#include <wx/sizer.h>
#include <wx/stattext.h>
#include <wx/textctrl.h>

#include "shared/accessibility/AccessibilityUtils.h"
#include "shared/accessibility/NonFocusablePanel.h"
#include "shared/errors/ErrorMessages.h"
#include "shared/ui/Theme.h"
#include "shared/ui/controls/VerticalMenu.h"
#include "shared/ui/navigation/MenuBlueprint.h"

namespace lila::modules::messaging::presentation
{
MessagingView::MessagingView(wxWindow* parent)
    : wxPanel(parent)
{
    BuildLayout();
}

void MessagingView::BuildLayout()
{
    auto* rootSizer = new wxBoxSizer(wxVERTICAL);
    auto* headerPanel = BuildHeader();
    screenBook = new wxSimplebook(this, wxID_ANY);

    BuildMenuScreen();
    BuildListScreen();
    BuildDetailScreen();
    BuildComposeScreen();

    screenBook->AddPage(menuPanel, lila::shared::text::FromUtf8(lila::shared::errors::MessagingPageMenu));
    screenBook->AddPage(listPanel, lila::shared::text::FromUtf8(lila::shared::errors::MessagingPageList));
    screenBook->AddPage(detailPanel, lila::shared::text::FromUtf8(lila::shared::errors::MessagingPageDetail));
    screenBook->AddPage(composePanel, lila::shared::text::FromUtf8(lila::shared::errors::MessagingPageCompose));

    rootSizer->Add(headerPanel, 0, wxEXPAND | wxTOP | wxLEFT | wxRIGHT, 28);
    rootSizer->Add(screenBook, 1, wxEXPAND | wxALL, 24);
    SetSizer(rootSizer);
}

wxPanel* MessagingView::BuildHeader()
{
    auto* panel = new lila::shared::accessibility::NonFocusablePanel(this, 0);
    auto* sizer = new wxBoxSizer(wxVERTICAL);
    auto* titleLabel = new wxStaticText(panel, wxID_ANY, lila::shared::text::FromUtf8(lila::shared::errors::MessagingFrameHeader));
    auto* subtitleLabel = new wxStaticText(panel, wxID_ANY, lila::shared::text::FromUtf8(lila::shared::errors::MessagingFrameSubtitle));
    statusLabel = new wxStaticText(panel, wxID_ANY, lila::shared::text::FromUtf8(lila::shared::errors::MessagingFrameInitialStatus));
    lila::shared::accessibility::AccessibilityUtils::SetAccessibleName(*statusLabel, lila::shared::text::FromUtf8(lila::shared::errors::MessagingFrameStatusAccessible));
    sizer->Add(titleLabel, 0, wxALIGN_CENTER_HORIZONTAL);
    sizer->Add(subtitleLabel, 0, wxALIGN_CENTER_HORIZONTAL | wxTOP, 4);
    sizer->Add(statusLabel, 0, wxALIGN_CENTER_HORIZONTAL | wxTOP, 6);
    panel->SetSizer(sizer);
    return panel;
}

void MessagingView::BuildMenuScreen()
{
    menuPanel = new wxPanel(screenBook);
    auto* sizer = new wxBoxSizer(wxVERTICAL);
    static const std::array<lila::shared::ui::navigation::MenuBlueprintItem, 4> menuItems = {{
        {"compose", lila::shared::text::FromUtf8(lila::shared::errors::MessagingMenuCompose), wxEmptyString},
        {"inbox", lila::shared::text::FromUtf8(lila::shared::errors::MessagingMenuInbox), wxEmptyString},
        {"outbox", lila::shared::text::FromUtf8(lila::shared::errors::MessagingMenuOutbox), wxEmptyString},
        {"deleted", lila::shared::text::FromUtf8(lila::shared::errors::MessagingMenuDeleted), wxEmptyString},
    }};
    menu = new lila::shared::ui::controls::VerticalMenu(menuPanel, lila::shared::ui::navigation::BuildMenuItems(menuItems));
    lila::shared::accessibility::AccessibilityUtils::SetAccessibleName(*menu, lila::shared::text::FromUtf8(lila::shared::errors::MessagingPageMenu));
    sizer->Add(menu, 1, wxEXPAND);
    menuPanel->SetSizer(sizer);
}

void MessagingView::BuildListScreen()
{
    listPanel = new wxPanel(screenBook);
    auto* sizer = new wxBoxSizer(wxVERTICAL);
    listTitleLabel = new wxStaticText(listPanel, wxID_ANY, MessagingPresentationModel::BoxTitle(domain::MessagingBox::Inbox));
    messagesList = new wxListBox(listPanel, wxID_ANY);
    emptyMessagesCtrl = new wxTextCtrl(listPanel, wxID_ANY, lila::shared::text::FromUtf8(lila::shared::errors::MessagingNoMessage), wxDefaultPosition, wxDefaultSize, wxTE_MULTILINE | wxTE_READONLY | wxTE_RICH2 | wxBORDER_NONE);
    emptyMessagesCtrl->SetMinSize(wxSize(-1, 80));
    sizer->Add(listTitleLabel, 0, wxBOTTOM, 10);
    sizer->Add(messagesList, 1, wxEXPAND | wxBOTTOM, 12);
    sizer->Add(emptyMessagesCtrl, 0, wxEXPAND);
    lila::shared::accessibility::AccessibilityUtils::SetAccessibleName(*listTitleLabel, lila::shared::text::FromUtf8(lila::shared::errors::MessagingListHeader));
    lila::shared::accessibility::AccessibilityUtils::SetAccessibleName(*messagesList, lila::shared::text::FromUtf8(lila::shared::errors::MessagingListHeader));
    lila::shared::accessibility::AccessibilityUtils::SetAccessibleName(*emptyMessagesCtrl, lila::shared::text::FromUtf8(lila::shared::errors::MessagingNoMessage));
    lila::shared::accessibility::AccessibilityUtils::ConfigureLinearTabOrder({listTitleLabel, messagesList, emptyMessagesCtrl});
    listPanel->SetSizer(sizer);
}

void MessagingView::BuildDetailScreen()
{
    detailPanel = new wxPanel(screenBook);
    auto* sizer = new wxBoxSizer(wxVERTICAL);
    auto* title = new wxStaticText(detailPanel, wxID_ANY, lila::shared::text::FromUtf8(lila::shared::errors::MessagingMessageDetail));
    detailCtrl = new wxTextCtrl(detailPanel, wxID_ANY, wxEmptyString, wxDefaultPosition, wxDefaultSize, wxTE_MULTILINE | wxTE_READONLY | wxTE_RICH2);
    detailCtrl->SetMinSize(wxSize(-1, 420));
    auto* buttonSizer = new wxBoxSizer(wxHORIZONTAL);
    replyButton = new wxButton(detailPanel, wxID_ANY, lila::shared::text::FromUtf8(lila::shared::errors::MessagingReplyButton));
    deleteButton = new wxButton(detailPanel, wxID_ANY, lila::shared::text::FromUtf8(lila::shared::errors::MessagingDeleteButton));
    restoreButton = new wxButton(detailPanel, wxID_ANY, lila::shared::text::FromUtf8(lila::shared::errors::MessagingRestoreButton));
    purgeButton = new wxButton(detailPanel, wxID_ANY, lila::shared::text::FromUtf8(lila::shared::errors::MessagingPurgeButton));
    buttonSizer->Add(replyButton, 0, wxRIGHT, 10); buttonSizer->Add(deleteButton, 0, wxRIGHT, 10);
    buttonSizer->Add(restoreButton, 0, wxRIGHT, 10); buttonSizer->Add(purgeButton, 0);
    sizer->Add(title, 0, wxBOTTOM, 10); sizer->Add(detailCtrl, 1, wxEXPAND | wxBOTTOM, 12); sizer->Add(buttonSizer, 0, wxALIGN_LEFT);
    lila::shared::accessibility::AccessibilityUtils::SetAccessibleName(*detailCtrl, lila::shared::text::FromUtf8(lila::shared::errors::MessagingMessageDetail));
    lila::shared::accessibility::AccessibilityUtils::SetAccessibleName(*replyButton, lila::shared::text::FromUtf8(lila::shared::errors::MessagingReplyButton));
    lila::shared::accessibility::AccessibilityUtils::SetAccessibleName(*deleteButton, lila::shared::text::FromUtf8(lila::shared::errors::MessagingDeleteButton));
    lila::shared::accessibility::AccessibilityUtils::SetAccessibleName(*restoreButton, lila::shared::text::FromUtf8(lila::shared::errors::MessagingRestoreButton));
    lila::shared::accessibility::AccessibilityUtils::SetAccessibleName(*purgeButton, lila::shared::text::FromUtf8(lila::shared::errors::MessagingPurgeButton));
    lila::shared::accessibility::AccessibilityUtils::ConfigureLinearTabOrder({detailCtrl, replyButton, deleteButton, restoreButton, purgeButton});
    detailPanel->SetSizer(sizer);
}

void MessagingView::BuildComposeScreen()
{
    composePanel = new wxPanel(screenBook);
    auto* sizer = new wxBoxSizer(wxVERTICAL);
    auto* title = new wxStaticText(composePanel, wxID_ANY, lila::shared::text::FromUtf8(lila::shared::errors::MessagingMenuCompose));
    auto* recipientLabel = new wxStaticText(composePanel, wxID_ANY, lila::shared::text::FromUtf8(lila::shared::errors::MessagingComposeRecipient));
    recipientCtrl = new wxTextCtrl(composePanel, wxID_ANY);
    auto* subjectLabel = new wxStaticText(composePanel, wxID_ANY, lila::shared::text::FromUtf8(lila::shared::errors::MessagingComposeSubject));
    subjectCtrl = new wxTextCtrl(composePanel, wxID_ANY);
    auto* bodyLabel = new wxStaticText(composePanel, wxID_ANY, lila::shared::text::FromUtf8(lila::shared::errors::MessagingComposeBody));
    bodyCtrl = new wxTextCtrl(composePanel, wxID_ANY, wxEmptyString, wxDefaultPosition, wxDefaultSize, wxTE_MULTILINE | wxTE_RICH2 | wxTE_PROCESS_TAB);
    bodyCtrl->SetMinSize(wxSize(-1, 280));
    auto* buttonSizer = new wxBoxSizer(wxHORIZONTAL);
    sendComposeButton = new wxButton(composePanel, wxID_ANY, lila::shared::text::FromUtf8(lila::shared::errors::MessagingSendButton));
    cancelComposeButton = new wxButton(composePanel, wxID_ANY, lila::shared::text::FromUtf8(lila::shared::errors::MessagingCancelButton));
    buttonSizer->Add(sendComposeButton, 0, wxRIGHT, 10); buttonSizer->Add(cancelComposeButton, 0);
    sizer->Add(title, 0, wxBOTTOM, 10); sizer->Add(recipientLabel, 0, wxBOTTOM, 6); sizer->Add(recipientCtrl, 0, wxEXPAND | wxBOTTOM, 10);
    sizer->Add(subjectLabel, 0, wxBOTTOM, 6); sizer->Add(subjectCtrl, 0, wxEXPAND | wxBOTTOM, 10); sizer->Add(bodyLabel, 0, wxBOTTOM, 6);
    sizer->Add(bodyCtrl, 1, wxEXPAND | wxBOTTOM, 12); sizer->Add(buttonSizer, 0, wxALIGN_LEFT);
    lila::shared::accessibility::AccessibilityUtils::SetAccessibleName(*recipientLabel, lila::shared::text::FromUtf8(lila::shared::errors::MessagingComposeRecipient));
    lila::shared::accessibility::AccessibilityUtils::SetAccessibleName(*recipientCtrl, lila::shared::text::FromUtf8(lila::shared::errors::MessagingComposeRecipient));
    lila::shared::accessibility::AccessibilityUtils::SetAccessibleName(*subjectLabel, lila::shared::text::FromUtf8(lila::shared::errors::MessagingComposeSubject));
    lila::shared::accessibility::AccessibilityUtils::SetAccessibleName(*subjectCtrl, lila::shared::text::FromUtf8(lila::shared::errors::MessagingComposeSubject));
    lila::shared::accessibility::AccessibilityUtils::SetAccessibleName(*bodyLabel, lila::shared::text::FromUtf8(lila::shared::errors::MessagingComposeBody));
    lila::shared::accessibility::AccessibilityUtils::SetAccessibleName(*bodyCtrl, lila::shared::text::FromUtf8(lila::shared::errors::MessagingComposeBody));
    lila::shared::accessibility::AccessibilityUtils::SetAccessibleName(*sendComposeButton, lila::shared::text::FromUtf8(lila::shared::errors::MessagingSendButton));
    lila::shared::accessibility::AccessibilityUtils::SetAccessibleName(*cancelComposeButton, lila::shared::text::FromUtf8(lila::shared::errors::MessagingCancelButton));
    lila::shared::accessibility::AccessibilityUtils::ConfigureLinearTabOrder({recipientCtrl, subjectCtrl, bodyCtrl, sendComposeButton, cancelComposeButton});
    composePanel->SetSizer(sizer);
}

void MessagingView::ApplyTheme()
{
    using lila::shared::ui::Theme;

    SetBackgroundColour(Theme::Background());
    SetForegroundColour(Theme::TextPrimary());

    const auto styleWindow = [](wxWindow* window)
    {
        if (window == nullptr)
        {
            return;
        }

        window->SetBackgroundColour(lila::shared::ui::Theme::PanelBackground());
        window->SetForegroundColour(lila::shared::ui::Theme::TextPrimary());
    };

    for (wxWindow* child : GetChildren())
    {
        styleWindow(child);
    }

    styleWindow(menuPanel);
    styleWindow(listPanel);
    styleWindow(detailPanel);
    styleWindow(composePanel);

    messagesList->SetBackgroundColour(wxColour(12, 21, 35));
    messagesList->SetForegroundColour(Theme::TextPrimary());
    emptyMessagesCtrl->SetBackgroundColour(wxColour(12, 21, 35));
    emptyMessagesCtrl->SetForegroundColour(Theme::TextPrimary());
    detailCtrl->SetBackgroundColour(wxColour(12, 21, 35));
    detailCtrl->SetForegroundColour(Theme::TextPrimary());
    recipientCtrl->SetBackgroundColour(wxColour(10, 24, 39));
    recipientCtrl->SetForegroundColour(Theme::TextPrimary());
    subjectCtrl->SetBackgroundColour(wxColour(10, 24, 39));
    subjectCtrl->SetForegroundColour(Theme::TextPrimary());
    bodyCtrl->SetBackgroundColour(wxColour(10, 24, 39));
    bodyCtrl->SetForegroundColour(Theme::TextPrimary());
    statusLabel->SetForegroundColour(Theme::Accent());
}


}
