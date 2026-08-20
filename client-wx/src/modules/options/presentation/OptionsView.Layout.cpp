#include "modules/options/presentation/OptionsView.h"

#include <span>

#include <wx/button.h>
#include <wx/panel.h>
#include <wx/simplebook.h>
#include <wx/sizer.h>
#include <wx/stattext.h>

#include "shared/accessibility/AccessibilityUtils.h"
#include "shared/accessibility/NonFocusablePanel.h"
#include "shared/ui/controls/VerticalMenu.h"
#include "shared/ui/navigation/MenuBlueprint.h"

namespace lila::modules::options::presentation
{
namespace
{
constexpr int SectionMenuMinWidth = 220;
}

void OptionsView::BuildLayout()
{
    auto* rootSizer = new wxBoxSizer(wxVERTICAL);

    auto* headerPanel = new lila::shared::accessibility::NonFocusablePanel(this);
    auto* headerSizer = new wxBoxSizer(wxVERTICAL);
    auto* titleLabel = new wxStaticText(headerPanel, wxID_ANY, wxString(L"Options"));
    auto* subtitleLabel = new wxStaticText(headerPanel, wxID_ANY, wxString(L"Préférences du client"));
    headerSizer->Add(titleLabel, 0, wxALIGN_CENTER_HORIZONTAL);
    headerSizer->Add(subtitleLabel, 0, wxALIGN_CENTER_HORIZONTAL | wxTOP, 6);
    headerPanel->SetSizer(headerSizer);

    auto* optionsLayout = new wxBoxSizer(wxHORIZONTAL);
    sectionsPanel = new lila::shared::accessibility::NonFocusablePanel(this);
    sectionsPanel->SetMinSize(wxSize(SectionMenuMinWidth, -1));
    BuildSectionMenu(sectionsPanel);

    auto* contentPanel = new lila::shared::accessibility::NonFocusablePanel(this);
    auto* contentSizer = new wxBoxSizer(wxVERTICAL);
    BuildSectionPages(contentPanel);
    contentSizer->Add(sectionBook, 1, wxEXPAND);

    auto* actionFooterPanel = new lila::shared::accessibility::NonFocusablePanel(contentPanel);
    auto* actionFooterSizer = new wxBoxSizer(wxHORIZONTAL);
    statusLabel = new wxStaticText(actionFooterPanel, wxID_ANY, wxEmptyString);
    cancelButton = new wxButton(actionFooterPanel, wxID_ANY, wxString(L"Annuler"));
    actionFooterSizer->Add(statusLabel, 1, wxALIGN_CENTER_VERTICAL);
    actionFooterSizer->Add(cancelButton, 0);
    actionFooterPanel->SetSizer(actionFooterSizer);

    contentSizer->Add(actionFooterPanel, 0, wxEXPAND | wxTOP, 8);
    contentPanel->SetSizer(contentSizer);

    optionsLayout->Add(sectionsPanel, 0, wxEXPAND | wxRIGHT, 16);
    optionsLayout->Add(contentPanel, 1, wxEXPAND);

    rootSizer->Add(headerPanel, 0, wxEXPAND | wxTOP | wxLEFT | wxRIGHT, 20);
    rootSizer->Add(optionsLayout, 1, wxEXPAND | wxLEFT | wxRIGHT | wxBOTTOM, 16);
    SetSizer(rootSizer);

    lila::shared::accessibility::AccessibilityUtils::SetAccessibleName(*titleLabel, wxString(L"Options"));
    lila::shared::accessibility::AccessibilityUtils::SetAccessibleName(*subtitleLabel, wxString(L"Préférences du client"));
    lila::shared::accessibility::AccessibilityUtils::SetAccessibleName(*statusLabel, wxString(L"État"));
    lila::shared::accessibility::AccessibilityUtils::SetAccessibleName(*cancelButton, wxString(L"Annuler"));
    lila::shared::accessibility::AccessibilityUtils::SetAccessibleName(*sectionBook, wxString(L"Contenu des options"));
    lila::shared::accessibility::AccessibilityUtils::SetAccessibleName(*sectionsPanel, wxString(L"Navigation des options"));
}

void OptionsView::BuildSectionMenu(wxWindow* parent)
{
    static const lila::shared::ui::navigation::MenuBlueprintItem menuItems[] = {
        {"general", wxString(L"Général"), wxString(L"Section Général")},
        {"sounds", wxString(L"Sons"), wxString(L"Section Sons")},
        {"chat", wxString(L"Tchat"), wxString(L"Section Tchat")},
    };

    if (parent == nullptr)
    {
        return;
    }

    auto* sectionSizer = new wxBoxSizer(wxVERTICAL);
    sectionsMenu = new lila::shared::ui::controls::VerticalMenu(
        parent,
        lila::shared::ui::navigation::BuildMenuItems(std::span(menuItems)));
    sectionsMenu->SetTabNavigationEnabled(false);
    sectionSizer->Add(sectionsMenu, 1, wxEXPAND);
    parent->SetSizer(sectionSizer);
    lila::shared::accessibility::AccessibilityUtils::SetAccessibleName(*sectionsMenu, wxString(L"Sections des options"));
}

void OptionsView::BuildSectionPages(wxWindow* parent)
{
    if (parent == nullptr || sectionBook != nullptr)
    {
        return;
    }

    sectionBook = new wxSimplebook(parent, wxID_ANY);
    generalPage = new lila::shared::accessibility::NonFocusablePanel(sectionBook);
    soundsPage = new lila::shared::accessibility::NonFocusablePanel(sectionBook);
    chatPage = new lila::shared::accessibility::NonFocusablePanel(sectionBook);

    BuildGeneralPage(generalPage);
    BuildSoundsPage(soundsPage);
    BuildChatPage(chatPage);

    sectionBook->AddPage(generalPage, wxString(L"Général"));
    sectionBook->AddPage(soundsPage, wxString(L"Sons"));
    sectionBook->AddPage(chatPage, wxString(L"Tchat"));
    sectionBook->SetSelection(0);
}
}
