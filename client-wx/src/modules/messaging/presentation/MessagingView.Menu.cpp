#include "shared/text/presentation/encoding/Encoding.h"
#include "modules/messaging/presentation/MessagingView.h"
#include "modules/messaging/presentation/MessagingPresentationModel.h"

#include <array>
#include <wx/listbox.h>
#include <wx/simplebook.h>
#include <wx/sizer.h>
#include <wx/stattext.h>
#include <wx/textctrl.h>

#include "shared/accessibility/presentation/AccessibilityUtils.h"
#include "shared/text/presentation/catalog/UiTexts.h"
#include "shared/ui/presentation/controls/VerticalMenu.h"
#include "shared/ui/presentation/navigation/MenuBlueprint.h"

namespace lila::modules::messaging::presentation
{
void MessagingView::BuildMenuScreen()
{
    menuPanel = new wxPanel(screenBook);
    auto* sizer = new wxBoxSizer(wxVERTICAL);
    static const std::array<lila::shared::ui::navigation::MenuBlueprintItem, 4> menuItems = {{
        {"compose", lila::shared::text::FromUtf8(lila::shared::text::ui::MessagingMenuCompose)},
        {"inbox", lila::shared::text::FromUtf8(lila::shared::text::ui::MessagingMenuInbox)},
        {"outbox", lila::shared::text::FromUtf8(lila::shared::text::ui::MessagingMenuOutbox)},
        {"deleted", lila::shared::text::FromUtf8(lila::shared::text::ui::MessagingMenuDeleted)},
    }};
    menu = new lila::shared::ui::controls::VerticalMenu(
        menuPanel,
        lila::shared::ui::navigation::BuildMenuItems(menuItems),
        lila::shared::ui::controls::VerticalMenuRole::List);
    lila::shared::accessibility::AccessibilityUtils::SetAccessibleName(*menu, wxString(L"Messages"));
    sizer->Add(menu, 1, wxEXPAND);
    menuPanel->SetSizer(sizer);
}

void MessagingView::BuildListScreen()
{
    listPanel = new wxPanel(screenBook);
    auto* sizer = new wxBoxSizer(wxVERTICAL);
    listTitleLabel = new wxStaticText(listPanel, wxID_ANY, MessagingPresentationModel::BoxTitle(domain::MessagingBox::Inbox));
    listTitleLabel->Hide();
    messagesList = new wxListBox(listPanel, wxID_ANY);
    emptyMessagesCtrl = new wxTextCtrl(listPanel, wxID_ANY, lila::shared::text::FromUtf8(lila::shared::text::ui::MessagingNoMessage), wxDefaultPosition, wxDefaultSize, wxTE_MULTILINE | wxTE_READONLY | wxTE_RICH2 | wxBORDER_NONE);
    emptyMessagesCtrl->SetMinSize(wxSize(-1, 80));
    sizer->Add(listTitleLabel, 0, wxBOTTOM, 10);
    sizer->Add(messagesList, 1, wxEXPAND | wxBOTTOM, 12);
    sizer->Add(emptyMessagesCtrl, 0, wxEXPAND);
    lila::shared::accessibility::AccessibilityUtils::SetAccessibleName(*listTitleLabel, lila::shared::text::FromUtf8(lila::shared::text::ui::MessagingListHeader));
    lila::shared::accessibility::AccessibilityUtils::SetAccessibleName(*messagesList, lila::shared::text::FromUtf8(lila::shared::text::ui::MessagingListHeader));
    lila::shared::accessibility::AccessibilityUtils::SetAccessibleName(*emptyMessagesCtrl, lila::shared::text::FromUtf8(lila::shared::text::ui::MessagingNoMessage));
    lila::shared::accessibility::AccessibilityUtils::ConfigureLinearTabOrder({listTitleLabel, messagesList, emptyMessagesCtrl});
    listPanel->SetSizer(sizer);
}
}
