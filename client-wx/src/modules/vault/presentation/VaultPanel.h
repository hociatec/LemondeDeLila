#pragma once

#include <cstddef>
#include <functional>
#include <memory>
#include <string>
#include <vector>

#include "modules/vault/domain/VaultSnapshot.h"
#include "modules/vault/presentation/VaultNavigator.h"
#include "shared/accessibility/application/FocusPlanView.h"
#include "shared/accessibility/presentation/NonFocusablePanel.h"
#include "shared/concurrency/application/AsyncRequestSlot.h"

class wxStaticText;
class wxWindow;
namespace lila::shared::ui::controls { class VerticalMenu; }
namespace lila::modules::vault::application { class VaultService; }

namespace lila::modules::vault::presentation
{
class VaultPanel final : public lila::shared::accessibility::NonFocusablePanel,
                         public lila::shared::accessibility::FocusPlanView
{
public:
    using PreparedHandler = std::function<void()>;
    using RestoreRequestedHandler = std::function<void(int roomId)>;
    using CloseRequestedHandler = std::function<void()>;

    VaultPanel(
        wxWindow* parent,
        application::VaultService& service,
        RestoreRequestedHandler onRestoreRequested,
        CloseRequestedHandler onCloseRequested);
    ~VaultPanel() override;

    void Prepare(PreparedHandler onPrepared);
    void ResetSelectionForNextPrepare();
    [[nodiscard]] lila::shared::accessibility::FocusManager::Plan BuildFocusPlan() override;

private:
    enum class State { Loading, Ready, ConfirmDelete, Mutating, InitialError };

    void BuildLayout();
    void BindEvents();
    void Load(PreparedHandler onPrepared = {});
    void RestoreSelected();
    void RequestDeleteConfirmation();
    void CancelDeleteConfirmation();
    void DeleteSelected();
    void ApplySnapshots(std::vector<domain::VaultSnapshot> snapshots, PreparedHandler onPrepared);
    void ShowCurrentPage();
    void HandleActivation(std::size_t index);
    void HandleEscape();
    void ShowInitialError(const wxString& message, PreparedHandler onPrepared);
    void ShowOperationError(const wxString& message);
    void CancelRequest();
    void FocusMenuIfVisible();

    application::VaultService& service_;
    RestoreRequestedHandler onRestoreRequested_;
    CloseRequestedHandler onCloseRequested_;
    lila::shared::ui::controls::VerticalMenu* menu_ = nullptr;
    wxStaticText* statusLabel_ = nullptr;
    VaultNavigator navigator_;
    lila::shared::concurrency::AsyncRequestSlot requestSlot_;
    State state_ = State::Loading;
    bool resetSelectionOnNextPrepare_ = false;
};
}
