#pragma once

#include <functional>
#include <memory>
#include <optional>
#include <vector>

#include <wx/string.h>

#include "modules/messaging/domain/MessagingBox.h"
#include "modules/messaging/domain/MessagingMessage.h"
#include "modules/messaging/domain/MessagingUser.h"
#include "modules/messaging/presentation/MessagingMailboxLoader.h"
#include "modules/messaging/presentation/MessagingNavigationState.h"

namespace lila::modules::messaging::presentation
{
class MessagingMailboxController;
class MessagingSelectionMemory;
class MessagingView;

class MessagingScreenCoordinator final
{
public:
    using Screen = MessagingNavigationState::Screen;

    struct Callbacks final
    {
        std::function<void(const wxString&, const std::function<void()>&, const std::function<void()>&)> runBackgroundTask;
        std::function<void(const wxString&, bool)> updateStatus;
        std::function<void(Screen)> setScreen;
        std::function<void()> focusCurrentScreen;
    };

    MessagingScreenCoordinator(
        MessagingMailboxController& mailboxController,
        MessagingNavigationState& navigationState,
        MessagingSelectionMemory& selectionMemory,
        std::vector<domain::MessagingMessage>& boxMessages,
        MessagingView& view,
        Callbacks callbacks) noexcept;
    void OpenSelectedMenu(std::size_t selectedMenuIndex);
    void RefreshCurrentBox(bool preserveSelection);
    void OpenDetail();
    void OpenCompose(std::optional<domain::MessagingUser> recipient, Screen returnScreen);
    void CloseCompose(bool preserveCurrentBox = false);
    void LoadBox(domain::MessagingBox box, bool preserveSelection = false);
    void SaveCurrentBoxSelection() const;
    void RestoreCurrentBoxSelection() const;
    [[nodiscard]] std::optional<domain::MessagingMessage> GetSelectedMessage() const;

private:
    MessagingMailboxController& mailboxController_;
    MessagingNavigationState& navigationState_;
    MessagingSelectionMemory& selectionMemory_;
    std::vector<domain::MessagingMessage>& boxMessages_;
    MessagingView& view_;
    std::unique_ptr<MessagingMailboxLoader> mailboxLoader_;
    Callbacks callbacks_;
};
}
