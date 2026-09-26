#pragma once

#include <array>
#include <functional>
#include <memory>
#include <optional>
#include <string>
#include <string_view>
#include <vector>

#include <nlohmann/json.hpp>

#include "modules/admin/domain/AdminCommand.h"
#include "modules/admin/domain/AdminArea.h"
#include "shared/accessibility/application/FocusPlanView.h"
#include "shared/accessibility/presentation/NonFocusablePanel.h"
#include "shared/concurrency/application/AsyncRequestSlot.h"
#include "shared/errors/domain/AppError.h"

class wxStaticText;
class wxTextCtrl;
class wxWindow;
class wxString;
class wxButton;
class wxChoice;
class wxPanel;
namespace lila::shared::ui::controls { class VerticalMenu; }
namespace lila::modules::admin::application { class AdminService; }
namespace lila::modules::audio::application { class IAudioService; }

namespace lila::modules::admin::presentation
{
class AdminFrame final : public lila::shared::accessibility::NonFocusablePanel,
                         public lila::shared::accessibility::FocusPlanView
{
public:
    using CloseRequestedHandler = std::function<void(std::size_t)>;
    using JoinRoomRequestedHandler = std::function<void(int, bool)>;
    using OpenStoryBookRequestedHandler = std::function<void(int, std::string)>;

    AdminFrame(
        wxWindow* parent,
        application::AdminService& service,
        lila::modules::audio::application::IAudioService& audioService,
        CloseRequestedHandler onCloseRequested,
        JoinRoomRequestedHandler onJoinRoomRequested,
        OpenStoryBookRequestedHandler onOpenStoryBookRequested,
        std::size_t initialSection = 0);
    ~AdminFrame() override;

    [[nodiscard]] lila::shared::accessibility::FocusManager::Plan BuildFocusPlan() override;

private:
    void BuildLayout();
    void BindEvents();
    void ShowSections();
    void ShowCommands(std::size_t sectionIndex);
    void LoadAutomaticAreaContent();
    void ActivateCommand(std::size_t commandIndex);
    void ExecuteCommand(
        const domain::AdminCommand& command,
        nlohmann::json payload,
        bool announceLifecycle = true);
    [[nodiscard]] bool LoadBotTimingSettingsBeforeEditing(
        const domain::AdminCommand& command);
    void CacheBotTimingSettings(const nlohmann::json& result);
    [[nodiscard]] bool ResumeBotTimingEditorIfNeeded(const domain::AdminCommand& command);
    [[nodiscard]] bool ConfirmDangerous(const domain::AdminCommand& command);
    [[nodiscard]] bool PreparePayload(const domain::AdminCommand& command, nlohmann::json& payload);
    [[nodiscard]] bool EnsureMaintenanceToken();
    void CompleteCommand(
        lila::shared::concurrency::AsyncRequestSlot::Token generation,
        const domain::AdminCommand& command,
        bool announceLifecycle,
        std::optional<lila::shared::errors::AppError> error,
        std::optional<nlohmann::json> result);
    void SetStatus(const wxString& message, bool isError = false);
    void ShowResult(const domain::AdminCommand& command, const nlohmann::json& result);
    void ShowResultDetails(std::size_t index);
    void OpenResultActions(std::size_t index);
    void RestoreAreaFromItem();
    void ApplyContextToPayload(const domain::AdminCommand& command, nlohmann::json& payload) const;
    [[nodiscard]] bool ContextCommandMutates(const domain::AdminCommand& command) const;
    void SearchBugReports();
    void CreateBugReport();
    void ChangeBugReportFilter();
    void ConsultSelectedBugReport();
    void EditSelectedBugReport();
    void ChangeSelectedBugReportStatus();
    void DeleteSelectedBugReport();
    void RefreshBugReports(
        bool keepCurrentFocus = false,
        bool announceLifecycle = true);
    void UpdateBugReportActions();
    void FocusCurrentMenu();
    void FocusResult();
    void FocusResultDetails();
    void FocusPagination();
    void ResetPagination(const domain::AdminCommand& command, const nlohmann::json& payload);
    void UpdatePagination(const nlohmann::json& result, std::size_t displayedCount);
    void ChangePage(int direction);
    void ChangePageSize();
    void PreviewSound(std::string_view soundId);
    bool ConfirmSoundChange(const domain::AdminCommand& command);
    bool HandleKey(int keyCode);

    application::AdminService& service_;
    lila::modules::audio::application::IAudioService& audioService_;
    CloseRequestedHandler onCloseRequested_;
    JoinRoomRequestedHandler onJoinRoomRequested_;
    OpenStoryBookRequestedHandler onOpenStoryBookRequested_;
    lila::shared::ui::controls::VerticalMenu* sectionsMenu_ = nullptr;
    lila::shared::ui::controls::VerticalMenu* commandsMenu_ = nullptr;
    lila::shared::ui::controls::VerticalMenu* resultsMenu_ = nullptr;
    wxStaticText* titleLabel_ = nullptr;
    wxStaticText* resultSummaryLabel_ = nullptr;
    wxStaticText* statusLabel_ = nullptr;
    wxTextCtrl* resultText_ = nullptr;
    wxPanel* reportSearchPanel_ = nullptr;
    lila::shared::ui::controls::VerticalMenu* reportStatusMenu_ = nullptr;
    wxTextCtrl* reportSearchCtrl_ = nullptr;
    wxButton* reportSearchButton_ = nullptr;
    wxPanel* reportActionsPanel_ = nullptr;
    wxButton* editReportButton_ = nullptr;
    wxButton* changeReportStatusButton_ = nullptr;
    wxButton* deleteReportButton_ = nullptr;
    wxPanel* paginationPanel_ = nullptr;
    wxStaticText* paginationLabel_ = nullptr;
    wxButton* previousPageButton_ = nullptr;
    wxButton* nextPageButton_ = nullptr;
    wxChoice* pageSizeChoice_ = nullptr;
    std::vector<std::string> resultDetails_;
    std::vector<nlohmann::json> resultItems_;
    std::vector<const domain::AdminCommand*> visibleCommands_;
    std::vector<nlohmann::json> contextActionPayloads_;
    std::vector<bool> contextActionDirect_;
    std::array<std::size_t, 16> commandSelections_{};
    std::size_t selectedSection_ = 0;
    bool showingCommands_ = false;
    bool loading_ = false;
    std::string maintenanceToken_;
    bool maintenanceTokenInitialized_ = false;
    const domain::AdminCommand* paginationCommand_ = nullptr;
    nlohmann::json paginationPayload_ = nlohmann::json::object();
    nlohmann::json bugReportListPayload_ = nlohmann::json::object();
    nlohmann::json botTimingPayload_ = nlohmann::json::object();
    bool openBotTimingEditorAfterRead_ = false;
    bool loadingReportCountsOnly_ = false;
    std::vector<int> pageSizeChoices_;
    std::optional<std::size_t> selectedResultIndex_;
    std::optional<std::string> reportIdToRestore_;
    std::optional<std::string> soundIdToRestore_;
    std::optional<std::string> pendingAmbienceUploadPath_;
    bool ambiencePreviewPlaying_ = false;
    bool ambiencePreviewPaused_ = false;
    bool uploadingCreatedAmbience_ = false;
    bool refreshBugReportsAfterCommand_ = false;
    bool refreshAreaAfterCommand_ = false;
    bool keepFocusAfterCommand_ = false;
    bool showingItemActions_ = false;
    domain::AdminItemKind currentResultItemKind_ = domain::AdminItemKind::None;
    nlohmann::json contextItem_ = nlohmann::json::object();
    lila::shared::concurrency::AsyncRequestSlot requestSlot_;
};
}
