#include "modules/admin/presentation/AdminFrame.h"

#include <algorithm>
#include <span>

#include <wx/stattext.h>
#include <wx/textctrl.h>
#include <wx/button.h>
#include <wx/choice.h>
#include <wx/panel.h>

#include "shared/security/infrastructure/SecurityUtils.h"
#include "shared/ui/presentation/controls/VerticalMenu.h"

namespace lila::modules::admin::presentation
{
void AdminFrame::ShowSections()
{
    requestSlot_.Cancel();
    loading_ = false;
    loadingReportCountsOnly_ = false;
    std::vector<lila::shared::ui::controls::VerticalMenuItem> items;
    const auto& areas = domain::GetAdminAreas();
    items.reserve(areas.size());
    for (std::size_t index = 0; index < areas.size(); ++index)
        items.push_back({
            std::string(areas[index].id),
            wxString(areas[index].label.data()),
        });
    sectionsMenu_->SetItems(items);
    sectionsMenu_->SetSelectedIndexSilently(selectedSection_);
    sectionsMenu_->Show();
    commandsMenu_->Hide();
    reportSearchPanel_->Hide();
    reportActionsPanel_->Hide();
    paginationPanel_->Hide();
    paginationCommand_ = nullptr;
    paginationPayload_ = nlohmann::json::object();
    pageSizeChoices_.clear();
    resultItems_.clear();
    selectedResultIndex_.reset();
    reportIdToRestore_.reset();
    refreshBugReportsAfterCommand_ = false;
    refreshAreaAfterCommand_ = false;
    keepFocusAfterCommand_ = false;
    showingItemActions_ = false;
    currentResultItemKind_ = domain::AdminItemKind::None;
    contextItem_ = nlohmann::json::object();
    contextActionPayloads_.clear();
    contextActionDirect_.clear();
    showingCommands_ = false;
    titleLabel_->SetLabel(wxString(L"Administration"));
    SetStatus(wxString(areas[selectedSection_].description.data()));
    Layout();
    FocusCurrentMenu();
}

void AdminFrame::ShowCommands(std::size_t sectionIndex)
{
    if (loading_ || sectionIndex >= domain::GetAdminAreas().size()) return;
    selectedSection_ = sectionIndex;
    const auto& area = domain::GetAdminAreas()[sectionIndex];
    visibleCommands_.clear();
    for (const auto commandId : area.commandIds)
        if (const auto* command = domain::FindAdminCommand(commandId))
            visibleCommands_.push_back(command);
    const bool bugReports = area.id == "reports";
    resultText_->Show(!bugReports);
    std::vector<lila::shared::ui::controls::VerticalMenuItem> items;
    items.reserve(visibleCommands_.size());
    for (const auto* command : visibleCommands_)
        items.push_back({command->id, wxString(command->label)});
    commandsMenu_->SetItems(items);
    if (!items.empty())
        commandsMenu_->SetSelectedIndexSilently(
            std::min(commandSelections_[sectionIndex], items.size() - 1));
    sectionsMenu_->Hide();
    // Les rapports s'ouvrent directement sur leur liste : il n'y a pas
    // d'étape intermédiaire « opérations » à traverser au clavier.
    commandsMenu_->Show(!bugReports);
    showingCommands_ = true;
    titleLabel_->SetLabel(
        wxString(L"Administration — ") +
        wxString(area.label.data()));
    resultText_->SetValue(bugReports
        ? wxString(L"Chargement de la liste des rapports…")
        : wxString(area.description.data()) +
            wxString(L"\n\nChoisissez une opération dans la liste. Son formulaire métier s’ouvrira avec les champs adaptés."));
    resultSummaryLabel_->SetLabel(wxString(L"Résultat"));
    resultSummaryLabel_->Show(!bugReports);
    resultsMenu_->Hide();
    reportSearchPanel_->Show(bugReports);
    if (bugReports)
    {
        const std::array<std::wstring_view, 5> labels{
            L"En attente", L"En cours", L"À corriger", L"Terminés", L"Refusés"};
        std::vector<lila::shared::ui::controls::VerticalMenuItem> statuses;
        statuses.reserve(labels.size() + 1);
        statuses.push_back({"new", wxString(L"Nouveau rapport")});
        for (std::size_t index = 0; index < labels.size(); ++index)
            statuses.push_back({std::to_string(index), wxString(labels[index])});
        reportStatusMenu_->SetItems(statuses);
        reportStatusMenu_->SetSelectedIndexSilently(0);
    }
    reportActionsPanel_->Hide();
    paginationPanel_->Hide();
    paginationCommand_ = nullptr;
    paginationPayload_ = nlohmann::json::object();
    pageSizeChoices_.clear();
    resultDetails_.clear();
    resultItems_.clear();
    selectedResultIndex_.reset();
    SetStatus(items.empty() ? wxString(L"Aucune action disponible.") :
        wxString(visibleCommands_[commandsMenu_->GetSelectedIndex()]->description));
    Layout();
    LoadAutomaticAreaContent();
    if (bugReports) reportStatusMenu_->GetSelectedControl()->SetFocus();
    else FocusCurrentMenu();
}

void AdminFrame::LoadAutomaticAreaContent()
{
    const auto& area = domain::GetAdminAreas()[selectedSection_];
    if (area.automaticCommandId.empty()) return;
    if (area.id == "reports")
    {
        resultText_->SetValue(
            wxString(L"Choisissez « Créer un nouveau rapport » ou un statut, puis appuyez sur Entrée."));
        const auto* command = domain::FindAdminCommand("bugs.list");
        if (command != nullptr)
        {
            loadingReportCountsOnly_ = true;
            ExecuteCommand(*command, {{"offset", 0}, {"limit", 1}}, false);
        }
        return;
    }
    const auto* command = domain::FindAdminCommand(area.automaticCommandId);
    if (command == nullptr) return;
    keepFocusAfterCommand_ = true;
    ExecuteCommand(
        *command,
        nlohmann::json::parse(command->payloadTemplate),
        false);
}

bool AdminFrame::HandleKey(int keyCode)
{
    if (keyCode == WXK_TAB || keyCode == WXK_NUMPAD_TAB)
    {
        // La console est conçue pour une navigation par flèches ; Tabulation
        // et Maj+Tabulation ne changent donc jamais le focus.
        return true;
    }
    if (keyCode != WXK_ESCAPE) return false;
    if (loading_) requestSlot_.Cancel();
    loading_ = false;
    if (showingItemActions_)
    {
        RestoreAreaFromItem();
    }
    else if (showingCommands_) ShowSections();
    else
    {
        lila::shared::security::SecureWipeString(maintenanceToken_);
        maintenanceTokenInitialized_ = false;
        if (onCloseRequested_) onCloseRequested_(selectedSection_);
    }
    return true;
}

void AdminFrame::FocusCurrentMenu()
{
    auto* menu = showingCommands_ ? commandsMenu_ : sectionsMenu_;
    if (showingCommands_ && !showingItemActions_ && reportSearchPanel_->IsShown())
        menu = reportStatusMenu_;
    if (menu != nullptr && menu->GetSelectedControl() != nullptr)
        menu->GetSelectedControl()->SetFocus();
}

void AdminFrame::FocusResult()
{
    if (resultsMenu_ != nullptr && resultsMenu_->IsShown() &&
        resultsMenu_->GetSelectedControl() != nullptr)
    {
        resultsMenu_->GetSelectedControl()->SetFocus();
        return;
    }
    FocusResultDetails();
}

void AdminFrame::FocusResultDetails()
{
    if (resultText_ == nullptr) return;
    resultText_->SetInsertionPoint(0);
    resultText_->SetFocus();
}

void AdminFrame::FocusPagination()
{
    if (previousPageButton_ != nullptr && previousPageButton_->IsShown() &&
        previousPageButton_->IsEnabled())
        previousPageButton_->SetFocus();
    else if (pageSizeChoice_ != nullptr && pageSizeChoice_->IsShown())
        pageSizeChoice_->SetFocus();
}

void AdminFrame::SetStatus(const wxString& message, bool isError)
{
    (void)isError;
    statusLabel_->SetLabel(message);
    Layout();
}
}
