#pragma once

#include <cstddef>
#include <functional>
#include <memory>
#include <vector>

#include <wx/string.h>

#include "modules/leaderboard/domain/Leaderboard.h"
#include "modules/leaderboard/presentation/LeaderboardNavigator.h"
#include "shared/accessibility/FocusPlanView.h"
#include "shared/accessibility/NonFocusablePanel.h"
#include "shared/concurrency/AsyncRequestSlot.h"

class wxStaticText;
class wxWindow;
namespace lila::shared::ui::controls { class VerticalMenu; }
namespace lila::modules::leaderboard::application { class LeaderboardService; }

namespace lila::modules::leaderboard::presentation
{
class LeaderboardPanel final : public lila::shared::accessibility::NonFocusablePanel,
                               public lila::shared::accessibility::FocusPlanView
{
public:
    using CloseRequestedHandler = std::function<void()>;
    using PreparedHandler = std::function<void()>;

    LeaderboardPanel(
        wxWindow* parent,
        application::LeaderboardService& service,
        CloseRequestedHandler onCloseRequested);
    ~LeaderboardPanel() override;

    void Prepare(PreparedHandler onPrepared);
    [[nodiscard]] lila::shared::accessibility::FocusManager::Plan BuildFocusPlan() override;

private:
    enum class State
    {
        Ready,
        Loading,
        Error,
    };

    enum class Request
    {
        Games,
        Top,
    };

    void BuildLayout();
    void BindEvents();
    void LoadGames(PreparedHandler onPrepared = {});
    void LoadTop(std::size_t gameIndex);
    void ApplyGames(std::vector<domain::LeaderboardGame> games, PreparedHandler onPrepared);
    void ApplyTop(std::size_t gameIndex, domain::LeaderboardTop top);
    void ShowCurrentPage();
    void ShowError(const wxString& message, Request request, std::size_t gameIndex = 0);
    void HandleActivation(std::size_t index);
    void HandleEscape();
    void CancelRequest();
    void FocusMenuIfVisible();
    void UpdateStatus(const wxString& message, bool isError = false);

    application::LeaderboardService& service_;
    CloseRequestedHandler onCloseRequested_;
    lila::shared::ui::controls::VerticalMenu* menu_ = nullptr;
    wxStaticText* titleLabel_ = nullptr;
    wxStaticText* statusLabel_ = nullptr;
    LeaderboardNavigator navigator_;
    lila::shared::concurrency::AsyncRequestSlot requestSlot_;
    std::size_t pendingGameIndex_ = 0;
    State state_ = State::Loading;
    Request pendingRequest_ = Request::Games;
    bool gamesLoaded_ = false;
};
}
