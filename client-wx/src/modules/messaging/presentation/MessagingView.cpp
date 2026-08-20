#include "shared/text/Encoding.h"
#include "modules/messaging/presentation/MessagingView.h"

#include <wx/simplebook.h>
#include <wx/sizer.h>
#include <wx/stattext.h>

#include "shared/accessibility/AccessibilityUtils.h"
#include "shared/accessibility/NonFocusablePanel.h"
#include "shared/text/UiTexts.h"

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

    screenBook->AddPage(menuPanel, lila::shared::text::FromUtf8(lila::shared::text::ui::MessagingPageMenu));
    screenBook->AddPage(listPanel, lila::shared::text::FromUtf8(lila::shared::text::ui::MessagingPageList));
    screenBook->AddPage(detailPanel, lila::shared::text::FromUtf8(lila::shared::text::ui::MessagingPageDetail));
    screenBook->AddPage(composePanel, lila::shared::text::FromUtf8(lila::shared::text::ui::MessagingPageCompose));

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
    sizer->Add(titleLabel, 0, wxALIGN_CENTER_HORIZONTAL);
    sizer->Add(subtitleLabel, 0, wxALIGN_CENTER_HORIZONTAL | wxTOP, 4);
    sizer->Add(statusLabel, 0, wxALIGN_CENTER_HORIZONTAL | wxTOP, 6);
    panel->SetSizer(sizer);
    return panel;
}
}
