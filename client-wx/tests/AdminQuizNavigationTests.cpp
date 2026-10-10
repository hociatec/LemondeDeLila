#include <cassert>
#include <atomic>
#include <condition_variable>
#include <mutex>
#include <chrono>
#include <thread>
#include <iostream>
#include <cstdlib>
#ifdef _MSC_VER
#include <crtdbg.h>
#endif
#include <wx/app.h>
#include <wx/frame.h>
#include <wx/choice.h>
#include <wx/log.h>
#include <wx/textctrl.h>
#include <wx/access.h>
#include <wx/listbox.h>
#include "modules/admin/application/AdminService.h"
#include "modules/admin/application/IAdminGateway.h"
#include "modules/admin/presentation/AdminFrame.h"
#include "modules/admin/presentation/AdminCommandDialog.h"
#include "modules/audio/application/IAudioService.h"
#include "shared/ui/presentation/controls/VerticalMenu.h"

using nlohmann::json;
namespace admin = lila::modules::admin;

class QuizGateway final : public admin::application::IAdminGateway
{
public:
    mutable json lastPayload;
    mutable std::string lastCommand;
    mutable std::string category = "music";
    bool failCounts = false;
    mutable std::mutex reportMutex;
    mutable std::condition_variable_any reportWake;
    bool holdReports = false;
    mutable std::atomic<int> reportReads = 0;
    int reportVersion = 0;
    void HoldReports(bool hold)
    {
        { std::lock_guard lock(reportMutex); holdReports = hold; }
        reportWake.notify_all();
    }
    admin::domain::AdminPayload Execute(const admin::domain::AdminCommand& command,
        const admin::domain::AdminPayload& raw, const std::string&, std::stop_token stop) const override
    {
        lastCommand = command.id;
        lastPayload = json::parse(raw.Serialized());
        if (command.id == "bugs.list" && failCounts) throw std::runtime_error("Counters unavailable");
        if (command.id == "bugs.list")
        {
            ++reportReads;
            std::unique_lock lock(reportMutex);
            reportWake.wait(lock, stop, [this] { return !holdReports; });
            auto reports = json::array();
            if (reportVersion > 0 && !lastPayload.value("countsOnly", false))
                reports.push_back({{"id", std::to_string(reportVersion)}, {"subject", "Fresh report"},
                    {"content", "Updated"}, {"status", lastPayload.value("status", "pending")}});
            return admin::domain::AdminPayload(json{{"items", reports},
                {"statusCounts", {{"pending", 12}, {"in_progress", 3}}}}.dump());
        }
        if (command.id == "games.list")
            return admin::domain::AdminPayload(json{{"games", {{{"id", "arche-de-mnemosyne"}}}}}.dump());
        if (command.id == "mnemo.categories")
            return admin::domain::AdminPayload(Categories().dump());
        if (command.id == "mnemo.question.update")
            category = lastPayload.at("categoryId");
        json questions = json::array();
        if (!lastPayload.contains("categoryId") || lastPayload["categoryId"] == category)
            questions.push_back(Question());
        return admin::domain::AdminPayload(json{{"questions", questions}, {"total", questions.size()}}.dump());
    }
    static json Categories()
    {
        return {{"categories", {{{"id", "music"}, {"name", "Musique"}},
            {{"id", "history"}, {"name", "Histoire"}}}}};
    }
    json Question() const
    {
        return {{"id", "q1"}, {"categoryId", category}, {"question", "Question ?"},
            {"answers", {"A", "B", "C", "D"}}, {"correctIndex", 0}, {"status", "validated"}};
    }
};
class SilentAudio final : public lila::modules::audio::application::IAudioService
{
public:
    void Play(lila::modules::audio::domain::SoundCue) override {}
    void StartLoop(lila::modules::audio::domain::SoundCue) override {}
    void StopLoop() override {}
    void StartTableAmbience(std::string_view) override {}
    void SetTableAmbienceVolume(int) override {}
    void SetBackground(lila::modules::audio::domain::AudioBackground) override {}
    void StopAll() override {}
    void ShutdownImmediately() override {}
};

