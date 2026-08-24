#pragma once

#include <cstddef>
#include <functional>
#include <memory>
#include <optional>
#include <string>
#include <vector>

#include <wx/string.h>

#include "modules/catalog/domain/CatalogShelf.h"
#include "modules/catalog/presentation/CatalogShelfNavigator.h"
#include "shared/accessibility/application/FocusPlanView.h"
#include "shared/accessibility/presentation/NonFocusablePanel.h"

class wxStaticText;
class wxWindow;

namespace lila::modules::catalog::application
{
class CatalogService;
}

namespace lila::modules::options::application
{
class OptionsStore;
}

namespace lila::shared::concurrency
{
class BackgroundTaskHandle;
}

namespace lila::shared::ui::controls
{
class VerticalMenu;
}

namespace lila::modules::catalog::presentation
{
class CatalogPanel final : public lila::shared::accessibility::NonFocusablePanel,
                           public lila::shared::accessibility::FocusPlanView
{
public:
    using CloseRequestedHandler = std::function<void()>;
    using OpenJoinRoomsRequestedHandler = std::function<void()>;
    using OpenStoryBookRequestedHandler = std::function<void()>;
    using OpenVaultRequestedHandler = std::function<void()>;
    using OpenGameRequestedHandler = std::function<void(const domain::CatalogGame&)>;

    CatalogPanel(
        wxWindow* parent,
        application::CatalogService& catalogService,
        lila::modules::options::application::OptionsStore& optionsStore,
        OpenJoinRoomsRequestedHandler onOpenJoinRoomsRequested,
        OpenStoryBookRequestedHandler onOpenStoryBookRequested,
        OpenVaultRequestedHandler onOpenVaultRequested,
        OpenGameRequestedHandler onOpenGameRequested,
        CloseRequestedHandler onCloseRequested);
    ~CatalogPanel() override;

    void ResetToRootForNextShow();
    [[nodiscard]] lila::shared::accessibility::FocusManager::Plan BuildFocusPlan() override;

private:
    enum class State
    {
        Loading,
        Ready,
        Error,
    };

    void BuildLayout();
    void BindEvents();
    void ShowStaticRoot(State state);
    void LoadShelves();
    void CancelCatalogLoad();
    void ApplyShelves(std::vector<domain::CatalogShelf> shelves);
    void RebuildFilteredShelves();
    void ShowCurrentShelves();
    void FocusMenuIfVisible();
    void HandleEscape();
    void UpdateStatus(const wxString& message, bool isError = false);

    application::CatalogService& catalogService_;
    lila::modules::options::application::OptionsStore& optionsStore_;
    OpenJoinRoomsRequestedHandler onOpenJoinRoomsRequested_;
    OpenStoryBookRequestedHandler onOpenStoryBookRequested_;
    OpenVaultRequestedHandler onOpenVaultRequested_;
    OpenGameRequestedHandler onOpenGameRequested_;
    CloseRequestedHandler onCloseRequested_;
    lila::shared::ui::controls::VerticalMenu* shelvesMenu_ = nullptr;
    wxStaticText* statusLabel_ = nullptr;
    CatalogShelfNavigator shelfNavigator_;
    std::vector<domain::CatalogShelf> allShelves_;
    std::optional<bool> appliedBetaSetting_;
    std::shared_ptr<lila::shared::concurrency::BackgroundTaskHandle> activeTask_;
    std::size_t rootSelectedIndex_ = 0;
    std::size_t catalogRequestId_ = 0;
    State state_ = State::Loading;
};
}
