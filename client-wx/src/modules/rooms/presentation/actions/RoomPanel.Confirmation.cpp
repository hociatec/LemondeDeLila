#include "modules/rooms/presentation/shell/RoomPanel.h"

#include <wx/msgdlg.h>

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
}
