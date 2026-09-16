#include "modules/admin/presentation/AdminFrame.h"

#include <algorithm>
#include <array>

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
            if (reportSearchPanel_->IsShown()) reportStatusMenu_->GetSelectedControl()->SetFocus();
            else if (commandsMenu_->IsShown()) FocusCurrentMenu();
            else ShowSections();
            return true;
        }
        if (keyCode == WXK_TAB || keyCode == WXK_NUMPAD_TAB)
        {
            return true;
        }
        return false;
    });
    lila::shared::ui::navigation::BindMenuHandlers(
        *reportStatusMenu_, [this](std::size_t) {},
        [this](std::size_t index) { if (index == 0) CreateBugReport(); else ChangeBugReportFilter(); });
    reportStatusMenu_->SetKeyHandler([this](int keyCode)
    {
        if (keyCode == WXK_ESCAPE) { ShowSections(); return true; }
        return keyCode == WXK_TAB || keyCode == WXK_NUMPAD_TAB;
    });
    editReportButton_->Bind(wxEVT_BUTTON, [this](wxCommandEvent&) { EditSelectedBugReport(); });
    changeReportStatusButton_->Bind(
        wxEVT_BUTTON, [this](wxCommandEvent&) { ConsultSelectedBugReport(); });
    deleteReportButton_->Bind(wxEVT_BUTTON, [this](wxCommandEvent&) { DeleteSelectedBugReport(); });
    for (auto* button : {editReportButton_, changeReportStatusButton_, deleteReportButton_})
        button->Bind(wxEVT_CHAR_HOOK, [this](wxKeyEvent& event)
        {
            const auto keyCode = event.GetKeyCode();
            if (keyCode == WXK_TAB || keyCode == WXK_NUMPAD_TAB)
                return;
            if (keyCode == WXK_ESCAPE)
            {
                FocusResult();
                return;
            }
            if (keyCode == WXK_UP || keyCode == WXK_NUMPAD_UP ||
                keyCode == WXK_DOWN || keyCode == WXK_NUMPAD_DOWN)
            {
                const auto buttons = std::array<wxButton*, 3>{
                    editReportButton_, changeReportStatusButton_, deleteReportButton_};
                const auto found = std::find(buttons.begin(), buttons.end(), wxWindow::FindFocus());
                if (found != buttons.end())
                {
                    const auto index = static_cast<std::size_t>(std::distance(buttons.begin(), found));
                    if ((keyCode == WXK_UP || keyCode == WXK_NUMPAD_UP) && index > 0)
                        buttons[index - 1]->SetFocus();
                    if ((keyCode == WXK_DOWN || keyCode == WXK_NUMPAD_DOWN) && index + 1 < buttons.size())
                        buttons[index + 1]->SetFocus();
                    if ((keyCode == WXK_UP || keyCode == WXK_NUMPAD_UP) && index == 0)
                        FocusResult();
                    return;
                }
            }
            event.Skip();
        });
    previousPageButton_->Bind(wxEVT_BUTTON, [this](wxCommandEvent&) { ChangePage(-1); });
    nextPageButton_->Bind(wxEVT_BUTTON, [this](wxCommandEvent&) { ChangePage(1); });
    pageSizeChoice_->Bind(wxEVT_CHOICE, [this](wxCommandEvent&) { ChangePageSize(); });
    for (auto* control : {static_cast<wxWindow*>(previousPageButton_),
                          static_cast<wxWindow*>(nextPageButton_),
                          static_cast<wxWindow*>(pageSizeChoice_)})
        control->Bind(wxEVT_CHAR_HOOK, [this](wxKeyEvent& event)
        {
            const auto keyCode = event.GetKeyCode();
            if (keyCode == WXK_TAB || keyCode == WXK_NUMPAD_TAB)
                return;
            if (keyCode == WXK_UP || keyCode == WXK_NUMPAD_UP ||
                keyCode == WXK_DOWN || keyCode == WXK_NUMPAD_DOWN)
            {
                const auto controls = std::array<wxWindow*, 3>{
                    previousPageButton_, nextPageButton_, pageSizeChoice_};
                const auto found = std::find(controls.begin(), controls.end(), wxWindow::FindFocus());
                if (found != controls.end())
                {
                    const auto index = static_cast<std::size_t>(std::distance(controls.begin(), found));
                    const bool forward = keyCode == WXK_DOWN || keyCode == WXK_NUMPAD_DOWN;
                    if (forward && index + 1 < controls.size() && controls[index + 1]->IsEnabled())
                        controls[index + 1]->SetFocus();
                    else if (!forward && index > 0 && controls[index - 1]->IsEnabled())
                        controls[index - 1]->SetFocus();
                    else if (forward) FocusResult();
                    return;
                }
            }
            event.Skip();
        });
    resultText_->Bind(wxEVT_CHAR_HOOK, [this](wxKeyEvent& event)
    {
        const auto keyCode = event.GetKeyCode();
        if (keyCode == WXK_TAB || keyCode == WXK_NUMPAD_TAB)
            return;
        if (keyCode == WXK_ESCAPE)
        {
            if (resultsMenu_->IsShown() && resultsMenu_->GetSelectedControl() != nullptr)
                resultsMenu_->GetSelectedControl()->SetFocus();
            else if (reportSearchPanel_->IsShown())
                reportStatusMenu_->GetSelectedControl()->SetFocus();
            else if (commandsMenu_->IsShown())
                FocusCurrentMenu();
            else ShowSections();
            return;
        }
        event.Skip();
    });
}
}
