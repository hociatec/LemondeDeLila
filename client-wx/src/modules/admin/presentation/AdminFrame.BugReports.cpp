#include "modules/admin/presentation/AdminFrame.h"

#include <iterator>
#include <string_view>

#include <wx/button.h>
#include <wx/choice.h>
#include <wx/msgdlg.h>
#include <wx/panel.h>
#include <wx/textctrl.h>

#include "modules/admin/presentation/AdminCommandDialog.h"
#include "shared/text/presentation/encoding/Encoding.h"

namespace lila::modules::admin::presentation
{
namespace
{
constexpr std::string_view ReportStatuses[]{
    "pending", "in_progress", "to_test", "done", "refused", "all"};
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

void AdminFrame::ChangeBugReportFilter()
{
    if (loading_) return;
    const auto selection = reportStatusFilter_->GetSelection();
    if (selection == wxNOT_FOUND ||
        static_cast<std::size_t>(selection) >= std::size(ReportStatuses)) return;
    const auto status = ReportStatuses[static_cast<std::size_t>(selection)];
    if (status == "all") bugReportListPayload_.erase("status");
    else bugReportListPayload_["status"] = status;
    bugReportListPayload_["offset"] = 0;
    RefreshBugReports();
}

void AdminFrame::CreateBugReport()
{
    if (loading_) return;
    const auto* createCommand = domain::FindAdminCommand("bugs.create");
    if (createCommand == nullptr) return;
    AdminCommandDialog dialog(
        this, *createCommand, nlohmann::json::parse(createCommand->payloadTemplate));
    if (dialog.ShowModal() != wxID_OK) return;
    reportSearchCtrl_->Clear();
    reportStatusFilter_->SetSelection(0);
    bugReportListPayload_["search"] = "";
    bugReportListPayload_["status"] = "pending";
    bugReportListPayload_["offset"] = 0;
    reportIdToRestore_.reset();
    refreshBugReportsAfterCommand_ = true;
    ExecuteCommand(*createCommand, dialog.Payload());
}

void AdminFrame::RefreshBugReports(
    bool keepCurrentFocus,
    bool announceLifecycle)
{
    const auto* command = domain::FindAdminCommand("bugs.list");
    if (command == nullptr) return;
    if (!bugReportListPayload_.is_object() || bugReportListPayload_.empty())
        bugReportListPayload_ = nlohmann::json::parse(command->payloadTemplate);
    bugReportListPayload_["search"] =
        lila::shared::text::ToUtf8(reportSearchCtrl_->GetValue());
    keepFocusAfterCommand_ = keepCurrentFocus;
    ExecuteCommand(*command, bugReportListPayload_, announceLifecycle);
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
    changeReportStatusButton_->SetName(
        wxString(L"Classer le rapport : ") + lila::shared::text::FromUtf8(subject));
    deleteReportButton_->SetName(
        wxString(L"Supprimer le rapport : ") + lila::shared::text::FromUtf8(subject));
    Layout();
}

void AdminFrame::ChangeSelectedBugReportStatus()
{
    if (loading_ || !selectedResultIndex_ || *selectedResultIndex_ >= resultItems_.size()) return;
    const auto& report = resultItems_[*selectedResultIndex_];
    const auto id = report.value("id", std::string{});
    const auto* statusCommand = domain::FindAdminCommand("bugs.status");
    if (id.empty() || statusCommand == nullptr) return;

    auto dialogCommand = *statusCommand;
    dialogCommand.id = "bugs.status.selected";
    dialogCommand.label = L"Classer le rapport";
    dialogCommand.description = L"Choisissez son nouveau classement.";
    dialogCommand.payloadTemplate = R"({"status":"pending"})";
    AdminCommandDialog dialog(this, dialogCommand, {
        {"status", report.value("status", std::string{"pending"})},
    });
    if (dialog.ShowModal() != wxID_OK) return;
    auto payload = dialog.Payload();
    payload["id"] = id;
    reportIdToRestore_ = id;
    refreshBugReportsAfterCommand_ = true;
    ExecuteCommand(*statusCommand, std::move(payload));
}

void AdminFrame::EditSelectedBugReport()
{
    if (loading_ || !selectedResultIndex_ || *selectedResultIndex_ >= resultItems_.size()) return;
    const auto& report = resultItems_[*selectedResultIndex_];
    const auto id = report.value("id", std::string{});
    const auto* updateCommand = domain::FindAdminCommand("bugs.update");
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
    const auto* deleteCommand = domain::FindAdminCommand("bugs.delete");
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
