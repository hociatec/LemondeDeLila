#include "modules/catalog/presentation/CatalogPanel.h"

#include "shared/accessibility/NavigationController.h"
#include "shared/ui/controls/VerticalMenu.h"

namespace lila::modules::catalog::presentation
{
void CatalogPanel::BindEvents()
{
    shelvesMenu_->SetSelectionChangedHandler(
        [this](std::size_t index)
        {
            if (state_ == State::Ready)
            {
                if (shelfNavigator_.IsShowingGames())
                {
                    shelfNavigator_.Select(index);
                }
                else if (shelfNavigator_.IsAtRoot())
                {
                    rootSelectedIndex_ = index;
                    if (index >= 3)
                    {
                        shelfNavigator_.Select(index - 3);
                    }
                }
                else
                {
                    shelfNavigator_.Select(index);
                }
                return;
            }

            rootSelectedIndex_ = index;
        });
    shelvesMenu_->SetActivatedHandler(
        [this](std::size_t index)
        {
            const bool isRoot = state_ != State::Ready || shelfNavigator_.IsAtRoot();
            if (isRoot && index < 3)
            {
                rootSelectedIndex_ = index;
                if (index == 0 && onOpenJoinRoomsRequested_)
                {
                    onOpenJoinRoomsRequested_();
                }
                else if (index == 1 && onOpenStoryBookRequested_)
                {
                    onOpenStoryBookRequested_();
                }
                else if (index == 2 && onOpenVaultRequested_)
                {
                    onOpenVaultRequested_();
                }
                return;
            }
            if (state_ == State::Error && index == 3)
            {
                LoadShelves();
                return;
            }
            if (state_ != State::Ready)
            {
                return;
            }
            if (shelfNavigator_.IsShowingGames())
            {
                const auto& games = shelfNavigator_.CurrentGames();
                if (index < games.size() && onOpenGameRequested_)
                {
                    onOpenGameRequested_(games[index]);
                }
                return;
            }
            const std::size_t shelfIndex = shelfNavigator_.IsAtRoot() ? index - 3 : index;
            if (shelfNavigator_.Enter(shelfIndex))
            {
                ShowCurrentShelves();
            }
        });

    lila::shared::accessibility::NavigationController::BindEscapeNavigation(
        *this,
        [this]()
        {
            HandleEscape();
            return true;
        });
}

void CatalogPanel::HandleEscape()
{
    if (state_ == State::Ready && shelfNavigator_.Back())
    {
        if (shelfNavigator_.IsAtRoot())
        {
            rootSelectedIndex_ = shelfNavigator_.SelectedIndex() + 3;
        }
        ShowCurrentShelves();
        return;
    }

    if (onCloseRequested_)
    {
        onCloseRequested_();
    }
}
}
