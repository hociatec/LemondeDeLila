#include "shared/text/presentation/encoding/Encoding.h"
#include "modules/messaging/presentation/MessagingView.h"

#include <wx/simplebook.h>
#include <wx/sizer.h>
#include <wx/stattext.h>

#include "shared/accessibility/presentation/AccessibilityUtils.h"
#include "shared/accessibility/presentation/NonFocusablePanel.h"
#include "shared/text/presentation/catalog/UiTexts.h"

namespace lila::modules::messaging::presentation
{
MessagingView::MessagingView(wxWindow* parent)
    : wxPanel(parent)
{
    BuildLayout();
}

MessagingView::ShellControls MessagingView::Shell() const noexcept
{
    return {statusLabel, menu, screenBook};
}

MessagingView::ListControls MessagingView::List() const noexcept
{
    return {listTitleLabel, messagesList, emptyMessagesCtrl};
}

MessagingView::DetailControls MessagingView::Detail() const noexcept
{
    return {detailCtrl, replyButton, deleteButton, restoreButton, purgeButton};
}

MessagingView::ComposeControls MessagingView::Compose() const noexcept
{
    return {recipientCtrl, subjectCtrl, bodyCtrl, sendComposeButton, cancelComposeButton};
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

    screenBook->AddPage(menuPanel, wxEmptyString);
    screenBook->AddPage(listPanel, wxEmptyString);
    screenBook->AddPage(detailPanel, wxEmptyString);
    screenBook->AddPage(composePanel, wxEmptyString);

    rootSizer->Add(headerPanel, 0, wxEXPAND | wxTOP | wxLEFT | wxRIGHT, 28);
    rootSizer->Add(screenBook, 1, wxEXPAND | wxALL, 24);
    SetSizer(rootSizer);
}

wxPanel* MessagingView::BuildHeader()
{
    auto* panel = new lila::shared::accessibility::NonFocusablePanel(this, 0);
    auto* sizer = new wxBoxSizer(wxVERTICAL);
    auto* titleLabel = new wxStaticText(panel, wxID_ANY, lila::shared::text::FromUtf8(lila::shared::text::ui::MessagingFrameHeader));
    auto* subtitleLabel = new wxStaticText(panel, wxID_ANY, lila::shared::text::FromUtf8(lila::shared::text::ui::MessagingFrameSubtitle));
    statusLabel = new wxStaticText(panel, wxID_ANY, lila::shared::text::FromUtf8(lila::shared::text::ui::MessagingFrameInitialStatus));
    lila::shared::accessibility::AccessibilityUtils::SetAccessibleName(*statusLabel, lila::shared::text::FromUtf8(lila::shared::text::ui::MessagingFrameStatusAccessible));
    titleLabel->Hide();
    subtitleLabel->Hide();
    sizer->Add(titleLabel, 0, wxALIGN_CENTER_HORIZONTAL);
    sizer->Add(subtitleLabel, 0, wxALIGN_CENTER_HORIZONTAL | wxTOP, 4);
    sizer->Add(statusLabel, 0, wxALIGN_CENTER_HORIZONTAL | wxTOP, 6);
    panel->SetSizer(sizer);
    return panel;
}
}
