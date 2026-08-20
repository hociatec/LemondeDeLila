#pragma once

#include <functional>
#include <vector>

#include <wx/string.h>

#include "modules/messaging/domain/MessagingBox.h"
#include "modules/messaging/domain/MessagingMessage.h"

namespace lila::modules::messaging::presentation
{
class MessagingMailboxController;
class MessagingSelectionMemory;
class MessagingView;

class MessagingMailboxLoader final
{
public:
    struct Callbacks final
    {
        std::function<void(const wxString&, const std::function<void()>&, const std::function<void()>&)> runBackgroundTask;
        std::function<void(const wxString&, bool)> updateStatus;
        std::function<void()> showListScreen;
    };

    MessagingMailboxLoader(
        MessagingMailboxController& mailboxController,
        MessagingSelectionMemory& selectionMemory,
        std::vector<domain::MessagingMessage>& boxMessages,
        MessagingView& view,
        Callbacks callbacks) noexcept;

    void LoadBox(domain::MessagingBox box, bool preserveSelection, domain::MessagingBox currentBox);
    void SaveSelection(domain::MessagingBox box) const;
    void RestoreSelection(domain::MessagingBox box) const;

private:
    MessagingMailboxController& mailboxController_;
    MessagingSelectionMemory& selectionMemory_;
    std::vector<domain::MessagingMessage>& boxMessages_;
    MessagingView& view_;
    Callbacks callbacks_;
};
}
