#include "modules/admin/presentation/AdminFrame.h"

#include <span>

#include <wx/sizer.h>
#include <wx/stattext.h>
#include <wx/textctrl.h>
#include <wx/button.h>
#include <wx/choice.h>
#include <wx/panel.h>

#include "shared/accessibility/presentation/AccessibilityUtils.h"
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

    sectionsMenu_->SetAccessibleName(wxString(L"Rubriques d’administration"));
    commandsMenu_->SetAccessibleName(wxString(L"Opérations de la rubrique"));

    auto* resultPanel = new lila::shared::accessibility::NonFocusablePanel(content);
    auto* resultSizer = new wxBoxSizer(wxVERTICAL);
    resultSummaryLabel_ = new wxStaticText(
        resultPanel, wxID_ANY, wxString(L"Aide de la rubrique"));
    lila::shared::accessibility::AccessibilityUtils::SetAccessibleName(
        *resultSummaryLabel_, wxString(L"Résumé du résultat"));
    resultSizer->Add(resultSummaryLabel_, 0, wxEXPAND | wxBOTTOM, 8);

    reportSearchPanel_ = new wxPanel(resultPanel, wxID_ANY);
    auto* reportSearchSizer = new wxBoxSizer(wxHORIZONTAL);
    createReportButton_ = new wxButton(
        reportSearchPanel_, wxID_ANY, wxString(L"Nouveau rapport"));
    reportStatusFilter_ = new wxChoice(reportSearchPanel_, wxID_ANY);
    for (const auto& label : {
             wxString(L"Tous les rapports"), wxString(L"En attente"), wxString(L"En cours"),
             wxString(L"Corrigés, à tester"), wxString(L"Terminés"),
             wxString(L"Refusés")})
        reportStatusFilter_->Append(label);
    reportStatusFilter_->SetSelection(0);
    reportSearchSizer->Add(createReportButton_, 0, wxRIGHT, 8);
    reportSearchSizer->Add(reportStatusFilter_, 0);
    reportSearchPanel_->SetSizer(reportSearchSizer);
    reportSearchPanel_->Hide();
    lila::shared::accessibility::AccessibilityUtils::SetAccessibleName(
        *createReportButton_, wxString(L"Créer un nouveau rapport"),
        wxString(L"Ouvre la rédaction. Le rapport sera classé en attente."));
    lila::shared::accessibility::AccessibilityUtils::SetAccessibleName(
        *reportStatusFilter_, wxString(L"Classement des rapports affichés"),
        wxString(L"Choisissez les rapports en attente, en cours, corrigés à tester, terminés, refusés ou tous."));
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
    lila::shared::accessibility::AccessibilityUtils::SetAccessibleName(
        *paginationLabel_, wxString(L"État de la pagination"));
    lila::shared::accessibility::AccessibilityUtils::SetAccessibleName(
        *previousPageButton_, wxString(L"Afficher la page précédente"));
    lila::shared::accessibility::AccessibilityUtils::SetAccessibleName(
        *nextPageButton_, wxString(L"Afficher la page suivante"));
    lila::shared::accessibility::AccessibilityUtils::SetAccessibleName(
        *pageSizeChoice_, wxString(L"Nombre d’éléments affichés par page"));
    resultSizer->Add(paginationPanel_, 0, wxEXPAND | wxBOTTOM, 8);

    resultsMenu_ = new lila::shared::ui::controls::VerticalMenu(
        resultPanel, empty, lila::shared::ui::controls::VerticalMenuRole::List);
    resultsMenu_->SetAccessibleName(wxString(L"Éléments du résultat"));
    resultsMenu_->SetMinSize(wxSize(-1, 180));
    resultsMenu_->Hide();
    resultSizer->Add(resultsMenu_, 0, wxEXPAND | wxBOTTOM, 8);

    resultText_ = new wxTextCtrl(
        resultPanel, wxID_ANY, wxString{}, wxDefaultPosition, wxDefaultSize,
        wxTE_MULTILINE | wxTE_READONLY | wxTE_DONTWRAP);
    lila::shared::accessibility::AccessibilityUtils::SetAccessibleName(
        *resultText_, wxString(L"Résultat de l’opération administrateur"),
        wxString(L"Zone de résultat en lecture seule. Utilisez les flèches pour lire le contenu et Échap pour revenir aux opérations."));
    contentSizer->Add(sectionsMenu_, 0, wxEXPAND | wxRIGHT, 16);
    contentSizer->Add(commandsMenu_, 0, wxEXPAND | wxRIGHT, 16);
    resultSizer->Add(resultText_, 1, wxEXPAND);

    reportActionsPanel_ = new wxPanel(resultPanel, wxID_ANY);
    auto* reportActionsSizer = new wxBoxSizer(wxHORIZONTAL);
    editReportButton_ = new wxButton(
        reportActionsPanel_, wxID_ANY, wxString(L"Modifier ce rapport"));
    changeReportStatusButton_ = new wxButton(
        reportActionsPanel_, wxID_ANY, wxString(L"Classer ce rapport"));
    deleteReportButton_ = new wxButton(
        reportActionsPanel_, wxID_ANY, wxString(L"Supprimer ce rapport"));
    reportActionsSizer->Add(editReportButton_, 0, wxRIGHT, 8);
    reportActionsSizer->Add(changeReportStatusButton_, 0, wxRIGHT, 8);
    reportActionsSizer->Add(deleteReportButton_, 0);
    reportActionsPanel_->SetSizer(reportActionsSizer);
    reportActionsPanel_->Hide();
    lila::shared::accessibility::AccessibilityUtils::SetAccessibleName(
        *editReportButton_, wxString(L"Modifier le rapport affiché"));
    lila::shared::accessibility::AccessibilityUtils::SetAccessibleName(
        *changeReportStatusButton_, wxString(L"Changer le classement du rapport affiché"));
    lila::shared::accessibility::AccessibilityUtils::SetAccessibleName(
        *deleteReportButton_, wxString(L"Supprimer le rapport affiché"));
    resultSizer->Add(reportActionsPanel_, 0, wxEXPAND | wxTOP, 8);
    resultPanel->SetSizer(resultSizer);
    contentSizer->Add(resultPanel, 1, wxEXPAND);
    content->SetSizer(contentSizer);
    rootSizer->Add(content, 1, wxEXPAND | wxALL, 24);

    statusLabel_ = new wxStaticText(
        this, wxID_ANY,
        wxString(L"Flèches : naviguer. Entrée : ouvrir ou valider. Échap : revenir à l’écran précédent."));
    rootSizer->Add(statusLabel_, 0, wxEXPAND | wxLEFT | wxRIGHT | wxBOTTOM, 24);
    lila::shared::accessibility::AccessibilityUtils::SetAccessibleName(
        *statusLabel_, wxString(L"État de la console d’administration"));
    SetSizer(rootSizer);
}
}
