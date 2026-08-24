#include "modules/vault/presentation/VaultPanel.h"

#include <optional>
#include <stop_token>
#include <utility>

#include <wx/weakref.h>

#include "modules/vault/application/VaultService.h"
#include "shared/concurrency/application/BackgroundExecutor.h"
#include "shared/errors/catalog/ErrorMessages.h"
#include "shared/text/presentation/encoding/Encoding.h"
#include "shared/ui/presentation/controls/VerticalMenu.h"

namespace lila::modules::vault::presentation
{
void VaultPanel::RequestDeleteConfirmation()
{
    const auto* selected = navigator_.SelectedSnapshot();
    if (selected == nullptr) return;

    using Item = lila::shared::ui::controls::VerticalMenuItem;
    const std::vector<Item> items{
        {"confirm-delete", wxString(L"Oui")},
        {"cancel-delete", wxString(L"Non")}};
    state_ = State::ConfirmDelete;
    menu_->SetItems(items);
    menu_->SetSelectedIndexSilently(0);
    const auto question = wxString(
        L"\u00CAtes-vous s\u00FBr de vouloir supprimer d\u00E9finitivement cette table ?");
    ShowOperationError(question);
    FocusMenuIfVisible();
}

void VaultPanel::CancelDeleteConfirmation()
{
    if (state_ != State::ConfirmDelete) return;
    state_ = State::Ready;
    ShowCurrentPage();
}

void VaultPanel::RestoreSelected()
{
    const auto* selected = navigator_.SelectedSnapshot();
    if (selected == nullptr) return;
    const auto snapshotId = selected->id;
    CancelRequest();
    const auto generation = requestSlot_.CurrentToken();
    state_ = State::Mutating;
    auto* service = &service_;
    wxWeakRef<VaultPanel> weakThis(this);
    requestSlot_.Track(lila::shared::concurrency::RunAsync<int>(
        [service, snapshotId](std::stop_token stopToken)
        {
            return service->Restore(snapshotId, stopToken);
        },
        [weakThis, generation](
            std::optional<lila::shared::errors::AppError> error,
            std::optional<int> roomId) mutable
        {
            if (!weakThis) return;
            weakThis->CallAfter(
                [weakThis, generation, error = std::move(error), roomId]() mutable
                {
                    if (!weakThis || !weakThis->requestSlot_.Complete(generation)) return;
                    weakThis->state_ = State::Ready;
                    if (error || !roomId)
                    {
                        const auto message = error ? error->UserMessage()
                            : std::string(lila::shared::errors::VaultOperationFailed);
                        weakThis->ShowOperationError(lila::shared::text::FromUtf8(message));
                        return;
                    }
                    if (weakThis->onRestoreRequested_)
                        weakThis->onRestoreRequested_(*roomId);
                });
        },
        lila::shared::concurrency::BackgroundTaskPriority::Normal,
        lila::shared::errors::VaultOperationFailed));
}

void VaultPanel::DeleteSelected()
{
    if (state_ != State::ConfirmDelete) return;
    const auto* selected = navigator_.SelectedSnapshot();
    if (selected == nullptr) return;
    const auto snapshotId = selected->id;
    CancelRequest();
    const auto generation = requestSlot_.CurrentToken();
    state_ = State::Mutating;
    auto* service = &service_;
    wxWeakRef<VaultPanel> weakThis(this);
    requestSlot_.Track(lila::shared::concurrency::RunAsync<bool>(
        [service, snapshotId](std::stop_token stopToken)
        {
            service->Delete(snapshotId, stopToken);
            return true;
        },
        [weakThis, generation](
            std::optional<lila::shared::errors::AppError> error,
            std::optional<bool>) mutable
        {
            if (!weakThis) return;
            weakThis->CallAfter(
                [weakThis, generation, error = std::move(error)]() mutable
                {
                    if (!weakThis || !weakThis->requestSlot_.Complete(generation)) return;
                    weakThis->state_ = State::Ready;
                    if (error)
                    {
                        weakThis->ShowCurrentPage();
                        weakThis->ShowOperationError(lila::shared::text::FromUtf8(error->UserMessage()));
                        return;
                    }
                    weakThis->navigator_.RemoveSelected();
                    weakThis->ShowCurrentPage();
                });
        },
        lila::shared::concurrency::BackgroundTaskPriority::Normal,
        lila::shared::errors::VaultOperationFailed));
}
}
