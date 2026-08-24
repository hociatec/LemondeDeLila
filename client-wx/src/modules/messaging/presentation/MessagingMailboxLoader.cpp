#include "modules/messaging/presentation/MessagingMailboxLoader.h"

#include <memory>
#include <utility>

#include <wx/listbox.h>

#include "modules/messaging/presentation/MessagingMailboxController.h"
#include "modules/messaging/presentation/MessagingPresentationModel.h"
#include "modules/messaging/presentation/MessagingSelectionMemory.h"
#include "modules/messaging/presentation/MessagingView.h"
#include "shared/text/presentation/encoding/Encoding.h"
#include "shared/text/presentation/catalog/UiTexts.h"

namespace lila::modules::messaging::presentation
{
MessagingMailboxLoader::MessagingMailboxLoader(
    MessagingMailboxController& mailboxController,
    MessagingSelectionMemory& selectionMemory,
    std::vector<domain::MessagingMessage>& boxMessages,
    MessagingView& view,
    Callbacks callbacks) noexcept
    : mailboxController_(mailboxController),
      selectionMemory_(selectionMemory),
      boxMessages_(boxMessages),
      view_(view),
      callbacks_(std::move(callbacks))
{
}

void MessagingMailboxLoader::LoadBox(domain::MessagingBox box, bool preserveSelection, domain::MessagingBox currentBox)
{
    if (preserveSelection && box == currentBox)
    {
        SaveSelection(currentBox);
    }
    else if (!preserveSelection)
    {
        selectionMemory_.Clear(box);
    }

    auto results = std::make_shared<std::vector<domain::MessagingMessage>>();
    callbacks_.runBackgroundTask(
        lila::shared::text::FromUtf8(lila::shared::text::ui::MessagingLoadMessagesBusy),
        [this, results, box]()
        {
            *results = mailboxController_.LoadBox(box);
        },
        [this, results, box]()
        {
            const auto list = view_.List();
            boxMessages_ = std::move(*results);
            list.messagesList->Clear();

            for (const auto& message : boxMessages_)
            {
                list.messagesList->Append(MessagingPresentationModel::BuildMessageLabel(message));
            }

            list.listTitleLabel->SetLabel(MessagingPresentationModel::BoxTitle(box));
            const auto restoreIndex = selectionMemory_.ResolveIndex(box, boxMessages_);
            if (restoreIndex.has_value())
            {
                list.messagesList->SetSelection(static_cast<int>(*restoreIndex));
                selectionMemory_.Store(box, boxMessages_[*restoreIndex].id);
            }

            callbacks_.updateStatus(MessagingPresentationModel::BuildLoadStatus(boxMessages_.size()), false);
            callbacks_.showListScreen();
        });
}

void MessagingMailboxLoader::SaveSelection(domain::MessagingBox box) const
{
    const int selected = view_.List().messagesList->GetSelection();
    if (selected < 0 || static_cast<std::size_t>(selected) >= boxMessages_.size())
    {
        if (boxMessages_.empty())
        {
            selectionMemory_.Clear(box);
        }
        return;
    }

    selectionMemory_.Store(box, boxMessages_[static_cast<std::size_t>(selected)].id);
}

void MessagingMailboxLoader::RestoreSelection(domain::MessagingBox box) const
{
    const auto index = selectionMemory_.ResolveIndex(box, boxMessages_);
    if (index.has_value())
    {
        view_.List().messagesList->SetSelection(static_cast<int>(*index));
    }
}
}
