#include "modules/catalog/presentation/CatalogPanel.h"

#include <optional>
#include <algorithm>
#include <cctype>
#include <stop_token>
#include <string>
#include <utility>

#include <wx/stattext.h>
#include <wx/weakref.h>

#include "modules/catalog/application/CatalogService.h"
#include "modules/options/application/OptionsStore.h"
#include "shared/accessibility/application/FocusCoordinator.h"
#include "shared/concurrency/application/BackgroundExecutor.h"
#include "shared/errors/catalog/ErrorMessages.h"
#include "shared/logging/application/Logger.h"
#include "shared/text/presentation/encoding/Encoding.h"
#include "shared/ui/presentation/theme/Theme.h"
#include "shared/ui/presentation/controls/VerticalMenu.h"

namespace lila::modules::catalog::presentation
{
void CatalogPanel::ShowStaticRoot(State state)
{
    std::vector<lila::shared::ui::controls::VerticalMenuItem> items = {
        lila::shared::ui::controls::VerticalMenuItem{"action:join", wxString(L"Rejoindre une partie")},
        lila::shared::ui::controls::VerticalMenuItem{"action:storybook", wxString(L"Livre des contes")},
        lila::shared::ui::controls::VerticalMenuItem{"action:vault", wxString(L"Mon coffre fort")},
    };
    if (state == State::Error)
    {
        items.push_back({"retry", wxString(L"R\u00E9essayer de charger les jeux")});
    }

    if (rootSelectedIndex_ >= items.size())
    {
        rootSelectedIndex_ = 0;
    }
    state_ = state;
    shelvesMenu_->SetItemsForNavigation(items, rootSelectedIndex_);
    UpdateStatus(wxString{});
    FocusMenuIfVisible();
}

void CatalogPanel::LoadShelves()
{
    if (activeTask_ != nullptr)
    {
        activeTask_->RequestCancel();
    }

    const std::size_t requestId = ++catalogRequestId_;
    ShowStaticRoot(State::Loading);

    auto* service = &catalogService_;
    wxWeakRef<CatalogPanel> weakThis(this);
    activeTask_ = lila::shared::concurrency::RunAsync<std::vector<domain::CatalogShelf>>(
        [service](std::stop_token stopToken)
        {
            return service->LoadShelves(stopToken);
        },
        [weakThis, requestId](
            std::optional<lila::shared::errors::AppError> error,
            std::optional<std::vector<domain::CatalogShelf>> shelves) mutable
        {
            if (!weakThis)
            {
                return;
            }

            weakThis->CallAfter(
                [weakThis, requestId, error = std::move(error), shelves = std::move(shelves)]() mutable
                {
                    if (!weakThis)
                    {
                        return;
                    }

                    if (weakThis->catalogRequestId_ != requestId)
                    {
                        return;
                    }
                    weakThis->activeTask_.reset();
                    if (error.has_value() || !shelves.has_value())
                    {
                        if (error.has_value())
                        {
                            lila::shared::logging::LogError(
                                "Catalog",
                                error->DiagnosticDetails().empty()
                                    ? error->UserMessage()
                                    : error->DiagnosticDetails());
                        }
                        weakThis->ShowStaticRoot(State::Error);
                        const std::string message = error.has_value()
                            ? error->UserMessage()
                            : std::string(lila::shared::errors::CatalogLoadFailed);
                        weakThis->UpdateStatus(lila::shared::text::FromUtf8(message), true);
                        return;
                    }

                    weakThis->ApplyShelves(std::move(*shelves));
                });
        },
        lila::shared::concurrency::BackgroundTaskPriority::Normal,
        lila::shared::errors::CatalogLoadFailed);
}

void CatalogPanel::CancelCatalogLoad()
{
    ++catalogRequestId_;
    if (activeTask_ != nullptr)
    {
        activeTask_->RequestCancel();
        activeTask_.reset();
    }
}

void CatalogPanel::ApplyShelves(std::vector<domain::CatalogShelf> shelves)
{
    allShelves_ = std::move(shelves);
    appliedBetaSetting_.reset();
    RebuildFilteredShelves();
    ShowCurrentShelves();
}

void CatalogPanel::RebuildFilteredShelves()
{
    const bool betaEnabled = optionsStore_.Current().enableBetaGames;
    if (appliedBetaSetting_ == betaEnabled)
    {
        shelfNavigator_.ResetToRoot();
        return;
    }
    auto filtered = allShelves_;
    const auto filterShelf = [betaEnabled](auto&& self, domain::CatalogShelf& shelf) -> void
    {
        std::erase_if(
            shelf.games,
            [betaEnabled](const domain::CatalogGame& game)
            {
                std::string status = game.status;
                std::transform(status.begin(), status.end(), status.begin(), [](unsigned char value)
                {
                    return static_cast<char>(std::tolower(value));
                });
                return status == "construction" || (status == "beta" && !betaEnabled);
            });
        for (auto& child : shelf.children)
        {
            self(self, child);
        }
    };
    for (auto& shelf : filtered)
    {
        filterShelf(filterShelf, shelf);
    }
    shelfNavigator_.Reset(std::move(filtered));
    appliedBetaSetting_ = betaEnabled;
}

void CatalogPanel::ShowCurrentShelves()
{
    const auto& shelves = shelfNavigator_.CurrentShelves();
    const auto& games = shelfNavigator_.CurrentGames();

    std::vector<lila::shared::ui::controls::VerticalMenuItem> items;
    if (shelfNavigator_.IsShowingGames())
    {
        items.reserve(games.size());
        for (const auto& game : games)
        {
            items.push_back({game.id, lila::shared::text::FromUtf8(game.name)});
        }
    }
    else
    {
        items.reserve(shelves.size() + (shelfNavigator_.IsAtRoot() ? 3 : 0));
        if (shelfNavigator_.IsAtRoot())
        {
            items.push_back({"action:join", wxString(L"Rejoindre une partie")});
            items.push_back({"action:storybook", wxString(L"Livre des contes")});
            items.push_back({"action:vault", wxString(L"Mon coffre fort")});
        }
        for (const auto& shelf : shelves)
        {
            items.push_back({shelf.id, lila::shared::text::FromUtf8(shelf.name)});
        }
    }

    state_ = State::Ready;
    shelvesMenu_->SetItemsForNavigation(
        items,
        shelfNavigator_.IsAtRoot() ? rootSelectedIndex_ : shelfNavigator_.SelectedIndex());
    UpdateStatus(
        shelfNavigator_.IsShowingGames()
            ? (games.size() == 1
                ? wxString(L"1 jeu disponible.")
                : wxString::Format(wxString(L"%zu jeux disponibles."), games.size()))
            : (shelves.size() == 1
                ? wxString(L"1 \u00E9tag\u00E8re disponible.")
                : wxString::Format(wxString(L"%zu \u00E9tag\u00E8res disponibles."), shelves.size())));
    FocusMenuIfVisible();
}

void CatalogPanel::FocusMenuIfVisible()
{
    if (IsShownOnScreen())
    {
        static_cast<void>(lila::shared::accessibility::FocusCoordinator::Apply(BuildFocusPlan()));
    }
}

void CatalogPanel::UpdateStatus(const wxString& message, bool isError)
{
    statusLabel_->SetLabel(message);
    statusLabel_->SetForegroundColour(
        isError ? lila::shared::ui::Theme::Error() : lila::shared::ui::Theme::Accent());
    statusLabel_->Show(!message.empty());
    Layout();
}
}
