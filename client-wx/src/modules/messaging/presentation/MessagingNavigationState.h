#pragma once

#include <cstddef>

#include "modules/messaging/domain/MessagingBox.h"

namespace lila::modules::messaging::presentation
{
class MessagingNavigationState final
{
public:
    enum class Screen
    {
        Menu,
        List,
        Detail,
        Compose,
    };

    void Enter(Screen screen) noexcept
    {
        currentScreen = screen;
    }

    void BeginCompose(Screen returnScreen) noexcept
    {
        screenBeforeCompose = returnScreen;
        currentScreen = Screen::Compose;
    }

    void SelectBox(domain::MessagingBox box) noexcept
    {
        currentBox = box;
    }

    Screen currentScreen = Screen::Menu;
    Screen screenBeforeCompose = Screen::Menu;
    domain::MessagingBox currentBox = domain::MessagingBox::Inbox;
    std::size_t lastMenuIndex = 0;
};
}
