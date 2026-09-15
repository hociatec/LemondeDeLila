#include "modules/admin/presentation/AdminFrame.h"

#include <algorithm>
#include <span>

#include <wx/stattext.h>
#include <wx/textctrl.h>
#include <wx/button.h>
#include <wx/choice.h>
#include <wx/panel.h>

#include "shared/accessibility/presentation/AccessibilityUtils.h"
#include "shared/security/infrastructure/SecurityUtils.h"
#include "shared/ui/presentation/controls/VerticalMenu.h"

namespace lila::modules::admin::presentation
{
void AdminFrame::ShowSections()
{
    std::vector<lila::shared::ui::controls::VerticalMenuItem> items;
    const auto& areas = domain::GetAdminAreas();
    items.reserve(areas.size());
    for (std::size_t index = 0; index < areas.size(); ++index)
        items.push_back({std::string(areas[index].id),
            wxString(areas[index].group.data()) + L" — " + wxString(areas[index].label.data())});
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
    std::vector<lila::shared::ui::controls::VerticalMenuItem> items;
    items.reserve(visibleCommands_.size());
    for (const auto* command : visibleCommands_)
        items.push_back({command->id, wxString(command->label)});
    commandsMenu_->SetItems(items);
    if (!items.empty())
        commandsMenu_->SetSelectedIndexSilently(
            std::min(commandSelections_[sectionIndex], items.size() - 1));
    sectionsMenu_->Hide();
    commandsMenu_->Show();
    showingCommands_ = true;
    titleLabel_->SetLabel(
        wxString(L"Administration — ") +
        wxString(area.label.data()));
    resultText_->SetValue(
        wxString(area.description.data()) +
        wxString(L"\n\nChoisissez une opération dans la liste. Son formulaire métier s’ouvrira avec les champs adaptés."));
    resultSummaryLabel_->SetLabel(wxString(L"Aide de la rubrique"));
    resultsMenu_->Hide();
    reportSearchPanel_->Show(bugReports);
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
    FocusCurrentMenu();
    LoadAutomaticAreaContent();
}

void AdminFrame::LoadAutomaticAreaContent()
{
    const auto& area = domain::GetAdminAreas()[selectedSection_];
    if (area.automaticCommandId.empty()) return;
    if (area.id == "reports")
    {
        RefreshBugReports(true);
        return;
    }
    const auto* command = domain::FindAdminCommand(area.automaticCommandId);
    if (command == nullptr) return;
    keepFocusAfterCommand_ = true;
    ExecuteCommand(*command, nlohmann::json::parse(command->payloadTemplate));
}

bool AdminFrame::HandleKey(int keyCode)
{
    if (keyCode == WXK_TAB)
    {
        FocusResult();
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
    lila::shared::accessibility::AccessibilityUtils::NotifyFocus(*resultText_);
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
    lila::shared::accessibility::AccessibilityUtils::AnnounceStatus(
        *statusLabel_, message);
    Layout();
}
}