namespace lila::modules::admin::presentation
{
struct AdminQuizNavigationTest
{
    static void CheckNavigationRoles(AdminFrame& frame)
    {
#if wxUSE_ACCESSIBILITY
        for (auto* menu : {frame.sectionsMenu_, frame.commandsMenu_,
                          frame.reportStatusMenu_, frame.resultsMenu_})
        {
            auto* control = menu->GetSelectedControl();
            auto* accessible = control->GetAccessible();
            assert(accessible != nullptr);
            wxAccRole role;
            assert(accessible->GetRole(wxACC_SELF, &role) == wxACC_OK);
            assert(role == wxROLE_SYSTEM_LIST);
            if (menu->GetItemCount() > 0)
            {
                assert(accessible->GetRole(1, &role) == wxACC_OK);
                assert(role == wxROLE_SYSTEM_LISTITEM);
                wxString action;
                assert(accessible->GetDefaultAction(1, &action) == wxACC_OK);
                assert(action == "Ouvrir");
            }
        }
#endif
    }
    static void Wait(AdminFrame& frame)
    {
        const auto deadline = std::chrono::steady_clock::now() + std::chrono::seconds(10);
        while (frame.loading_ && std::chrono::steady_clock::now() < deadline)
        {
            wxYield();
            std::this_thread::sleep_for(std::chrono::milliseconds(5));
        }
        assert(!frame.loading_);
    }
    static void Activate(AdminFrame& frame, std::string_view id)
    {
        for (std::size_t index = 0; index < frame.visibleCommands_.size(); ++index)
            if (frame.visibleCommands_[index]->id == id)
            {
                frame.commandsMenu_->SetSelectedIndexSilently(index);
                frame.ActivateCommand(index);
                Wait(frame);
                return;
            }
        assert(false);
    }
    static void CheckReportRefresh(AdminFrame& frame, QuizGateway& gateway)
    {
        const auto& areas = domain::GetAdminAreas();
        gateway.HoldReports(true);
        for (std::size_t index = 0; index < areas.size(); ++index)
            if (areas[index].id == "reports") frame.ShowCommands(index);
        // Selecting a filter before the initial counters arrive must not be lost.
        frame.reportStatusMenu_->SetSelectedIndexSilently(1);
        frame.ChangeBugReportFilter();
        frame.reportStatusMenu_->SetSelectedIndexSilently(2);
        frame.ChangeBugReportFilter();
        assert(frame.pendingBugReportRefresh_);
        gateway.HoldReports(false);
        Wait(frame);
        assert(gateway.lastPayload.at("countsOnly") == false);
        assert(gateway.lastPayload.at("status") == "in_progress");
        assert(!frame.pendingBugReportRefresh_ && !frame.loadingReportCountsOnly_);

        gateway.reportVersion = 1;
        frame.RefreshBugReports();
        Wait(frame);
        assert(frame.resultItems_.at(0).at("id") == "1");
        gateway.reportVersion = 2;
        gateway.HoldReports(true);
        frame.RefreshBugReports();
        assert(frame.resultItems_.at(0).at("id") == "1");
        frame.OpenResultActions(0);
        assert(!frame.showingItemActions_); // Retained rows cannot race the refresh.
        gateway.HoldReports(false);
        Wait(frame);
        assert(frame.resultItems_.at(0).at("id") == "2");

        frame.OpenResultActions(0);
        gateway.reportVersion = 3;
        frame.HandleKey(WXK_ESCAPE);
        Wait(frame);
        assert(frame.resultItems_.at(0).at("id") == "3");

        gateway.HoldReports(true);
        const int readsBefore = gateway.reportReads.load();
        frame.RefreshBugReports();
        const auto deadline = std::chrono::steady_clock::now() + std::chrono::seconds(5);
        while (gateway.reportReads == readsBefore && std::chrono::steady_clock::now() < deadline)
            std::this_thread::sleep_for(std::chrono::milliseconds(1));
        assert(gateway.reportReads > readsBefore);
        frame.ChangeBugReportFilter();
        frame.ShowSections(); // Cancel pending reads when leaving the screen.
        gateway.HoldReports(false);
        wxYield();
        assert(!frame.pendingBugReportRefresh_ && !frame.showingCommands_);
        // Drain the canceled worker before reusing the fake gateway.
        const auto drainDeadline = std::chrono::steady_clock::now() + std::chrono::seconds(5);
        while (lila::shared::concurrency::CurrentBackgroundExecutor().Stats().active != 0 &&
               std::chrono::steady_clock::now() < drainDeadline)
        { wxYield(); std::this_thread::sleep_for(std::chrono::milliseconds(1)); }
        wxYield();
        assert(!frame.showingCommands_ && frame.resultItems_.empty());
        gateway.reportVersion = 0;
    }

