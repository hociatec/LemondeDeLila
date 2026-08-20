#include "shared/text/Encoding.h"
#include "modules/messaging/presentation/MessagingFrame.h"
#include "modules/messaging/presentation/MessagingFocusController.h"
#include "modules/messaging/presentation/MessagingEventBinder.h"
#include "modules/messaging/presentation/MessagingView.h"

namespace lila::modules::messaging::presentation
{
void MessagingFrame::BindEvents()
{
    MessagingEventBinder::Bind(
        *this,
        *view_,
        navigationState_,
        *focusController_,
        MessagingEventBinder::Handlers{
            [this](std::size_t index) { navigationState_.lastMenuIndex = index; },
            [this](std::size_t index) { OpenSelectedMenu(index); },
            [this]() { SyncSelectionState(); },
            [this]() { OpenDetail(); },
            [this]() { ReplyToSelectedMessage(); },
            [this]() { DeleteSelectedMessage(); },
            [this]() { RestoreSelectedMessage(); },
            [this]() { PurgeSelectedMessage(); },
            [this]() { SendComposedMessage(); },
            [this]() { return !isBusy_; },
            [this]() { CloseCompose(); },
            [this]() { SetScreen(Screen::Menu); },
            [this]() { SetScreen(Screen::List); },
            [this]()
            {
                if (onCloseRequested_)
                {
                    onCloseRequested_();
                }
            },
            [this]()
            {
                if (onExitRequested_)
                {
                    onExitRequested_();
                }
            }});
}
}

