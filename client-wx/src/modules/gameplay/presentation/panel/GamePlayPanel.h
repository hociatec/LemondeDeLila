#pragma once

#include <cstddef>
#include <functional>
#include <optional>
#include <string>
#include <vector>

#include <wx/panel.h>
#include <wx/weakref.h>

#include "modules/gameplay/domain/GameAction.h"
#include "modules/gameplay/domain/GameEvent.h"
#include "modules/gameplay/domain/GameState.h"
#include "modules/gameplay/presentation/history/GameLogCursor.h"
#include "shared/concurrency/application/AsyncRequestSlot.h"

class wxKeyEvent;
class wxListBox;
class wxScrolledWindow;
class wxStaticText;
class wxTextCtrl;

namespace lila::modules::gameplay::application
{
class GameSessionService;
}

namespace lila::modules::gameplay::presentation::confirmation { class GameActionConfirmationPanel; }
namespace lila::modules::gameplay::presentation::hand { class GameHandPanel; }
namespace lila::modules::gameplay::presentation::prompt { class GamePromptPanel; }

namespace lila::modules::gameplay::presentation
{
class GamePlayPanel final : public wxPanel
{
public:
    using ZoneFocusRequestedHandler = std::function<void()>;
    using HistoryMessageHandler = std::function<void(const wxString&)>;
    using TableShortcutHandler = std::function<bool(wxKeyEvent&)>;

    explicit GamePlayPanel(
        wxWindow* parent,
        application::GameSessionService& service);
    ~GamePlayPanel() override;

    void Open(int roomId, std::string gameType, std::string gameName);
    void CloseSession();
    [[nodiscard]] bool IsOpenFor(int roomId, const std::string& gameType) const;
    [[nodiscard]] bool IsOpen() const noexcept;
    [[nodiscard]] bool IsFinished() const noexcept;
    void SetZoneFocusRequestedHandler(ZoneFocusRequestedHandler handler);
    void SetHistoryMessageHandler(HistoryMessageHandler handler);
    void SetTableShortcutHandler(TableShortcutHandler handler);
    bool ActivateFromZone();
    bool HandleZoneKey(wxKeyEvent& event);

private:
    void BuildLayout();
    void BindEvents();
    void AttachEventHandler();
    void StartJoin();
    void PrepareAndExecuteAction(domain::GameAction action);
    void ExecuteAction(domain::GameAction action);
    void RequestRefresh();
    void RequestTurn();
    void SendKey(std::string key);
    void ApplyState(domain::GameState state);
    void HandleEvent(domain::GameEvent event);
    void HandleKey(wxKeyEvent& event);
    void ActivateSelectedLine();
    bool ActivateSelectedHandCard();
    void SyncInlinePrompt();
    void ShowInlinePrompt(domain::GameAction action);
    [[nodiscard]] bool IsInlinePromptVisible() const;
    [[nodiscard]] bool IsConfirmationVisible() const;
    bool HandleShortcut(const std::string& normalizedKey);
    bool HandleInterfaceShortcut(const std::string& id);
    std::optional<domain::GameAction> ResolveShortcutAction(const std::string& actionType) const;
    void UpdateInfoPanel();
    void UpdateStatus(const wxString& message, bool isError = false, bool announce = false);
    void PublishLogMessages(const std::vector<std::string>& messages);
    void ClearView();
    void RebuildLines();
    [[nodiscard]] std::string NormalizeKey(const wxKeyEvent& event) const;
    [[nodiscard]] wxString BuildShortcutText() const;
    [[nodiscard]] wxString BuildHeaderText() const;
    [[nodiscard]] wxString BuildLineDetail() const;
    [[nodiscard]] wxString BuildInfoText(const std::string& panelId) const;

    application::GameSessionService& service_;
    wxStaticText* headerLabel_ = nullptr;
    wxScrolledWindow* contentPanel_ = nullptr;
    hand::GameHandPanel* handPanel_ = nullptr;
    wxStaticText* actionsLabel_ = nullptr;
    wxListBox* linesList_ = nullptr;
    wxTextCtrl* infoText_ = nullptr;
    wxStaticText* shortcutsLabel_ = nullptr;
    wxStaticText* statusLabel_ = nullptr;
    confirmation::GameActionConfirmationPanel* confirmationPanel_ = nullptr;
    prompt::GamePromptPanel* promptPanel_ = nullptr;
    domain::GameState state_;
    int roomId_ = 0;
    std::string gameType_;
    std::string gameName_;
    std::string activeInfoPanel_ = "details";
    std::string dismissedPromptActionType_;
    history::GameLogCursor logCursor_;
    ZoneFocusRequestedHandler onZoneFocusRequested_;
    HistoryMessageHandler onHistoryMessage_;
    TableShortcutHandler onTableShortcut_;
    lila::shared::concurrency::AsyncRequestSlot requestSlot_;
};
}
