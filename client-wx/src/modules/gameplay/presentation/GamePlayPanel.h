#pragma once

#include <cstddef>
#include <optional>
#include <string>
#include <vector>

#include <wx/panel.h>
#include <wx/weakref.h>

#include "modules/gameplay/domain/GameAction.h"
#include "modules/gameplay/domain/GameEvent.h"
#include "modules/gameplay/domain/GameState.h"
#include "shared/concurrency/application/AsyncRequestSlot.h"

class wxKeyEvent;
class wxListBox;
class wxStaticText;
class wxTextCtrl;

namespace lila::modules::gameplay::application
{
class GameSessionService;
}

namespace lila::modules::gameplay::presentation
{
class GamePlayPanel final : public wxPanel
{
public:
    explicit GamePlayPanel(
        wxWindow* parent,
        application::GameSessionService& service);
    ~GamePlayPanel() override;

    void Open(int roomId, std::string gameType, std::string gameName);
    void CloseSession();
    [[nodiscard]] bool IsOpenFor(int roomId, const std::string& gameType) const;

private:
    void BuildLayout();
    void BindEvents();
    void AttachEventHandler();
    void StartJoin();
    void ExecuteAction(domain::GameAction action);
    void RequestRefresh();
    void ApplyState(domain::GameState state);
    void HandleEvent(domain::GameEvent event);
    void HandleKey(wxKeyEvent& event);
    void ActivateSelectedLine();
    bool HandleShortcut(const std::string& normalizedKey);
    bool HandleInterfaceShortcut(const std::string& id);
    std::optional<domain::GameAction> ResolveShortcutAction(const std::string& actionType) const;
    void UpdateInfoPanel();
    void UpdateStatus(const wxString& message, bool isError = false, bool announce = false);
    void AppendLogMessages(const std::vector<std::string>& messages);
    void ClearView();
    void RebuildLines();
    [[nodiscard]] std::string NormalizeKey(const wxKeyEvent& event) const;
    [[nodiscard]] wxString BuildShortcutText() const;
    [[nodiscard]] wxString BuildHeaderText() const;
    [[nodiscard]] wxString BuildLineDetail() const;
    [[nodiscard]] wxString BuildInfoText(const std::string& panelId) const;

    application::GameSessionService& service_;
    wxStaticText* headerLabel_ = nullptr;
    wxListBox* linesList_ = nullptr;
    wxTextCtrl* infoText_ = nullptr;
    wxTextCtrl* logText_ = nullptr;
    wxStaticText* shortcutsLabel_ = nullptr;
    wxStaticText* statusLabel_ = nullptr;
    domain::GameState state_;
    int roomId_ = 0;
    std::string gameType_;
    std::string gameName_;
    std::string activeInfoPanel_ = "details";
    lila::shared::concurrency::AsyncRequestSlot requestSlot_;
};
}
