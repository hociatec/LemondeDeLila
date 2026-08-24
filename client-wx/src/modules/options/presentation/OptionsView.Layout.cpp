#include "modules/options/presentation/OptionsView.h"

#include <span>

#include <wx/button.h>
#include <wx/font.h>
#include <wx/panel.h>
#include <wx/scrolwin.h>
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
    auto* subtitleLabel = new wxStaticText(headerPanel, wxID_ANY, wxString(L"Général, sons, tchat"));
    wxFont titleFont = titleLabel->GetFont();
    titleFont.SetPointSize(28);
    titleFont.SetWeight(wxFONTWEIGHT_BOLD);
    titleLabel->SetFont(titleFont);
    headerSizer->Add(titleLabel, 0);
    headerSizer->Add(subtitleLabel, 0, wxTOP, 4);
    headerPanel->SetSizer(headerSizer);

    auto* optionsCard = new lila::shared::accessibility::NonFocusablePanel(this);
    auto* optionsLayout = new wxBoxSizer(wxHORIZONTAL);
    sectionsPanel = new lila::shared::accessibility::NonFocusablePanel(optionsCard);
    sectionsPanel->SetMinSize(wxSize(SectionMenuMinWidth, -1));
    BuildSectionMenu(sectionsPanel);

    auto* contentPanel = new lila::shared::accessibility::NonFocusablePanel(optionsCard);
    auto* contentSizer = new wxBoxSizer(wxVERTICAL);
    BuildSectionPages(contentPanel);
    contentSizer->Add(sectionBook, 1, wxEXPAND);
    contentPanel->SetSizer(contentSizer);

    optionsLayout->Add(sectionsPanel, 0, wxEXPAND | wxRIGHT, 16);
    optionsLayout->Add(contentPanel, 1, wxEXPAND);
    auto* optionsCardSizer = new wxBoxSizer(wxVERTICAL);
    optionsCardSizer->Add(optionsLayout, 1, wxEXPAND | wxALL, 16);
    optionsCard->SetSizer(optionsCardSizer);

    auto* actionFooterPanel = new lila::shared::accessibility::NonFocusablePanel(this);
    auto* actionFooterSizer = new wxBoxSizer(wxHORIZONTAL);
    statusLabel = new wxStaticText(actionFooterPanel, wxID_ANY, wxEmptyString);
    cancelButton = new wxButton(actionFooterPanel, wxID_ANY, wxString(L"Annuler"));
    actionFooterSizer->Add(statusLabel, 1, wxALIGN_CENTER_VERTICAL);
    actionFooterSizer->Add(cancelButton, 0);
    actionFooterPanel->SetSizer(actionFooterSizer);

    rootSizer->Add(headerPanel, 0, wxEXPAND | wxLEFT | wxRIGHT | wxTOP, 24);
    rootSizer->AddSpacer(12);
    rootSizer->Add(optionsCard, 1, wxEXPAND | wxLEFT | wxRIGHT, 24);
    rootSizer->AddSpacer(16);
    rootSizer->Add(actionFooterPanel, 0, wxEXPAND | wxLEFT | wxRIGHT | wxBOTTOM, 24);
    SetSizer(rootSizer);

    lila::shared::accessibility::AccessibilityUtils::SetAccessibleName(*titleLabel, wxString(L"Options"));
    lila::shared::accessibility::AccessibilityUtils::SetAccessibleName(*subtitleLabel, wxString(L"Général, sons, tchat"));
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
        lila::shared::ui::navigation::BuildMenuItems(std::span(menuItems)),
        lila::shared::ui::controls::VerticalMenuRole::Entries);
    sectionsMenu->SetTabNavigationEnabled(false);
    sectionSizer->Add(sectionsMenu, 1, wxEXPAND);
    parent->SetSizer(sectionSizer);
    lila::shared::accessibility::AccessibilityUtils::SetAccessibleName(*sectionsMenu, wxString(L"Options"));
}

void OptionsView::BuildSectionPages(wxWindow* parent)
{
    if (parent == nullptr || sectionBook != nullptr)
    {
        return;
    }

    sectionBook = new wxSimplebook(parent, wxID_ANY);
    const auto createPage = [this]() -> wxScrolledWindow*
    {
        auto* page = new wxScrolledWindow(sectionBook, wxID_ANY, wxDefaultPosition, wxDefaultSize, wxVSCROLL);
        page->SetScrollRate(0, 12);
        return page;
    };
    generalPage = createPage();
    soundsPage = createPage();
    chatPage = createPage();

    BuildGeneralPage(generalPage);
    BuildSoundsPage(soundsPage);
    BuildChatPage(chatPage);

    sectionBook->AddPage(generalPage, wxEmptyString);
    sectionBook->AddPage(soundsPage, wxEmptyString);
    sectionBook->AddPage(chatPage, wxEmptyString);
    sectionBook->SetSelection(0);
}
}
