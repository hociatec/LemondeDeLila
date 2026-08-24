#include "modules/options/presentation/OptionsView.h"

#include <wx/button.h>
#include <wx/font.h>
#include <wx/notebook.h>
#include <wx/panel.h>
#include <wx/scrolwin.h>
#include <wx/sizer.h>
#include <wx/stattext.h>

#include "shared/accessibility/presentation/AccessibilityUtils.h"
#include "shared/accessibility/presentation/NonFocusablePanel.h"

namespace lila::modules::options::presentation
{
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
    auto* optionsCardSizer = new wxBoxSizer(wxVERTICAL);
    BuildSectionPages(optionsCard);
    optionsCardSizer->Add(sectionBook, 1, wxEXPAND | wxALL, 16);
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
    lila::shared::accessibility::AccessibilityUtils::SetAccessibleName(
        *subtitleLabel,
        wxString(L"Général, sons, tchat"));
    lila::shared::accessibility::AccessibilityUtils::SetAccessibleName(*statusLabel, wxString(L"État"));
    lila::shared::accessibility::AccessibilityUtils::SetAccessibleName(*cancelButton, wxString(L"Annuler"));
    lila::shared::accessibility::AccessibilityUtils::SetAccessibleName(
        *sectionBook,
        wxString(L"Catégories des options"));
}

void OptionsView::BuildSectionPages(wxWindow* parent)
{
    if (parent == nullptr || sectionBook != nullptr)
    {
        return;
    }

    sectionBook = new wxNotebook(
        parent,
        wxID_ANY,
        wxDefaultPosition,
        wxDefaultSize,
        wxNB_LEFT);
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

    sectionBook->AddPage(generalPage, wxString(L"Général"), true);
    sectionBook->AddPage(soundsPage, wxString(L"Sons"));
    sectionBook->AddPage(chatPage, wxString(L"Tchat"));

    lila::shared::accessibility::AccessibilityUtils::SetAccessibleName(
        *generalPage,
        wxString(L"Options générales"));
    lila::shared::accessibility::AccessibilityUtils::SetAccessibleName(
        *soundsPage,
        wxString(L"Options des sons"));
    lila::shared::accessibility::AccessibilityUtils::SetAccessibleName(
        *chatPage,
        wxString(L"Options du tchat"));
}
}
