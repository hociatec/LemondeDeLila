#include "shared/text/Encoding.h"
#include "modules/messaging/presentation/MessagingView.h"

#include <wx/button.h>
#include <wx/simplebook.h>
#include <wx/sizer.h>
#include <wx/stattext.h>
#include <wx/textctrl.h>

#include "shared/accessibility/AccessibilityUtils.h"
#include "shared/text/UiTexts.h"

namespace lila::modules::messaging::presentation
{
void MessagingView::BuildComposeScreen()
{
    composePanel = new wxPanel(screenBook);
    auto* sizer = new wxBoxSizer(wxVERTICAL);
    auto* title = new wxStaticText(composePanel, wxID_ANY, lila::shared::text::FromUtf8(lila::shared::text::ui::MessagingMenuCompose));
    auto* recipientLabel = new wxStaticText(composePanel, wxID_ANY, lila::shared::text::FromUtf8(lila::shared::text::ui::MessagingComposeRecipient));
    recipientCtrl = new wxTextCtrl(composePanel, wxID_ANY);
    auto* subjectLabel = new wxStaticText(composePanel, wxID_ANY, lila::shared::text::FromUtf8(lila::shared::text::ui::MessagingComposeSubject));
    subjectCtrl = new wxTextCtrl(composePanel, wxID_ANY);
    auto* bodyLabel = new wxStaticText(composePanel, wxID_ANY, lila::shared::text::FromUtf8(lila::shared::text::ui::MessagingComposeBody));
    bodyCtrl = new wxTextCtrl(composePanel, wxID_ANY, wxEmptyString, wxDefaultPosition, wxDefaultSize, wxTE_MULTILINE | wxTE_RICH2 | wxTE_PROCESS_TAB);
    bodyCtrl->SetMinSize(wxSize(-1, 280));
    auto* buttonSizer = new wxBoxSizer(wxHORIZONTAL);
    sendComposeButton = new wxButton(composePanel, wxID_ANY, lila::shared::text::FromUtf8(lila::shared::text::ui::MessagingSendButton));
    cancelComposeButton = new wxButton(composePanel, wxID_ANY, lila::shared::text::FromUtf8(lila::shared::text::ui::MessagingCancelButton));
    buttonSizer->Add(sendComposeButton, 0, wxRIGHT, 10);
    buttonSizer->Add(cancelComposeButton, 0);
    sizer->Add(title, 0, wxBOTTOM, 10);
    sizer->Add(recipientLabel, 0, wxBOTTOM, 6);
    sizer->Add(recipientCtrl, 0, wxEXPAND | wxBOTTOM, 10);
    sizer->Add(subjectLabel, 0, wxBOTTOM, 6);
    sizer->Add(subjectCtrl, 0, wxEXPAND | wxBOTTOM, 10);
    sizer->Add(bodyLabel, 0, wxBOTTOM, 6);
    sizer->Add(bodyCtrl, 1, wxEXPAND | wxBOTTOM, 12);
    sizer->Add(buttonSizer, 0, wxALIGN_LEFT);
    lila::shared::accessibility::AccessibilityUtils::SetAccessibleName(*recipientLabel, lila::shared::text::FromUtf8(lila::shared::text::ui::MessagingComposeRecipient));
    lila::shared::accessibility::AccessibilityUtils::SetAccessibleName(*recipientCtrl, lila::shared::text::FromUtf8(lila::shared::text::ui::MessagingComposeRecipient));
    lila::shared::accessibility::AccessibilityUtils::SetAccessibleName(*subjectLabel, lila::shared::text::FromUtf8(lila::shared::text::ui::MessagingComposeSubject));
    lila::shared::accessibility::AccessibilityUtils::SetAccessibleName(*subjectCtrl, lila::shared::text::FromUtf8(lila::shared::text::ui::MessagingComposeSubject));
    lila::shared::accessibility::AccessibilityUtils::SetAccessibleName(*bodyLabel, lila::shared::text::FromUtf8(lila::shared::text::ui::MessagingComposeBody));
    lila::shared::accessibility::AccessibilityUtils::SetAccessibleName(*bodyCtrl, lila::shared::text::FromUtf8(lila::shared::text::ui::MessagingComposeBody));
    lila::shared::accessibility::AccessibilityUtils::SetAccessibleName(*sendComposeButton, lila::shared::text::FromUtf8(lila::shared::text::ui::MessagingSendButton));
    lila::shared::accessibility::AccessibilityUtils::SetAccessibleName(*cancelComposeButton, lila::shared::text::FromUtf8(lila::shared::text::ui::MessagingCancelButton));
    lila::shared::accessibility::AccessibilityUtils::ConfigureLinearTabOrder({recipientCtrl, subjectCtrl, bodyCtrl, sendComposeButton, cancelComposeButton});
    composePanel->SetSizer(sizer);
}
}
