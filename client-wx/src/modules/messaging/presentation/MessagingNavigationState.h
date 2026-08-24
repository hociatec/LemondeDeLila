#pragma once

#include <cstddef>

#include "modules/messaging/domain/MessagingBox.h"
#include "shared/ui/presentation/navigation/NavigationStack.h"

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

    struct Snapshot final
    {
        Screen currentScreen;
        domain::MessagingBox currentBox;
        std::size_t lastMenuIndex;
    };

    void Enter(Screen screen) noexcept
    {
        currentScreen = screen;
    }

    void PushCurrent()
    {
        navigationHistory_.Push(Capture());
    }

    void SelectBox(domain::MessagingBox box) noexcept
    {
        currentBox = box;
    }

    [[nodiscard]] bool CanGoBack() const noexcept
    {
        return !navigationHistory_.Empty();
    }

    [[nodiscard]] bool GoBack(bool preserveCurrentBox = false) noexcept
    {
        if (navigationHistory_.Empty())
        {
            return false;
        }

        const domain::MessagingBox activeBox = currentBox;
        Restore(navigationHistory_.Pop());
        if (preserveCurrentBox)
        {
            currentBox = activeBox;
        }

        return true;
    }

    [[nodiscard]] Snapshot Capture() const noexcept
    {
        return Snapshot{currentScreen, currentBox, lastMenuIndex};
    }

    Screen currentScreen = Screen::Menu;
    domain::MessagingBox currentBox = domain::MessagingBox::Inbox;
    std::size_t lastMenuIndex = 0;

private:
    void Restore(const Snapshot& snapshot) noexcept
    {
        currentScreen = snapshot.currentScreen;
        currentBox = snapshot.currentBox;
        lastMenuIndex = snapshot.lastMenuIndex;
    }

    lila::shared::ui::navigation::NavigationStack<Snapshot> navigationHistory_;
};
}
