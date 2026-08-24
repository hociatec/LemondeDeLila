#pragma once

#include <cstddef>
#include <functional>

class wxWindow;

namespace lila::modules::messaging::presentation
{
class MessagingFocusController;
class MessagingNavigationState;
class MessagingView;

class MessagingEventBinder final
{
public:
    struct Handlers
    {
        std::function<void(std::size_t)> menuSelectionChanged;
        std::function<void(std::size_t)> openMenu;
        std::function<void()> syncSelection;
        std::function<void()> openDetail;
        std::function<void()> reply;
        std::function<void()> deleteMessage;
        std::function<void()> restoreMessage;
        std::function<void()> purgeMessage;
        std::function<void()> sendCompose;
        std::function<bool()> canSendCompose;
        std::function<void()> closeCompose;
        std::function<bool()> goBack;
        std::function<void()> closeFrame;
        std::function<void()> exitFrame;
    };

    static void Bind(
        wxWindow& owner,
        MessagingView& view,
        MessagingNavigationState& navigationState,
        MessagingFocusController& focusController,
        Handlers handlers);
};
}
