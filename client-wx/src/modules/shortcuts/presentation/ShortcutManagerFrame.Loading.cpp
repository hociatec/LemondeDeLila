#include "modules/shortcuts/presentation/ShortcutManagerFrame.h"
#include "modules/shortcuts/application/ShortcutStore.h"
#include "modules/catalog/application/CatalogService.h"
#include "modules/catalog/application/CatalogVisibilityPolicy.h"
#include "shared/logging/application/Logger.h"
#include "shared/text/presentation/encoding/Encoding.h"
#include <wx/app.h>
#include <wx/weakref.h>
#include <set>

namespace lila::modules::shortcuts::presentation
{
namespace
{
struct Loaded
{
    domain::ShortcutSnapshot snapshot;
    std::vector<domain::ShortcutTarget> targets;
    bool gamesAvailable = false;
};
}
void ShortcutManagerFrame::Reload()
{
    if (busy_) return;
    Busy(true); Status(L"Chargement des raccourcis et des jeux...");
    request_.Cancel();
    const auto token = request_.CurrentToken();
    auto* store = &store_; auto* catalog = &catalog_;
    wxWeakRef<ShortcutManagerFrame> weak(this);
    auto task = lila::shared::concurrency::RunAsync<Loaded>(
        [store, catalog, userId = userId_, admin = admin_, beta = beta_](std::stop_token stop)
        {
            Loaded loaded{store->Load(userId, stop), domain::FunctionTargets(admin), false};
            try
            {
                const auto games = catalog->LoadCatalog(stop);
                std::set<std::string> seen;
                const auto visit = [&](auto&& self, const auto& shelves) -> void
                {
                    for (const auto& shelf : shelves)
                    {
                        for (const auto& game : shelf.games)
                            if (lila::modules::catalog::application::CatalogVisibilityPolicy::IsVisible(game, beta, games.administrator) &&
                                seen.insert(game.id).second)
                                loaded.targets.push_back({"game:" + game.id, "Jeu : " + game.name});
                        self(self, shelf.children);
                    }
                };
                visit(visit, games.shelves);
                loaded.gamesAvailable = true;
            }
            catch (const std::exception& error) { lila::shared::logging::LogWarning("ShortcutsCatalog", error.what()); }
            return loaded;
        },
        [weak, token](std::optional<lila::shared::errors::AppError> error, std::optional<Loaded> result)
        {
            wxTheApp->CallAfter([weak, token, error, result]
            {
                if (!weak || !weak->request_.Complete(token)) return;
                weak->Busy(false);
                if (error || !result) { weak->Status(L"Chargement impossible. Utilisez Actualiser."); return; }
                weak->snapshot_ = result->snapshot; weak->targets_ = result->targets;
                weak->Render();
                weak->Status(!result->snapshot.synchronized
                    ? L"Copie locale : synchronisation indisponible. Actualisez pour modifier vos raccourcis."
                    : !result->gamesAvailable ? L"Raccourcis chargés. Catalogue des jeux indisponible ; les fonctionnalités restent disponibles."
                    : L"Choisissez un raccourci ou utilisez Ajouter.");
                if (result->snapshot.synchronized && !weak->pendingTarget_.empty()) weak->Edit(true);
            });
        }, lila::shared::concurrency::BackgroundTaskPriority::Normal, "Chargement des raccourcis impossible.");
    if (!task->WasAccepted()) { Busy(false); Status(L"Service occupé. Réessayez."); return; }
    request_.Track(std::move(task));
}
}
