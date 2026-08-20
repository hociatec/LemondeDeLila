#include "shared/text/Encoding.h"
#include "modules/chat/presentation/ChatFrame.h"
#include "modules/chat/presentation/ChatEventBinder.h"
#include "modules/chat/presentation/ChatFocusController.h"

namespace lila::modules::chat::presentation
{
void ChatFrame::BindEvents()
{
    ChatEventBinder::Bind(
        *this,
        ChatEventBinder::Widgets{*inputCtrl_, *historyList_, *editMessageButton_, *deleteMessageButton_},
        ChatEventBinder::Handlers{
            [this]() { SendInput(); },
            [this]()
            {
                ClearNavigationHistory();
                selectedActionMessageId_.reset();
                isHistoryActionMode_ = false;
                SyncActionState();
            },
            [this]() { HandleHistoryClick(); },
            [this]() { HandleHistoryActivation(); },
            [this]() { HandleEditSelected(); },
            [this]() { HandleDeleteSelected(); },
            [this]() { HandleEscape(); },
            [this]()
            {
                if (isReturningToSession_)
                {
                    isReturningToSession_ = false;
                    return;
                }
                if (onExitRequested_)
                {
                    onExitRequested_();
                }
            }});
    focusController_->BindNavigation(*this, [this]() { return isHistoryActionMode_; });
}
}
