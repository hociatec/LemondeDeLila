#include <atomic>
#include <cassert>
#include <chrono>
#include <condition_variable>
#include <iostream>
#include <mutex>
#include <thread>
#include <wx/app.h>
#include <wx/frame.h>
#include <wx/listbox.h>
#include <wx/log.h>
#ifdef _MSC_VER
#include <crtdbg.h>
#endif
#include "modules/rooms/application/IRoomLobbyGateway.h"
#include "modules/rooms/application/RoomLobbyService.h"
#include "modules/rooms/presentation/join/JoinRoomsPanel.h"
#include "modules/leaderboard/application/ILeaderboardGateway.h"
#include "modules/leaderboard/application/LeaderboardService.h"
#include "modules/leaderboard/presentation/LeaderboardPanel.h"
#include "shared/accessibility/presentation/FocusCoordinator.h"
#include "shared/concurrency/application/BackgroundExecutor.h"

using namespace std::chrono_literals;
namespace rooms = lila::modules::rooms;
namespace leaderboard = lila::modules::leaderboard;

// Hold responses until the test releases them. UI checks must finish while
// the data request is still pending, regardless of machine speed.
struct SlowResponse
{
    mutable std::mutex mutex;
    mutable std::condition_variable_any wake;
    bool released = false;
    void Wait(std::stop_token stop) const
    {
        std::unique_lock lock(mutex);
        wake.wait(lock, stop, [this] { return released; });
    }
    void Release()
    {
        { std::lock_guard lock(mutex); released = true; }
        wake.notify_all();
    }
};
class RoomGateway final : public rooms::application::IRoomLobbyGateway
{
public:
    SlowResponse response;
    std::vector<rooms::domain::PublicRoom> ListPublic(std::stop_token stop) const override
    {
        response.Wait(stop);
        rooms::domain::PublicRoom room;
        room.id = 12; room.name = "Loaded room";
        return {room};
    }
    std::vector<rooms::domain::RoomInviteCandidate> ListInviteCandidates(int, std::stop_token) const override { return {}; }
    std::vector<rooms::domain::TableAmbience> ListTableAmbiences(std::stop_token) const override { return {}; }
    void SendInvite(int, int, std::stop_token) const override {}
    void RespondInvite(std::string_view, bool, std::stop_token) const override {}
};
class RankingGateway final : public leaderboard::application::ILeaderboardGateway
{
public:
    SlowResponse response;
    std::vector<leaderboard::domain::LeaderboardGame> LoadGames(std::stop_token stop) const override
    {
        response.Wait(stop);
        return {{"test", "Loaded game"}};
    }
    leaderboard::domain::LeaderboardTop LoadTop(std::string_view, std::stop_token) const override { return {}; }
};

class TestApp final : public wxApp { public: bool OnInit() override { return true; } };
wxIMPLEMENT_APP_NO_MAIN(TestApp);

template<class Factory>
void CheckTransitions(Factory create, SlowResponse& response, bool cancel)
{
    auto* frame = new wxFrame(nullptr, wxID_ANY, "Loading transition test");
    bool closed = false, completed = false;
    auto* panel = create(frame, [&] { closed = true; frame->Hide(); });
    panel->Hide();
    const auto start = std::chrono::steady_clock::now();
    panel->Prepare([&] { completed = true; });
    panel->Show();
    frame->Show();
    frame->Raise();
    wxTheApp->Yield();
    assert(lila::shared::accessibility::FocusCoordinator::Apply(panel->BuildFocusPlan()));
    auto* list = dynamic_cast<wxListBox*>(wxWindow::FindFocus());
    assert(list && list->GetCount() == 1);
    assert(list->GetString(0).StartsWith("Chargement"));
    assert(!completed); // Visible/focusable before the response is released.
    std::cout << "open_pending_ms=" << std::chrono::duration<double, std::milli>(
        std::chrono::steady_clock::now() - start).count() << '\n';
    if (cancel)
    {
        const auto closeStart = std::chrono::steady_clock::now();
        wxKeyEvent escape(wxEVT_CHAR_HOOK);
        escape.m_keyCode = WXK_ESCAPE;
        panel->ProcessWindowEvent(escape);
        assert(closed && !frame->IsShown());
        std::cout << "close_pending_ms=" << std::chrono::duration<double, std::milli>(
            std::chrono::steady_clock::now() - closeStart).count() << '\n';
    }
    response.Release();
    const auto timeout = std::chrono::steady_clock::now() + 3s;
    while (std::chrono::steady_clock::now() < timeout)
    {
        wxTheApp->Yield();
        const auto stats = lila::shared::concurrency::CurrentBackgroundExecutor().Stats();
        if (stats.active == 0 && stats.queued == 0) break;
        std::this_thread::sleep_for(1ms);
    }
    wxTheApp->Yield();
    if (cancel) assert(!completed && !frame->IsShown());
    else
    {
        assert(completed && list->GetCount() == 1);
        assert(list->GetString(0).StartsWith("Loaded"));
        assert(list->HasFocus());
    }
    delete frame;
    wxTheApp->Yield();
}

int main(int argc, char** argv)
{
#ifdef _MSC_VER
    _CrtSetReportMode(_CRT_ASSERT, _CRTDBG_MODE_FILE);
    _CrtSetReportFile(_CRT_ASSERT, _CRTDBG_FILE_STDERR);
#endif
    delete wxLog::SetActiveTarget(new wxLogStderr());
    assert(wxEntryStart(argc, argv));
    assert(wxTheApp->CallOnInit());
    lila::shared::concurrency::BackgroundExecutor executor({2, 16});
    lila::shared::concurrency::InstallBackgroundExecutor(executor);
    for (bool cancel : {false, true})
    {
        RoomGateway rooms;
        rooms::application::RoomLobbyService lobby(rooms);
        CheckTransitions([&](wxWindow* parent, auto close) {
            return new rooms::presentation::JoinRoomsPanel(parent, lobby, {}, close);
        }, rooms.response, cancel);
        RankingGateway rankings;
        leaderboard::application::LeaderboardService ranking(rankings);
        CheckTransitions([&](wxWindow* parent, auto close) {
            return new leaderboard::presentation::LeaderboardPanel(parent, ranking, close);
        }, rankings.response, cancel);
    }
    executor.Shutdown();
    lila::shared::concurrency::UninstallBackgroundExecutor();
    wxTheApp->OnExit();
    wxEntryCleanup();
}
