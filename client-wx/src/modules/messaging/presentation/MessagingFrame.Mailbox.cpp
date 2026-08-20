#include "modules/messaging/presentation/MessagingFrame.h"
#include "modules/messaging/presentation/MessagingPresentationModel.h"
#include "modules/messaging/presentation/MessagingScreenCoordinator.h"
#include "modules/messaging/presentation/MessagingView.h"

namespace lila::modules::messaging::presentation
{
void MessagingFrame::RefreshCurrentBox(bool preserveSelection)
{
    screenCoordinator_->RefreshCurrentBox(preserveSelection);
}

void MessagingFrame::OpenSelectedMenu(std::size_t selectedMenuIndex)
{
    screenCoordinator_->OpenSelectedMenu(selectedMenuIndex);
}

void MessagingFrame::OpenDetail()
{
    const auto message = screenCoordinator_->GetSelectedMessage();
    if (!message.has_value())
    {
        return;
    }

    SetScreen(Screen::Detail);
    if (!message->isSent)
    {
        MarkSelectedMessageRead();
    }
}

void MessagingFrame::OpenCompose(std::optional<domain::MessagingUser> recipient, Screen returnScreen)
{
    screenCoordinator_->OpenCompose(std::move(recipient), returnScreen);
}

void MessagingFrame::CloseCompose(bool preserveCurrentBox)
{
    screenCoordinator_->CloseCompose(preserveCurrentBox);
}

void MessagingFrame::LoadBox(domain::MessagingBox box, bool preserveSelection)
{
    screenCoordinator_->LoadBox(box, preserveSelection);
}

std::optional<domain::MessagingMessage> MessagingFrame::GetSelectedMessage() const
{
    return screenCoordinator_->GetSelectedMessage();
}

void MessagingFrame::SaveCurrentBoxSelection()
{
    screenCoordinator_->SaveCurrentBoxSelection();
}

void MessagingFrame::RestoreCurrentBoxSelection()
{
    screenCoordinator_->RestoreCurrentBoxSelection();
}
}
