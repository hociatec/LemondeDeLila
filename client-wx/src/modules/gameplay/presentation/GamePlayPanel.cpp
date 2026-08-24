#include "modules/gameplay/presentation/GamePlayPanel.h"

#include <utility>

#include <wx/listbox.h>
#include <wx/textctrl.h>

#include "modules/gameplay/application/GameSessionService.h"
#include "modules/gameplay/presentation/confirmation/GameActionConfirmationPanel.h"
#include "modules/gameplay/presentation/hand/GameHandPanel.h"
#include "modules/gameplay/presentation/prompt/GamePromptPanel.h"

namespace lila::modules::gameplay::presentation
{
GamePlayPanel::GamePlayPanel(
    wxWindow* parent,
    application::GameSessionService& service)
    : wxPanel(parent, wxID_ANY, wxDefaultPosition, wxDefaultSize, wxWANTS_CHARS),
      service_(service)
{
    BuildLayout();
    BindEvents();
}

GamePlayPanel::~GamePlayPanel()
{
    CloseSession();
}

void GamePlayPanel::Open(int roomId, std::string gameType, std::string gameName)
{
    if (roomId <= 0 || gameType.empty()) return;
    if (IsOpenFor(roomId, gameType)) return;
    CloseSession();
    AttachEventHandler();
    roomId_ = roomId;
    gameType_ = std::move(gameType);
    gameName_ = std::move(gameName);
    ClearView();
    StartJoin();
}

void GamePlayPanel::CloseSession()
{
    requestSlot_.Cancel();
    service_.ClearEventHandler();
    service_.Close();
    roomId_ = 0;
    gameType_.clear();
    gameName_.clear();
    state_ = {};
    ClearView();
}

bool GamePlayPanel::IsOpenFor(int roomId, const std::string& gameType) const
{
    return roomId_ == roomId && gameType_ == gameType;
}

void GamePlayPanel::AppendTabTargets(
    lila::shared::accessibility::NavigationController::Scope& scope) const
{
    if (IsConfirmationVisible())
    {
        for (auto* control : confirmationPanel_->TabTargets()) scope.Add(control);
        return;
    }
    if (IsInlinePromptVisible())
    {
        for (auto* control : promptPanel_->TabTargets()) scope.Add(control);
        return;
    }

    if (handPanel_ != nullptr && handPanel_->IsShown()) scope.Add(handPanel_->List());
    scope.Add(linesList_);
    scope.Add(infoText_);
    scope.Add(logText_);
}
}
