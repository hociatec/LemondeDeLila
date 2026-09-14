#include "modules/admin/presentation/AdminFrame.h"

#include <algorithm>
#include <span>

#include <wx/stattext.h>
#include <wx/textctrl.h>

#include "shared/accessibility/presentation/AccessibilityUtils.h"
#include "shared/text/presentation/encoding/Encoding.h"
#include "shared/security/infrastructure/SecurityUtils.h"
#include "shared/ui/presentation/controls/VerticalMenu.h"
#include "shared/ui/presentation/navigation/MenuBlueprint.h"

namespace lila::modules::admin::presentation
{
void AdminFrame::BindEvents()
{
    lila::shared::ui::navigation::BindMenuHandlers(
        *sectionsMenu_,
        [this](std::size_t index)
        {
            selectedSection_ = index;
            const auto& section = domain::GetAdminSections()[index];
            SetStatus(wxString(section.description.data()));
        },
        [this](std::size_t index) { ShowCommands(index); });
    sectionsMenu_->SetKeyHandler([this](int keyCode) { return HandleKey(keyCode); });
    lila::shared::ui::navigation::BindMenuHandlers(
        *commandsMenu_,
        [this](std::size_t index)
        {
            if (index < visibleCommands_.size())
            {
                commandSelections_[selectedSection_] = index;
                SetStatus(wxString(visibleCommands_[index]->description));
            }
        },
        [this](std::size_t index) { ActivateCommand(index); });
    commandsMenu_->SetKeyHandler([this](int keyCode) { return HandleKey(keyCode); });
    lila::shared::ui::navigation::BindMenuHandlers(
        *resultsMenu_,
        [this](std::size_t index) { ShowResultDetails(index); },
        [this](std::size_t index)
        {
            ShowResultDetails(index);
            FocusResultDetails();
        });
    resultsMenu_->SetKeyHandler([this](int keyCode)
    {
        if (keyCode == WXK_ESCAPE)
        {
            FocusCurrentMenu();
            return true;
        }
        if (keyCode == WXK_TAB)
        {
            FocusResultDetails();
            return true;
        }
        return false;
    });
    resultText_->Bind(wxEVT_CHAR_HOOK, [this](wxKeyEvent& event)
    {
        const auto keyCode = event.GetKeyCode();
        if (keyCode == WXK_ESCAPE || keyCode == WXK_TAB)
        {
            if (resultsMenu_->IsShown() && resultsMenu_->GetSelectedControl() != nullptr)
                resultsMenu_->GetSelectedControl()->SetFocus();
            else
                FocusCurrentMenu();
            return;
        }
        event.Skip();
    });
}

void AdminFrame::ShowSections()
{
    std::vector<lila::shared::ui::controls::VerticalMenuItem> items;
    const auto& sections = domain::GetAdminSections();
    items.reserve(sections.size());
    for (std::size_t index = 0; index < sections.size(); ++index)
        items.push_back({std::to_string(index), wxString(sections[index].label.data())});
    sectionsMenu_->SetItems(items);
    sectionsMenu_->SetSelectedIndexSilently(selectedSection_);
    sectionsMenu_->Show();
    commandsMenu_->Hide();
    showingCommands_ = false;
    titleLabel_->SetLabel(wxString(L"Administration"));
    SetStatus(wxString(sections[selectedSection_].description.data()));
    Layout();
    FocusCurrentMenu();
}

void AdminFrame::ShowCommands(std::size_t sectionIndex)
{
    if (loading_ || sectionIndex >= domain::GetAdminSections().size()) return;
    selectedSection_ = sectionIndex;
    visibleCommands_ = domain::CommandsForSection(domain::GetAdminSections()[sectionIndex].id);
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
        wxString(domain::GetAdminSections()[sectionIndex].label.data()));
    resultText_->SetValue(
        wxString(domain::GetAdminSections()[sectionIndex].description.data()) +
        wxString(L"\n\nChoisissez une opération dans la liste. Son formulaire métier s’ouvrira avec les champs adaptés."));
    resultSummaryLabel_->SetLabel(wxString(L"Aide de la rubrique"));
    resultsMenu_->Hide();
    resultDetails_.clear();
    SetStatus(items.empty() ? wxString(L"Aucune action disponible.") :
        wxString(visibleCommands_[commandsMenu_->GetSelectedIndex()]->description));
    Layout();
    FocusCurrentMenu();
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
    if (showingCommands_) ShowSections();
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

void AdminFrame::SetStatus(const wxString& message, bool isError)
{
    (void)isError;
    statusLabel_->SetLabel(message);
    lila::shared::accessibility::AccessibilityUtils::AnnounceStatus(
        *statusLabel_, message);
    Layout();
}
}
