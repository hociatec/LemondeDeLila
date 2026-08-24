#include "modules/vault/presentation/VaultPanel.h"

#include "shared/accessibility/application/NavigationController.h"
#include "shared/ui/presentation/controls/VerticalMenu.h"

namespace lila::modules::vault::presentation
{
void VaultPanel::BindEvents()
{
    menu_->SetSelectionChangedHandler(
        [this](std::size_t index)
        {
            if (state_ == State::Ready) navigator_.Select(index);
        });
    menu_->SetActivatedHandler([this](std::size_t index) { HandleActivation(index); });
    menu_->SetKeyHandler(
        [this](int keyCode)
        {
            if (keyCode == WXK_SPACE || keyCode == WXK_NUMPAD_SPACE) return true;
            if (keyCode != WXK_DELETE && keyCode != WXK_NUMPAD_DELETE) return false;
            if (state_ == State::Ready) RequestDeleteConfirmation();
            return true;
        });
    lila::shared::accessibility::NavigationController::BindEscapeNavigation(
        *this,
        [this]()
        {
            HandleEscape();
            return true;
        });
}

void VaultPanel::HandleActivation(std::size_t index)
{
    if (state_ == State::Loading || state_ == State::Mutating) return;
    if (state_ == State::ConfirmDelete)
    {
        if (index == 0) DeleteSelected();
        else if (index == 1) CancelDeleteConfirmation();
        return;
    }
    if (state_ == State::InitialError)
    {
        Load();
        return;
    }

    switch (navigator_.Activate(index))
    {
    case VaultNavigator::Activation::Restore:
        RestoreSelected();
        return;
    case VaultNavigator::Activation::None:
        return;
    }
}

void VaultPanel::HandleEscape()
{
    if (state_ == State::Mutating) return;
    if (state_ == State::ConfirmDelete)
    {
        CancelDeleteConfirmation();
        return;
    }
    if (state_ == State::Loading) CancelRequest();
    if (onCloseRequested_) onCloseRequested_();
}
}
