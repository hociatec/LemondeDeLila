#include "modules/admin/presentation/AdminFrame.h"

#include <algorithm>

#include <wx/button.h>
#include <wx/msgdlg.h>
#include <wx/panel.h>
#include <wx/textctrl.h>

#include "modules/admin/presentation/AdminCommandDialog.h"
#include "shared/text/presentation/encoding/Encoding.h"

namespace lila::modules::admin::presentation
{
namespace
{
const domain::AdminCommand* FindCommand(std::string_view id)
{
    const auto& commands = domain::GetAdminCommands();
    const auto found = std::find_if(commands.begin(), commands.end(),
        [id](const domain::AdminCommand& command) { return command.id == id; });
    return found == commands.end() ? nullptr : &*found;
}
}

void AdminFrame::SearchBugReports()
{
    if (loading_) return;
    if (!bugReportListPayload_.is_object()) bugReportListPayload_ = nlohmann::json::object();
    bugReportListPayload_["search"] =
        lila::shared::text::ToUtf8(reportSearchCtrl_->GetValue());
    bugReportListPayload_["offset"] = 0;
    RefreshBugReports();
}

void AdminFrame::RefreshBugReports(bool keepCurrentFocus)
{
    const auto* command = FindCommand("bugs.list");
    if (command == nullptr) return;
    if (!bugReportListPayload_.is_object() || bugReportListPayload_.empty())
        bugReportListPayload_ = nlohmann::json::parse(command->payloadTemplate);
    bugReportListPayload_["search"] =
        lila::shared::text::ToUtf8(reportSearchCtrl_->GetValue());
    keepFocusAfterCommand_ = keepCurrentFocus;
    ExecuteCommand(*command, bugReportListPayload_);
}

void AdminFrame::UpdateBugReportActions()
{
    const bool available = selectedResultIndex_.has_value() &&
        *selectedResultIndex_ < resultItems_.size() &&
        resultItems_[*selectedResultIndex_].is_object() &&
        resultItems_[*selectedResultIndex_].contains("id");
    reportActionsPanel_->Show(available);
    if (!available)
    {
        Layout();
        return;
    }
    const auto& report = resultItems_[*selectedResultIndex_];
    const auto subject = report.value("subject", std::string{"sans sujet"});
    editReportButton_->SetName(
        wxString(L"Modifier le rapport : ") + lila::shared::text::FromUtf8(subject));
    deleteReportButton_->SetName(
        wxString(L"Supprimer le rapport : ") + lila::shared::text::FromUtf8(subject));
    Layout();
}

void AdminFrame::EditSelectedBugReport()
{
    if (loading_ || !selectedResultIndex_ || *selectedResultIndex_ >= resultItems_.size()) return;
    const auto& report = resultItems_[*selectedResultIndex_];
    const auto id = report.value("id", std::string{});
    const auto* updateCommand = FindCommand("bugs.update");
    if (id.empty() || updateCommand == nullptr) return;

    auto dialogCommand = *updateCommand;
    dialogCommand.id = "bugs.update.selected";
    dialogCommand.payloadTemplate = R"({"subject":"","content":""})";
    const nlohmann::json initial{
        {"subject", report.value("subject", std::string{})},
        {"content", report.value("content", std::string{})},
    };
    AdminCommandDialog dialog(this, dialogCommand, initial);
    if (dialog.ShowModal() != wxID_OK) return;
    auto payload = dialog.Payload();
    payload["id"] = id;
    reportIdToRestore_ = id;
    refreshBugReportsAfterCommand_ = true;
    ExecuteCommand(*updateCommand, std::move(payload));
}

void AdminFrame::DeleteSelectedBugReport()
{
    if (loading_ || !selectedResultIndex_ || *selectedResultIndex_ >= resultItems_.size()) return;
    const auto& report = resultItems_[*selectedResultIndex_];
    const auto id = report.value("id", std::string{});
    const auto* deleteCommand = FindCommand("bugs.delete");
    if (id.empty() || deleteCommand == nullptr) return;
    const auto subject = lila::shared::text::FromUtf8(
        report.value("subject", std::string{"sans sujet"}));
    if (wxMessageBox(
            wxString(L"Supprimer définitivement le rapport « ") + subject + L" » ?",
            wxString(L"Supprimer le rapport"),
            wxYES_NO | wxNO_DEFAULT | wxICON_WARNING,
            this) != wxYES)
        return;
    reportIdToRestore_.reset();
    refreshBugReportsAfterCommand_ = true;
    ExecuteCommand(*deleteCommand, {{"id", id}});
}
}