    static void Run(AdminFrame& frame, QuizGateway& gateway)
    {
        CheckReportRefresh(frame, gateway);
        CheckNavigationRoles(frame);
        const auto& areas = domain::GetAdminAreas();
        auto* otherControl = new wxTextCtrl(&frame, wxID_ANY);
        assert(frame.commandSelections_.size() == areas.size());
        // Every area, including Maintenance, must have its own selection slot.
        for (std::size_t index = 0; index < areas.size(); ++index)
        {
            frame.ShowCommands(index);
            if (areas[index].id == "reports")
            {
                frame.reportStatusMenu_->SetSelectedIndexSilently(2);
                otherControl->SetFocus();
            }
            Wait(frame);
            if (areas[index].id == "reports")
            {
                assert(gateway.lastPayload.at("countsOnly") == true);
                assert(frame.reportStatusMenu_->GetSelectedIndex() == 2);
                assert(wxWindow::FindFocus() == otherControl);
                assert(frame.resultItems_.empty());
                frame.RefreshBugReports(true, false);
                Wait(frame);
                assert(gateway.lastPayload.at("countsOnly") == false);
            }
            CheckNavigationRoles(frame);
            assert(frame.selectedSection_ == index);
            assert(frame.commandsMenu_->GetSelectedIndex() == 0);
            frame.ShowSections();
        }
        gateway.failCounts = true;
        for (std::size_t index = 0; index < areas.size(); ++index)
            if (areas[index].id == "reports") frame.ShowCommands(index);
        frame.reportStatusMenu_->SetSelectedIndexSilently(3);
        otherControl->SetFocus();
        Wait(frame);
        assert(wxWindow::FindFocus() == otherControl);
        assert(frame.reportStatusMenu_->GetSelectedIndex() == 3);
        auto* statuses = dynamic_cast<wxListBox*>(frame.reportStatusMenu_->GetSelectedControl());
        assert(statuses && statuses->GetString(3).Contains(L"compteur indisponible"));
        gateway.failCounts = false;
        frame.ShowSections();
        delete otherControl;
        for (std::size_t index = 0; index < areas.size(); ++index)
            if (areas[index].id == "games") frame.ShowCommands(index);
        Wait(frame);
        frame.OpenResultActions(0);
        Activate(frame, "mnemo.categories");
        frame.OpenResultActions(0);
        Activate(frame, "mnemo.questions");
        assert(gateway.lastPayload.at("categoryId") == "music");
        assert(frame.resultItems_.size() == 1);
        frame.paginationPayload_["offset"] = 50;
        frame.ExecuteCommand(*frame.paginationCommand_, frame.paginationPayload_);
        Wait(frame);
        assert(gateway.lastPayload.at("categoryId") == "music");
        frame.OpenResultActions(0);
        assert(frame.HandleKey(WXK_ESCAPE));
        assert(!frame.showingItemActions_);
        assert(frame.paginationPayload_.at("offset") == 50);
        wxKeyEvent listEscape(wxEVT_CHAR_HOOK);
        listEscape.m_keyCode = WXK_ESCAPE;
        frame.resultsMenu_->GetSelectedControl()->GetEventHandler()->ProcessEvent(listEscape);
        assert(frame.showingItemActions_ && frame.contextItem_.at("id") == "music");
        assert(frame.HandleKey(WXK_ESCAPE));
        assert(frame.currentResultItemKind_ == domain::AdminItemKind::MnemoCategory);
        frame.OpenResultActions(1);
        Activate(frame, "mnemo.questions");
        assert(gateway.lastPayload.at("categoryId") == "history");
        assert(frame.resultItems_.empty());
        wxKeyEvent escape(wxEVT_CHAR_HOOK);
        escape.m_keyCode = WXK_ESCAPE;
        frame.resultText_->GetEventHandler()->ProcessEvent(escape);
        assert(frame.showingItemActions_ && frame.contextItem_.at("id") == "history");
        frame.HandleKey(WXK_ESCAPE);
        assert(frame.selectedResultIndex_ == 1);
        frame.HandleKey(WXK_ESCAPE);
        assert(frame.contextItem_.at("id") == "arche-de-mnemosyne");
        Activate(frame, "mnemo.questions");
        assert(!gateway.lastPayload.contains("categoryId"));
        frame.HandleKey(WXK_ESCAPE);
        Activate(frame, "mnemo.categories");
        frame.OpenResultActions(0);
        Activate(frame, "mnemo.questions");
        frame.OpenResultActions(0);
        frame.refreshAreaAfterCommand_ = true;
        frame.ExecuteCommand(*domain::FindAdminCommand("mnemo.question.update"),
            {{"id", "q1"}, {"categoryId", "history"}});
        Wait(frame);
        assert(gateway.lastCommand == "mnemo.questions");
        assert(gateway.lastPayload.at("categoryId") == "music");
        assert(frame.resultItems_.empty());
        frame.HandleKey(WXK_ESCAPE);
        assert(frame.contextItem_.at("id") == "music");
        frame.HandleKey(WXK_ESCAPE);
        frame.HandleKey(WXK_ESCAPE);
        frame.HandleKey(WXK_ESCAPE);
        assert(frame.currentResultItemKind_ == domain::AdminItemKind::Game);
        assert(frame.gameNavigation_.empty());
        CheckNavigationRoles(frame);
    }
};
}

