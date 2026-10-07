#include <cassert>
#include <chrono>
#include <thread>
#ifdef _MSC_VER
#include <crtdbg.h>
#endif
#include <wx/app.h>
#include <wx/frame.h>
#include <wx/choice.h>
#include <wx/log.h>
#include <wx/textctrl.h>
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
    admin::domain::AdminPayload Execute(const admin::domain::AdminCommand& command,
        const admin::domain::AdminPayload& raw, const std::string&, std::stop_token) const override
    {
        lastCommand = command.id;
        lastPayload = json::parse(raw.Serialized());
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
    static void Run(AdminFrame& frame, QuizGateway& gateway)
    {
        const auto& areas = domain::GetAdminAreas();
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
