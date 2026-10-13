#include "app/navigation/presentation/AppNavigator.h"
#include "app/navigation/presentation/HostFrame.h"
#include "modules/catalog/application/CatalogService.h"
#include "modules/catalog/application/CatalogVisibilityPolicy.h"
#include "modules/session/application/SessionStore.h"
#include "modules/options/application/OptionsStore.h"
#include "modules/shortcuts/presentation/ShortcutManagerFrame.h"
#include "shared/concurrency/application/BackgroundExecutor.h"
#include "shared/text/presentation/encoding/Encoding.h"
#include <wx/app.h>
#include <wx/choicdlg.h>
#include <wx/msgdlg.h>
#include <wx/weakref.h>
#include <stdexcept>

namespace lila::app::navigation
{
void AppNavigator::OpenShortcutGame(const std::string& gameId)
{
    if (shortcutGameTask_) shortcutGameTask_->RequestCancel();
    const auto generation = ++shortcutGameGeneration_;
    const auto origin = currentViewId_;
    const int userId = sessionStore_.Current().userId.value;
    const bool beta = optionsStore_.Current().general.enableBetaGames;
    const std::weak_ptr<int> lifetime(lifetimeToken_);
    const wxWeakRef<HostFrame> weak(hostFrame_);
    auto* catalog = &catalogService_;
    using Game = modules::catalog::domain::CatalogGame;
    shortcutGameTask_ = lila::shared::concurrency::RunAsync<Game>(
        [catalog, gameId, beta](std::stop_token stop)
        {
            const auto snapshot = catalog->LoadCatalog(stop);
            std::optional<Game> result;
            const auto visit = [&](auto&& self, const auto& shelves) -> void
            {
                for (const auto& shelf : shelves)
                {
                    for (const auto& game : shelf.games)
                        if (game.id == gameId && modules::catalog::application::CatalogVisibilityPolicy::IsVisible(
                            game, beta, snapshot.administrator)) result = game;
                    self(self, shelf.children);
                }
            };
            visit(visit, snapshot.shelves);
            if (!result) throw std::runtime_error("Ce jeu n'est plus disponible pour votre compte.");
            return *result;
        },
        [this, weak, lifetime, generation, origin, userId](std::optional<lila::shared::errors::AppError> error,
            std::optional<Game> game)
        {
            wxTheApp->CallAfter([this, weak, lifetime, generation, origin, userId, error, game]
            {
                if (!weak || lifetime.expired() || closing_ || generation != shortcutGameGeneration_ ||
                    origin != currentViewId_ || sessionStore_.Current().userId.value != userId ||
                    !hostFrame_->IsEnabled() || !hostFrame_->IsActive()) return;
                if (error || !game)
                {
                    wxMessageBox(error ? lila::shared::text::FromUtf8(error->UserMessage()) : wxString(L"Jeu indisponible."),
                        L"Raccourcis", wxOK | wxICON_INFORMATION, hostFrame_);
                    return;
                }
                wxArrayString choices;
                choices.Add(L"Créer une table"); choices.Add(L"Rejoindre une table");
                choices.Add(L"Ajouter un raccourci pour ce jeu");
                wxSingleChoiceDialog dialog(hostFrame_, lila::shared::text::FromUtf8(game->summary),
                    lila::shared::text::FromUtf8(game->name), choices);
                if (dialog.ShowModal() != wxID_OK) return;
                if (sessionStore_.Current().userId.value != userId || closing_) return;
                switch (dialog.GetSelection())
                {
                case 0:
                    shortcutReturnView_ = domain::ViewId::None;
                    CreateRoom(*game);
                    break;
                case 1:
                    ShowJoinRooms(game->id);
                    break;
                case 2:
                    ShowShortcuts(lastMainMenuSelection_);
                    dynamic_cast<modules::shortcuts::presentation::ShortcutManagerFrame*>(currentView_)
                        ->AddForTarget("game:" + game->id);
                    break;
                default: break;
                }
            });
        }, lila::shared::concurrency::BackgroundTaskPriority::Normal, "Impossible d'ouvrir ce jeu.");
    if (!shortcutGameTask_->WasAccepted())
        wxMessageBox(L"Service occupé. Réessayez.", L"Raccourcis", wxOK, hostFrame_);
}
}
