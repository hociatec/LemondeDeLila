#pragma once

#include <functional>
#include <memory>
#include <optional>
#include <string>
#include <vector>

#include <wx/string.h>

#include "modules/storybook/domain/StoryBookStats.h"
#include "modules/storybook/presentation/StoryBookNavigator.h"
#include "shared/accessibility/application/FocusPlanView.h"
#include "shared/accessibility/presentation/NonFocusablePanel.h"
#include "shared/concurrency/application/AsyncRequestSlot.h"

class wxStaticText;
class wxWindow;
namespace lila::shared::ui::controls { class VerticalMenu; }
namespace lila::modules::storybook::application { class StoryBookService; }

namespace lila::modules::storybook::presentation
{
class StoryBookPanel final : public lila::shared::accessibility::NonFocusablePanel,
                             public lila::shared::accessibility::FocusPlanView
{
public:
    using CloseRequestedHandler = std::function<void()>;
    using OpenLeaderboardRequestedHandler = std::function<void()>;

    StoryBookPanel(
        wxWindow* parent,
        application::StoryBookService& service,
        OpenLeaderboardRequestedHandler onOpenLeaderboardRequested,
        CloseRequestedHandler onCloseRequested);
    ~StoryBookPanel() override;

    void OpenOwn();
    void OpenUser(int userId, std::string username);
    [[nodiscard]] lila::shared::accessibility::FocusManager::Plan BuildFocusPlan() override;

private:
    enum class State
    {
        Ready,
        Loading,
        Error,
    };

    void BuildLayout();
    void BindEvents();
    void LoadGames();
    void ApplyGames(std::vector<domain::StoryBookGame> games);
    void ShowCurrentPage();
    void ShowError(const wxString& message);
    void HandleActivation(std::size_t index);
    void HandleEscape();
    void CancelRequest();
    void FocusMenuIfVisible();
    void UpdateStatus(const wxString& message, bool isError = false);

    application::StoryBookService& service_;
    OpenLeaderboardRequestedHandler onOpenLeaderboardRequested_;
    CloseRequestedHandler onCloseRequested_;
    lila::shared::ui::controls::VerticalMenu* menu_ = nullptr;
    wxStaticText* titleLabel_ = nullptr;
    wxStaticText* statusLabel_ = nullptr;
    StoryBookNavigator navigator_;
    std::optional<int> targetUserId_;
    std::string targetUsername_;
    lila::shared::concurrency::AsyncRequestSlot requestSlot_;
    State state_ = State::Ready;
};
}
