#pragma once

#include <array>
#include <functional>
#include <optional>
#include <string>
#include <vector>

#include <nlohmann/json.hpp>

#include "modules/admin/domain/AdminCommand.h"
#include "shared/accessibility/application/FocusPlanView.h"
#include "shared/accessibility/presentation/NonFocusablePanel.h"
#include "shared/concurrency/application/AsyncRequestSlot.h"
#include "shared/errors/domain/AppError.h"

class wxStaticText;
class wxTextCtrl;
class wxWindow;
class wxString;
namespace lila::shared::ui::controls { class VerticalMenu; }
namespace lila::modules::admin::application { class AdminService; }

namespace lila::modules::admin::presentation
{
class AdminFrame final : public lila::shared::accessibility::NonFocusablePanel,
                         public lila::shared::accessibility::FocusPlanView
{
public:
    using CloseRequestedHandler = std::function<void(std::size_t)>;
    using JoinRoomRequestedHandler = std::function<void(int, bool)>;

    AdminFrame(
        wxWindow* parent,
        application::AdminService& service,
        CloseRequestedHandler onCloseRequested,
        JoinRoomRequestedHandler onJoinRoomRequested,
        std::size_t initialSection = 0);
    ~AdminFrame() override;

    [[nodiscard]] lila::shared::accessibility::FocusManager::Plan BuildFocusPlan() override;

private:
    void BuildLayout();
    void BindEvents();
    void ShowSections();
    void ShowCommands(std::size_t sectionIndex);
    void ActivateCommand(std::size_t commandIndex);
    void ExecuteCommand(const domain::AdminCommand& command, nlohmann::json payload);
    [[nodiscard]] bool ConfirmDangerous(const domain::AdminCommand& command);
    [[nodiscard]] bool PreparePayload(const domain::AdminCommand& command, nlohmann::json& payload);
    [[nodiscard]] bool EnsureMaintenanceToken();
    void CompleteCommand(
        lila::shared::concurrency::AsyncRequestSlot::Token generation,
        const domain::AdminCommand& command,
        std::optional<lila::shared::errors::AppError> error,
        std::optional<nlohmann::json> result);
    void SetStatus(const wxString& message, bool isError = false);
    void ShowResult(const domain::AdminCommand& command, const nlohmann::json& result);
    void ShowResultDetails(std::size_t index);
    void FocusCurrentMenu();
    void FocusResult();
    void FocusResultDetails();
    bool HandleKey(int keyCode);

    application::AdminService& service_;
    CloseRequestedHandler onCloseRequested_;
    JoinRoomRequestedHandler onJoinRoomRequested_;
    lila::shared::ui::controls::VerticalMenu* sectionsMenu_ = nullptr;
    lila::shared::ui::controls::VerticalMenu* commandsMenu_ = nullptr;
    lila::shared::ui::controls::VerticalMenu* resultsMenu_ = nullptr;
    wxStaticText* titleLabel_ = nullptr;
    wxStaticText* resultSummaryLabel_ = nullptr;
    wxStaticText* statusLabel_ = nullptr;
    wxTextCtrl* resultText_ = nullptr;
    std::vector<std::string> resultDetails_;
    std::vector<const domain::AdminCommand*> visibleCommands_;
    std::array<std::size_t, 14> commandSelections_{};
    std::size_t selectedSection_ = 0;
    bool showingCommands_ = false;
    bool loading_ = false;
    std::string maintenanceToken_;
    bool maintenanceTokenInitialized_ = false;
    lila::shared::concurrency::AsyncRequestSlot requestSlot_;
};
}
