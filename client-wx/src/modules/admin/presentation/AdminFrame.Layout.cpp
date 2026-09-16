#include "modules/admin/presentation/AdminFrame.h"

#include <span>

#include <wx/sizer.h>
#include <wx/stattext.h>
#include <wx/textctrl.h>
#include <wx/button.h>
#include <wx/choice.h>
#include <wx/panel.h>

#include "shared/accessibility/presentation/NonFocusablePanel.h"
#include "shared/ui/presentation/controls/VerticalMenu.h"

namespace lila::modules::admin::presentation
{
void AdminFrame::BuildLayout()
{
    SetMinSize(wxSize(1100, 760));
    auto* rootSizer = new wxBoxSizer(wxVERTICAL);
    titleLabel_ = new wxStaticText(this, wxID_ANY, wxString(L"Administration"));
    rootSizer->Add(titleLabel_, 0, wxEXPAND | wxLEFT | wxRIGHT | wxTOP, 24);

    auto* content = new lila::shared::accessibility::NonFocusablePanel(this);
    auto* contentSizer = new wxBoxSizer(wxHORIZONTAL);
    const std::span<const lila::shared::ui::controls::VerticalMenuItem> empty;
    sectionsMenu_ = new lila::shared::ui::controls::VerticalMenu(
        content, empty, lila::shared::ui::controls::VerticalMenuRole::Menu);
    commandsMenu_ = new lila::shared::ui::controls::VerticalMenu(
        content, empty, lila::shared::ui::controls::VerticalMenuRole::Menu);
    sectionsMenu_->SetMinSize(wxSize(360, -1));
    commandsMenu_->SetMinSize(wxSize(420, -1));

    auto* resultPanel = new lila::shared::accessibility::NonFocusablePanel(content);
    auto* resultSizer = new wxBoxSizer(wxVERTICAL);
    resultSummaryLabel_ = new wxStaticText(
        resultPanel, wxID_ANY, wxString(L"Résultat"));
    resultSizer->Add(resultSummaryLabel_, 0, wxEXPAND | wxBOTTOM, 8);

    reportSearchPanel_ = new wxPanel(resultPanel, wxID_ANY);
    auto* reportSearchSizer = new wxBoxSizer(wxVERTICAL);
    reportStatusMenu_ = new lila::shared::ui::controls::VerticalMenu(
        reportSearchPanel_, empty, lila::shared::ui::controls::VerticalMenuRole::Menu);
    reportSearchSizer->Add(reportStatusMenu_, 0, wxEXPAND);
    reportSearchPanel_->SetSizer(reportSearchSizer);
    reportSearchPanel_->Hide();
    resultSizer->Add(reportSearchPanel_, 0, wxEXPAND | wxBOTTOM, 8);

    paginationPanel_ = new wxPanel(resultPanel, wxID_ANY);
    auto* paginationSizer = new wxBoxSizer(wxHORIZONTAL);
    paginationLabel_ = new wxStaticText(
        paginationPanel_, wxID_ANY, wxString(L"Pagination"));
    previousPageButton_ = new wxButton(
        paginationPanel_, wxID_ANY, wxString(L"Page précédente"));
    nextPageButton_ = new wxButton(
        paginationPanel_, wxID_ANY, wxString(L"Page suivante"));
    pageSizeChoice_ = new wxChoice(paginationPanel_, wxID_ANY);
    paginationSizer->Add(paginationLabel_, 1, wxALIGN_CENTER_VERTICAL | wxRIGHT, 12);
    paginationSizer->Add(previousPageButton_, 0, wxRIGHT, 8);
    paginationSizer->Add(nextPageButton_, 0, wxRIGHT, 12);
    paginationSizer->Add(pageSizeChoice_, 0, wxALIGN_CENTER_VERTICAL);
    paginationPanel_->SetSizer(paginationSizer);
    paginationPanel_->Hide();
    resultSizer->Add(paginationPanel_, 0, wxEXPAND | wxBOTTOM, 8);

    resultsMenu_ = new lila::shared::ui::controls::VerticalMenu(
        resultPanel, empty, lila::shared::ui::controls::VerticalMenuRole::List);
    resultsMenu_->SetMinSize(wxSize(-1, 180));
    resultsMenu_->Hide();
    resultSizer->Add(resultsMenu_, 0, wxEXPAND | wxBOTTOM, 8);

    resultText_ = new wxTextCtrl(
        resultPanel, wxID_ANY, wxString{}, wxDefaultPosition, wxDefaultSize,
        wxTE_MULTILINE | wxTE_READONLY | wxTE_DONTWRAP);
    contentSizer->Add(sectionsMenu_, 0, wxEXPAND | wxRIGHT, 16);
    contentSizer->Add(commandsMenu_, 0, wxEXPAND | wxRIGHT, 16);
    resultSizer->Add(resultText_, 1, wxEXPAND);

    reportActionsPanel_ = new wxPanel(resultPanel, wxID_ANY);
    auto* reportActionsSizer = new wxBoxSizer(wxHORIZONTAL);
    editReportButton_ = new wxButton(
        reportActionsPanel_, wxID_ANY, wxString(L"Modifier ce rapport"));
    changeReportStatusButton_ = new wxButton(
        reportActionsPanel_, wxID_ANY, wxString(L"Consulter ce rapport"));
    deleteReportButton_ = new wxButton(
        reportActionsPanel_, wxID_ANY, wxString(L"Supprimer ce rapport"));
    reportActionsSizer->Add(changeReportStatusButton_, 0, wxRIGHT, 8);
    reportActionsSizer->Add(deleteReportButton_, 0);
    reportActionsSizer->Add(editReportButton_, 0, wxLEFT, 8);
    reportActionsPanel_->SetSizer(reportActionsSizer);
    reportActionsPanel_->Hide();
    resultSizer->Add(reportActionsPanel_, 0, wxEXPAND | wxTOP, 8);
    resultPanel->SetSizer(resultSizer);
    contentSizer->Add(resultPanel, 1, wxEXPAND);
    content->SetSizer(contentSizer);
    rootSizer->Add(content, 1, wxEXPAND | wxALL, 24);

    statusLabel_ = new wxStaticText(
        this, wxID_ANY,
        wxString{});
    rootSizer->Add(statusLabel_, 0, wxEXPAND | wxLEFT | wxRIGHT | wxBOTTOM, 24);
    SetSizer(rootSizer);
}
}
