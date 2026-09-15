#include "modules/admin/presentation/AdminFrame.h"

#include <wx/button.h>
#include <wx/choice.h>
#include <wx/event.h>
#include <wx/panel.h>
#include <wx/textctrl.h>

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
            const auto& area = domain::GetAdminAreas()[index];
            SetStatus(wxString(area.description.data()));
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
            OpenResultActions(index);
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
            if (reportActionsPanel_ != nullptr && reportActionsPanel_->IsShown())
                FocusResultDetails();
            else if (paginationPanel_ != nullptr && paginationPanel_->IsShown())
                FocusPagination();
            else
                FocusResultDetails();
            return true;
        }
        return false;
    });
    reportSearchCtrl_->Bind(wxEVT_TEXT_ENTER, [this](wxCommandEvent&) { SearchBugReports(); });
    reportSearchButton_->Bind(wxEVT_BUTTON, [this](wxCommandEvent&) { SearchBugReports(); });
    for (auto* control : {static_cast<wxWindow*>(reportSearchCtrl_),
                          static_cast<wxWindow*>(reportSearchButton_)})
        control->Bind(wxEVT_CHAR_HOOK, [this](wxKeyEvent& event)
        {
            if (event.GetKeyCode() == WXK_ESCAPE)
            {
                FocusCurrentMenu();
                return;
            }
            event.Skip();
        });
    editReportButton_->Bind(wxEVT_BUTTON, [this](wxCommandEvent&) { EditSelectedBugReport(); });
    deleteReportButton_->Bind(wxEVT_BUTTON, [this](wxCommandEvent&) { DeleteSelectedBugReport(); });
    for (auto* button : {editReportButton_, deleteReportButton_})
        button->Bind(wxEVT_CHAR_HOOK, [this](wxKeyEvent& event)
        {
            if (event.GetKeyCode() == WXK_ESCAPE)
            {
                FocusResult();
                return;
            }
            event.Skip();
        });
    previousPageButton_->Bind(wxEVT_BUTTON, [this](wxCommandEvent&) { ChangePage(-1); });
    nextPageButton_->Bind(wxEVT_BUTTON, [this](wxCommandEvent&) { ChangePage(1); });
    pageSizeChoice_->Bind(wxEVT_CHOICE, [this](wxCommandEvent&) { ChangePageSize(); });
    resultText_->Bind(wxEVT_CHAR_HOOK, [this](wxKeyEvent& event)
    {
        const auto keyCode = event.GetKeyCode();
        if (keyCode == WXK_TAB && reportActionsPanel_->IsShown() && !event.ShiftDown())
        {
            editReportButton_->SetFocus();
            return;
        }
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
}
