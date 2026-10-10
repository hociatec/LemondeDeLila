#include <cassert>
#include <functional>
#include <chrono>
#include <atomic>
#include <condition_variable>
#include <mutex>
#include <thread>
#include <iostream>
#include <wx/listbox.h>
#include <stdexcept>
#ifdef _MSC_VER
#include <crtdbg.h>
#endif
#include <wx/app.h>
#include <wx/frame.h>
#include <wx/log.h>
#include "modules/audio/application/IAudioService.h"
#include "modules/social/presentation/SocialLoadController.h"
#include "modules/social/presentation/SocialFrame.h"
#include "shared/concurrency/application/BackgroundExecutor.h"
#include "modules/social/presentation/SocialDataStore.h"
#include "modules/social/presentation/SocialNavigationState.h"
#include "modules/social/presentation/SocialSectionCoordinator.h"
#include "modules/social/presentation/SocialSectionPresenter.h"
#include "modules/social/presentation/SocialSelectionMemory.h"
#include "modules/social/presentation/SocialView.h"
#include "shared/ui/presentation/controls/VerticalMenu.h"

using namespace lila::modules::social;
using namespace lila::modules::social::presentation;
class Audio final : public lila::modules::audio::application::IAudioService
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
class Gateway final : public application::ISocialGateway
{
public:
    mutable int snapshotReads = 0;
    std::vector<domain::SocialUser> users;
    Gateway()
    {
        for (int id : {1, 2, 3})
        {
            domain::SocialUser user;
            user.id = id;
            user.username = std::to_string(id);
            users.push_back(user);
        }
    }
    domain::SocialFriendsSnapshot GetFriendsSnapshot() const override
    {
        ++snapshotReads;
        return {users, {}};
    }
    domain::SocialRequestsSnapshot GetRequestsSnapshot(const std::string&) const override
    {
        ++snapshotReads;
        domain::SocialRequestsSnapshot result;
        for (const auto& user : users)
        {
            domain::SocialFriendRequest request;
            request.id = user.id;
            request.requester = request.addressee = user;
            result.requests.push_back(request);
        }
        return result;
    }
    std::vector<domain::SocialUser> GetFriends() const override { throw std::runtime_error("unbundled friends read"); }
    std::vector<domain::SocialFriendRequest> GetRequests(const std::string&) const override { throw std::runtime_error("unbundled request read"); }
    std::vector<domain::SocialUser> GetBlockedUsers() const override { return users; }
    domain::SocialRelationshipState GetRelationshipState(int) const override { return {}; }
    bool RequestFriend(int) const override { return true; }
    bool AcceptFriend(int) const override { return true; }
    bool RejectFriend(int) const override { return true; }
    bool CancelRequest(int) const override { return true; }
    bool RemoveFriend(int) const override { return true; }
    bool BlockUser(int) const override { return true; }
    bool UnblockUser(int) const override { return true; }
    std::vector<domain::SocialUser> SearchUsers(const std::string&) const override { return {}; }
    std::optional<domain::SocialProfile> GetProfile(std::optional<int>) const override { return {}; }
    std::optional<domain::SocialProfile> UpdateProfile(const domain::SocialProfileUpdate&) const override { return {}; }
};
class TestApp final : public wxApp { public: bool OnInit() override { return true; } };
#include "SocialReadSchedulingTests.inc"
wxIMPLEMENT_APP_NO_MAIN(TestApp);
int main(int argc, char** argv)
{
#ifdef _MSC_VER
    _CrtSetReportMode(_CRT_ASSERT, _CRTDBG_MODE_FILE);
    _CrtSetReportFile(_CRT_ASSERT, _CRTDBG_FILE_STDERR);
#endif
    delete wxLog::SetActiveTarget(new wxLogStderr());
    assert(wxEntryStart(argc, argv));
    assert(wxTheApp->CallOnInit());
    if (argc > 1 && std::string(argv[1]) == "--benchmark")
    {
        using namespace lila::shared::ui::controls;
        auto* frame = new wxFrame(nullptr, wxID_ANY, "Native list performance", wxDefaultPosition, wxSize(800, 600));
        auto* menu = new VerticalMenu(frame, {}, VerticalMenuRole::List);
        menu->SetSize(800, 600);
        frame->Show();
        wxTheApp->Yield();
        for (int pass = 0; pass < 4; ++pass)
        {
            std::vector<VerticalMenuItem> items;
            for (int i = 0; i < 3000; ++i)
                items.push_back({std::to_string(i), wxString::Format("Player %d - status %d", i, pass)});
            const auto start = std::chrono::steady_clock::now();
            menu->SetItemsForNavigation(items, 1500);
            menu->GetSelectedControl()->SetFocus();
            wxTheApp->Yield();
            std::cout << "list_pass_" << pass << "_ms=" << std::chrono::duration<double, std::milli>(
                std::chrono::steady_clock::now() - start).count() << '\n';
            assert(menu->GetItemCount() == 3000 && menu->GetSelectedIndex() == 1500);
            assert(static_cast<wxListBox*>(menu->GetSelectedControl())->GetString(1500) == items[1500].label);
        }
        delete frame;
        wxTheApp->OnExit();
        wxEntryCleanup();
        return 0;
    }
    Gateway gateway;
    Audio audio;
    application::SocialService service(gateway, audio);
    SocialReadSchedulingTest::Run(service);
    auto controller = std::make_shared<SocialLoadController>(service);
    assert(controller->LoadFriends().friends.size() == 3);
    const auto removedUser = gateway.users.back();
    gateway.users.pop_back(); // A change made by another client must appear on reopening.
    assert(controller->LoadFriends().friends.size() == 2);
    assert(!service.IsFriendCached(removedUser.id.value));
    assert(gateway.snapshotReads == 2);
    service.ClearCache();
    gateway.users.push_back(removedUser);
    assert(controller->LoadFriends().friends.size() == 3);
    assert(gateway.snapshotReads == 3);
    assert(controller->LoadIncomingRequests().requests.size() == 3);
    assert(controller->LoadOutgoingRequests().requests.size() == 3);
    assert(controller->LoadBlockedUsers().size() == 3);
    gateway.users.pop_back();
    assert(controller->LoadIncomingRequests().requests.size() == 2);
    assert(controller->LoadOutgoingRequests().requests.size() == 2);
    assert(controller->LoadBlockedUsers().size() == 2);
    gateway.users.push_back(removedUser);
    auto* host = new wxFrame(nullptr, wxID_ANY, "social-loading-test");
    auto* view = new SocialView(host);
    SocialDataStore data;
    SocialNavigationState state;
    SocialSelectionMemory memory;
    SocialSectionPresenter presenter(*host, *view, data, state, memory);
    std::function<void()> worker, complete;
    int focusChanges = 0, statusChanges = 0;
    SocialSectionCoordinator coordinator(controller, data, state, presenter, *view, {
        [&](const wxString&, const auto& work, const auto& done, bool)
        { worker = work; complete = done; },
        [&](const wxString&, bool, bool) { ++statusChanges; },
        [&]() {
            ++focusChanges;
            const auto controls = view->SectionFor(state.currentSection);
            if (controls.list->GetItemCount() > 0) controls.list->GetSelectedControl()->SetFocus();
            else controls.emptyControl->SetFocus();
        },
    });
    host->Show();
    view->sectionBook->Show();
    wxYield();
    for (const auto section : {SocialSection::Friends, SocialSection::IncomingRequests,
                              SocialSection::OutgoingRequests, SocialSection::Blocked})
    {
        coordinator.ActivateSection(section);
        presenter.SyncSelectionState();
        const auto controls = view->SectionFor(section);
        controls.emptyControl->SetFocus();
        worker();
        focusChanges = 0;
        complete();
        assert(controls.list->GetItemCount() == 3);
        assert(focusChanges == 1); // The focused empty control disappears.
        coordinator.RefreshSection(section);
        controls.list->SetSelectedIndexSilently(2); // User moves during the request.
        controls.list->GetSelectedControl()->SetFocus();
        worker();
        focusChanges = 0;
        complete();
        assert(focusChanges == 0);
        assert(controls.list->GetSelectedIndex() == 2);
        assert(wxWindow::FindFocus() == controls.list->GetSelectedControl());

        coordinator.ActivateSection(section);
        assert(controls.list->GetItemCount() == 3);
        assert(controls.list->GetSelectedIndex() == 2);
        worker();
        focusChanges = 0;
        complete();
        assert(focusChanges == 0 && controls.list->GetSelectedIndex() == 2);

        coordinator.RefreshSection(section);
        state.currentScreen = SocialNavigationState::Screen::Menu;
        view->menu->GetSelectedControl()->SetFocus();
        view->sectionBook->Hide();
        worker();
        focusChanges = statusChanges = 0;
        complete();
        assert(focusChanges == 0 && statusChanges == 0);
        assert(wxWindow::FindFocus() == view->menu->GetSelectedControl());
        view->sectionBook->Show();
    }
    delete host;
    wxTheApp->OnExit();
    wxEntryCleanup();
}
