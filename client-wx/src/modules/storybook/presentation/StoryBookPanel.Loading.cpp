#include "modules/storybook/presentation/StoryBookPanel.h"

#include <optional>
#include <span>
#include <stop_token>
#include <utility>

#include <wx/weakref.h>

#include "modules/storybook/application/StoryBookService.h"
#include "shared/concurrency/BackgroundExecutor.h"
#include "shared/errors/ErrorMessages.h"
#include "shared/text/Encoding.h"
#include "shared/ui/controls/VerticalMenu.h"

namespace lila::modules::storybook::presentation
{
void StoryBookPanel::LoadGames()
{
    CancelRequest();
    const auto generation = requestSlot_.CurrentToken();
    state_ = State::Loading;
    UpdateStatus(wxString{});

    auto* service = &service_;
    const auto userId = targetUserId_;
    wxWeakRef<StoryBookPanel> weakThis(this);
    requestSlot_.Track(lila::shared::concurrency::RunAsync<std::vector<domain::StoryBookGame>>(
        [service, userId](std::stop_token stopToken)
        {
            return userId.has_value()
                ? service->LoadUser(*userId, stopToken)
                : service->LoadOwn(stopToken);
        },
        [weakThis, generation](
            std::optional<lila::shared::errors::AppError> error,
            std::optional<std::vector<domain::StoryBookGame>> games) mutable
        {
            if (!weakThis)
            {
                return;
            }
            weakThis->CallAfter(
                [weakThis, generation, error = std::move(error), games = std::move(games)]() mutable
                {
                    if (!weakThis || !weakThis->requestSlot_.Complete(generation))
                    {
                        return;
                    }
                    if (error.has_value() || !games.has_value())
                    {
                        const auto message = error.has_value()
                            ? error->UserMessage()
                            : std::string(lila::shared::errors::StoryBookLoadFailed);
                        weakThis->ShowError(lila::shared::text::FromUtf8(message));
                        return;
                    }
                    weakThis->ApplyGames(std::move(*games));
                });
        },
        lila::shared::concurrency::BackgroundTaskPriority::Normal,
        lila::shared::errors::StoryBookLoadFailed));
}

void StoryBookPanel::ApplyGames(std::vector<domain::StoryBookGame> games)
{
    navigator_.OpenGames(std::move(games));
    state_ = State::Ready;
    ShowCurrentPage();
}

void StoryBookPanel::ShowError(const wxString& message)
{
    state_ = State::Error;
    const lila::shared::ui::controls::VerticalMenuItem retry{"retry", wxString(L"R\u00E9essayer")};
    menu_->SetItems(std::span<const lila::shared::ui::controls::VerticalMenuItem>(&retry, 1));
    menu_->SetSelectedIndexSilently(0);
    UpdateStatus(message, true);
    FocusMenuIfVisible();
}
}
