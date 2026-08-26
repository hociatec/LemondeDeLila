#include "modules/rooms/presentation/shell/RoomPanel.h"

#include <wx/msgdlg.h>

#include "modules/rooms/presentation/zone/RoomGameZoneAnchor.h"
#include "shared/accessibility/application/NavigationController.h"

namespace lila::modules::rooms::presentation
{
void RoomPanel::RequestLeaveConfirmation()
{
    const auto message = request_.kind == RoomOpenRequest::Kind::Restore
        ? wxString(L"Voulez-vous quitter la table restaur\u00E9e et supprimer sa sauvegarde du coffre fort ?")
        : wxString(L"Voulez-vous quitter la table et revenir au menu pr\u00E9c\u00E9dent ?");
    const int answer = wxMessageBox(
        message,
        wxString(L"Quitter la table"),
        wxYES_NO | wxICON_QUESTION,
        this);
    if (answer == wxYES)
    {
        Leave();
        return;
    }
    UpdateStatus(wxString(L"Retour annul\u00E9."));
}

void RoomPanel::RequestResetConfirmation()
{
    const bool started = room_.started || room_.status == "started";
    const auto message = started
        ? wxString(L"\u00CAtes-vous s\u00FBr d'arr\u00EAter la partie en cours ?")
        : wxString(L"\u00CAtes-vous s\u00FBr de r\u00E9initialiser cette table ?");
    const int answer = wxMessageBox(
        message,
        wxString(L"R\u00E9initialiser la table"),
        wxYES_NO | wxNO_DEFAULT | wxICON_QUESTION,
        this);
    if (answer == wxYES)
    {
        ExecuteCommand({domain::RoomCommand::Reset, false, {}});
        return;
    }
    UpdateStatus(wxString(L"R\u00E9initialisation annul\u00E9e."), false, true);
    static_cast<void>(
        lila::shared::accessibility::NavigationController::Focus(gameZoneAnchor_));
}
}
