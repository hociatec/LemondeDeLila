#include "shared/text/presentation/encoding/Encoding.h"
#include "modules/messaging/presentation/MessagingScreenCoordinator.h"

#include <optional>
#include <utility>

#include <wx/listbox.h>

#include "modules/messaging/presentation/MessagingMailboxController.h"
#include "modules/messaging/presentation/MessagingSelectionMemory.h"
#include "modules/messaging/presentation/MessagingView.h"

namespace lila::modules::messaging::presentation
{
MessagingScreenCoordinator::MessagingScreenCoordinator(
    MessagingMailboxController& mailboxController,
    MessagingNavigationState& navigationState,
    MessagingSelectionMemory& selectionMemory,
    std::vector<domain::MessagingMessage>& boxMessages,
    MessagingView& view,
    Callbacks callbacks) noexcept
    : mailboxController_(mailboxController),
      navigationState_(navigationState),
      selectionMemory_(selectionMemory),
      boxMessages_(boxMessages),
      view_(view),
      callbacks_(std::move(callbacks))
{
    mailboxLoader_ = std::make_unique<MessagingMailboxLoader>(
        mailboxController_,
        selectionMemory_,
        boxMessages_,
        view_,
        MessagingMailboxLoader::Callbacks{
            callbacks_.runBackgroundTask,
            callbacks_.updateStatus,
            [this]()
            {
                callbacks_.setScreen(Screen::List);
            }});
}

void MessagingScreenCoordinator::OpenSelectedMenu(std::size_t selectedMenuIndex)
{
    navigationState_.lastMenuIndex = selectedMenuIndex;
    if (selectedMenuIndex == 0)
    {
        OpenCompose(std::nullopt, Screen::Menu);
        return;
    }

    const auto box = domain::MessagingBoxFromMenuIndex(selectedMenuIndex);
    if (!box.has_value())
    {
        return;
    }

    navigationState_.PushCurrent();
    navigationState_.SelectBox(*box);
    LoadBox(navigationState_.currentBox, false);
}

void MessagingScreenCoordinator::RefreshCurrentBox(bool preserveSelection)
{
    LoadBox(navigationState_.currentBox, preserveSelection);
}

void MessagingScreenCoordinator::OpenDetail()
{
    if (!GetSelectedMessage().has_value())
    {
        return;
    }

    navigationState_.PushCurrent();
    callbacks_.setScreen(Screen::Detail);
}

void MessagingScreenCoordinator::OpenCompose(std::optional<domain::MessagingUser> recipient, Screen returnScreen)
{
    static_cast<void>(returnScreen);
    const auto compose = view_.Compose();
    navigationState_.PushCurrent();
    compose.recipientCtrl->SetValue(recipient.has_value() ? lila::shared::text::FromUtf8(recipient->username) : wxString());
    compose.subjectCtrl->SetValue(wxEmptyString);
    compose.bodyCtrl->SetValue(wxEmptyString);
    callbacks_.setScreen(Screen::Compose);
}

void MessagingScreenCoordinator::CloseCompose(bool preserveCurrentBox)
{
    const auto compose = view_.Compose();
    compose.recipientCtrl->SetValue(wxEmptyString);
    compose.subjectCtrl->SetValue(wxEmptyString);
    compose.bodyCtrl->SetValue(wxEmptyString);
    if (navigationState_.GoBack(preserveCurrentBox))
    {
        callbacks_.setScreen(navigationState_.currentScreen);
        return;
    }

    callbacks_.setScreen(Screen::Menu);
}

void MessagingScreenCoordinator::LoadBox(domain::MessagingBox box, bool preserveSelection)
{
    mailboxLoader_->LoadBox(box, preserveSelection, navigationState_.currentBox);
    navigationState_.currentBox = box;
}

void MessagingScreenCoordinator::SaveCurrentBoxSelection() const
{
    mailboxLoader_->SaveSelection(navigationState_.currentBox);
}

void MessagingScreenCoordinator::RestoreCurrentBoxSelection() const
{
    mailboxLoader_->RestoreSelection(navigationState_.currentBox);
}

std::optional<domain::MessagingMessage> MessagingScreenCoordinator::GetSelectedMessage() const
{
    const int selection = view_.List().messagesList->GetSelection();
    if (selection == wxNOT_FOUND || static_cast<std::size_t>(selection) >= boxMessages_.size())
    {
        return std::nullopt;
    }

    return boxMessages_[static_cast<std::size_t>(selection)];
}
}
