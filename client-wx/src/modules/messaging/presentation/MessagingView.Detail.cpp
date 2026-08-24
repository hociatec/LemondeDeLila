#include "shared/text/presentation/encoding/Encoding.h"
#include "modules/messaging/presentation/MessagingView.h"

#include <wx/button.h>
#include <wx/simplebook.h>
#include <wx/sizer.h>
#include <wx/stattext.h>
#include <wx/textctrl.h>

#include "shared/accessibility/presentation/AccessibilityUtils.h"
#include "shared/text/presentation/catalog/UiTexts.h"

namespace lila::modules::messaging::presentation
{
void MessagingView::BuildDetailScreen()
{
    detailPanel = new wxPanel(screenBook);
    auto* sizer = new wxBoxSizer(wxVERTICAL);
    auto* title = new wxStaticText(detailPanel, wxID_ANY, lila::shared::text::FromUtf8(lila::shared::text::ui::MessagingMessageDetail));
    detailCtrl = new wxTextCtrl(detailPanel, wxID_ANY, wxEmptyString, wxDefaultPosition, wxDefaultSize, wxTE_MULTILINE | wxTE_READONLY | wxTE_RICH2);
    detailCtrl->SetMinSize(wxSize(-1, 420));
    auto* buttonSizer = new wxBoxSizer(wxHORIZONTAL);
    replyButton = new wxButton(detailPanel, wxID_ANY, lila::shared::text::FromUtf8(lila::shared::text::ui::MessagingReplyButton));
    deleteButton = new wxButton(detailPanel, wxID_ANY, lila::shared::text::FromUtf8(lila::shared::text::ui::MessagingDeleteButton));
    restoreButton = new wxButton(detailPanel, wxID_ANY, lila::shared::text::FromUtf8(lila::shared::text::ui::MessagingRestoreButton));
    purgeButton = new wxButton(detailPanel, wxID_ANY, lila::shared::text::FromUtf8(lila::shared::text::ui::MessagingPurgeButton));
    buttonSizer->Add(replyButton, 0, wxRIGHT, 10);
    buttonSizer->Add(deleteButton, 0, wxRIGHT, 10);
    buttonSizer->Add(restoreButton, 0, wxRIGHT, 10);
    buttonSizer->Add(purgeButton, 0);
    sizer->Add(title, 0, wxBOTTOM, 10);
    sizer->Add(detailCtrl, 1, wxEXPAND | wxBOTTOM, 12);
    sizer->Add(buttonSizer, 0, wxALIGN_LEFT);
    lila::shared::accessibility::AccessibilityUtils::SetAccessibleName(*detailCtrl, lila::shared::text::FromUtf8(lila::shared::text::ui::MessagingMessageDetail));
    lila::shared::accessibility::AccessibilityUtils::SetAccessibleName(*replyButton, lila::shared::text::FromUtf8(lila::shared::text::ui::MessagingReplyButton));
    lila::shared::accessibility::AccessibilityUtils::SetAccessibleName(*deleteButton, lila::shared::text::FromUtf8(lila::shared::text::ui::MessagingDeleteButton));
    lila::shared::accessibility::AccessibilityUtils::SetAccessibleName(*restoreButton, lila::shared::text::FromUtf8(lila::shared::text::ui::MessagingRestoreButton));
    lila::shared::accessibility::AccessibilityUtils::SetAccessibleName(*purgeButton, lila::shared::text::FromUtf8(lila::shared::text::ui::MessagingPurgeButton));
    lila::shared::accessibility::AccessibilityUtils::ConfigureLinearTabOrder({detailCtrl, replyButton, deleteButton, restoreButton, purgeButton});
    detailPanel->SetSizer(sizer);
}
}
