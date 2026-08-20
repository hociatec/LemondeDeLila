#include "shared/text/Encoding.h"
#include "modules/messaging/presentation/MessagingFrame.h"
#include "modules/messaging/presentation/MessagingMailboxController.h"
#include "modules/messaging/presentation/MessagingView.h"
#include "modules/messaging/presentation/MessagingPresentationModel.h"

#include <memory>
#include <vector>

#include <wx/listbox.h>
#include <wx/textctrl.h>

#include "shared/text/UiTexts.h"

namespace lila::modules::messaging::presentation
{
void MessagingFrame::RefreshCurrentBox(bool preserveSelection)
{
    LoadBox(navigationState_.currentBox, preserveSelection);
}

void MessagingFrame::OpenSelectedMenu(std::size_t selectedMenuIndex)
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

    navigationState_.SelectBox(*box);
    LoadBox(navigationState_.currentBox, false);
}

void MessagingFrame::OpenDetail()
{
    const auto message = GetSelectedMessage();
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
    navigationState_.screenBeforeCompose = returnScreen;
    view_->recipientCtrl->SetValue(recipient.has_value() ? lila::shared::text::FromUtf8(recipient->username) : wxString());
    view_->subjectCtrl->SetValue(wxEmptyString);
    view_->bodyCtrl->SetValue(wxEmptyString);
    SetScreen(Screen::Compose);
}

void MessagingFrame::CloseCompose()
{
    view_->recipientCtrl->SetValue(wxEmptyString);
    view_->subjectCtrl->SetValue(wxEmptyString);
    view_->bodyCtrl->SetValue(wxEmptyString);
    SetScreen(navigationState_.screenBeforeCompose);
}

void MessagingFrame::LoadBox(domain::MessagingBox box, bool preserveSelection)
{
    if (preserveSelection && box == navigationState_.currentBox)
    {
        SaveCurrentBoxSelection();
    }
    else if (!preserveSelection)
    {
        selectionMemory_.Clear(box);
    }

    auto results = std::make_shared<std::vector<domain::MessagingMessage>>();
    RunBackgroundTask(
        lila::shared::text::FromUtf8(lila::shared::text::ui::MessagingLoadMessagesBusy),
        [this, results, box]()
        {
            *results = mailboxController_->LoadBox(box);
        },
        [this, results, box]()
        {
            navigationState_.currentBox = box;
            boxMessages_ = std::move(*results);
            view_->messagesList->Clear();

            for (const auto& message : boxMessages_)
            {
                view_->messagesList->Append(MessagingPresentationModel::BuildMessageLabel(message));
            }

            view_->listTitleLabel->SetLabel(MessagingPresentationModel::BoxTitle(box));
            const auto restoreIndex = selectionMemory_.ResolveIndex(box, boxMessages_);
            if (restoreIndex.has_value())
            {
                view_->messagesList->SetSelection(static_cast<int>(*restoreIndex));
                selectionMemory_.Store(box, boxMessages_[*restoreIndex].id);
            }

            UpdateStatus(MessagingPresentationModel::BuildLoadStatus(boxMessages_.size()));
            SetScreen(Screen::List);
        });
}

std::optional<domain::MessagingMessage> MessagingFrame::GetSelectedMessage() const
{
    const int selection = view_->messagesList->GetSelection();
    if (selection == wxNOT_FOUND || static_cast<std::size_t>(selection) >= boxMessages_.size())
    {
        return std::nullopt;
    }

    return boxMessages_[static_cast<std::size_t>(selection)];
}

void MessagingFrame::SaveCurrentBoxSelection()
{
    const int selected = view_->messagesList->GetSelection();
    if (selected < 0 || static_cast<std::size_t>(selected) >= boxMessages_.size())
    {
        if (boxMessages_.empty())
        {
            selectionMemory_.Clear(navigationState_.currentBox);
        }
        return;
    }

    selectionMemory_.Store(navigationState_.currentBox, boxMessages_[static_cast<std::size_t>(selected)].id);
}

void MessagingFrame::RestoreCurrentBoxSelection()
{
    const auto index = selectionMemory_.ResolveIndex(navigationState_.currentBox, boxMessages_);
    if (index.has_value())
    {
        view_->messagesList->SetSelection(static_cast<int>(*index));
    }
}
}