wxChoice* FindCategoryChoice(wxWindow& parent)
{
    for (auto* child : parent.GetChildren())
    {
        if (auto* choice = dynamic_cast<wxChoice*>(child);
            choice && choice->GetCount() == 2 && choice->GetString(0) == L"Musique") return choice;
        if (auto* found = FindCategoryChoice(*child)) return found;
    }
    return nullptr;
}
class AdminTestApp final : public wxApp
{
public:
    bool OnInit() override { return true; }
    void OnUnhandledException() override
    {
        try { throw; }
        catch (const std::exception& error) { std::cerr << "Unhandled test exception: " << error.what() << std::endl; }
        catch (...) { std::cerr << "Unknown test exception" << std::endl; }
        std::_Exit(1);
    }
    bool OnExceptionInMainLoop() override { OnUnhandledException(); return false; }
};
wxIMPLEMENT_APP_NO_MAIN(AdminTestApp);
int main(int argc, char** argv)
{
#ifdef _MSC_VER
    _CrtSetReportMode(_CRT_ASSERT, _CRTDBG_MODE_FILE);
    _CrtSetReportFile(_CRT_ASSERT, _CRTDBG_FILE_STDERR);
#endif
    delete wxLog::SetActiveTarget(new wxLogStderr());
    assert(wxEntryStart(argc, argv));
    assert(wxTheApp->CallOnInit());
    lila::shared::concurrency::BackgroundExecutor executor({2, 64});
    lila::shared::concurrency::InstallBackgroundExecutor(executor);
    QuizGateway gateway;
    admin::application::AdminService service(gateway);
    SilentAudio audio;
    auto* host = new wxFrame(nullptr, wxID_ANY, "admin-quiz-test");
    auto* frame = new admin::presentation::AdminFrame(host, service, audio, {}, {}, {});
    host->Show();
    admin::presentation::AdminQuizNavigationTest::Run(*frame, gateway);
    {
        auto command = *admin::domain::FindAdminCommand("mnemo.question.update");
        gateway.category = "music";
        admin::presentation::AdminCommandDialog dialog(host, command, gateway.Question(), {},
            QuizGateway::Categories().at("categories"));
        auto* choice = FindCategoryChoice(dialog);
        assert(choice && choice->IsEnabled() && choice->GetSelection() == 0);
        choice->SetSelection(1);
        assert(static_cast<wxWindow&>(dialog).TransferDataFromWindow());
        assert(dialog.Payload().at("categoryId") == "history");
    }
    delete host;
    executor.Shutdown();
    lila::shared::concurrency::UninstallBackgroundExecutor();
    wxTheApp->OnExit();
    wxEntryCleanup();
}
