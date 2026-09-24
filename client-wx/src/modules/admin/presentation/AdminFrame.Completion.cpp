#include "modules/admin/presentation/AdminFrame.h"

#include <utility>
#include <memory>
#include <nlohmann/json.hpp>
#include <wx/msgdlg.h>
#include <wx/textctrl.h>
#include <wx/textdlg.h>
#include <wx/weakref.h>
#include "modules/admin/application/AdminService.h"
#include "modules/audio/application/IAudioService.h"
#include "modules/admin/domain/AdminPagination.h"
#include "shared/concurrency/application/BackgroundExecutor.h"
#include "shared/security/infrastructure/SecurityUtils.h"
#include "shared/security/domain/SensitiveString.h"
#include "shared/text/presentation/encoding/Encoding.h"

namespace lila::modules::admin::presentation
{
void AdminFrame::CompleteCommand(
    lila::shared::concurrency::AsyncRequestSlot::Token generation,
    const domain::AdminCommand& command,
    bool announceLifecycle,
    std::optional<lila::shared::errors::AppError> error,
    std::optional<nlohmann::json> result)
{
    if (!requestSlot_.Complete(generation)) return;
    loading_ = false;
    if (error.has_value() || !result.has_value())
    {
        if (command.id == "bots.settings.get")
            openBotTimingEditorAfterRead_ = false;
        loadingReportCountsOnly_ = false;
        keepFocusAfterCommand_ = false;
        refreshBugReportsAfterCommand_ = false;
        refreshAreaAfterCommand_ = false;
        reportIdToRestore_.reset();
        SetStatus(lila::shared::text::FromUtf8(
            error ? error->UserMessage() : "Réponse administrateur absente."), true);
        if (command.id.starts_with("sounds."))
        {
            soundIdToRestore_.reset();
            wxMessageBox(lila::shared::text::FromUtf8(
                error ? error->UserMessage() : "Réponse administrateur absente."),
                L"Gestion des sons", wxOK | wxICON_ERROR, this);
        }
        FocusCurrentMenu();
        return;
    }
    if (command.id == "contacts.reply")
        audioService_.Play(lila::modules::audio::domain::SoundCue::AdminContactSent);
    if (ConfirmSoundChange(command))
    {
        audioService_.RefreshAssets();
        refreshAreaAfterCommand_ = true;
    }
    if (refreshAreaAfterCommand_)
    {
        refreshAreaAfterCommand_ = false;
        RestoreAreaFromItem();
        SetStatus(wxString(L"Modification enregistrée. Actualisation de la liste…"));
        const auto& area = domain::GetAdminAreas()[selectedSection_];
        if (area.id == "reports")
        {
            RefreshBugReports(false, false);
            return;
        }
        if (const auto* refresh = domain::FindAdminCommand(area.automaticCommandId))
        {
            ExecuteCommand(
                *refresh,
                nlohmann::json::parse(refresh->payloadTemplate),
                false);
            return;
        }
    }
    if (refreshBugReportsAfterCommand_ &&
        (command.id == "bugs.create" || command.id == "bugs.update" ||
         command.id == "bugs.status" || command.id == "bugs.delete"))
    {
        refreshBugReportsAfterCommand_ = false;
        wxString message = L"Rapport modifié. Actualisation de la liste…";
        if (command.id == "bugs.create")
            message = L"Rapport créé et classé en attente. Actualisation de la liste…";
        else if (command.id == "bugs.status")
            message = L"Classement du rapport enregistré. Actualisation de la liste…";
        else if (command.id == "bugs.delete")
            message = L"Rapport supprimé. Actualisation de la liste…";
        SetStatus(message);
        RefreshBugReports(false, false);
        return;
    }
    const auto temporaryPassword = result->find("temporaryPassword");
    if (temporaryPassword != result->end() && temporaryPassword->is_string())
    {
        lila::shared::security::SensitiveString password(
            temporaryPassword->get<std::string>());
        wxTextEntryDialog passwordDialog(
            this,
            wxString(L"Copiez ce mot de passe maintenant. Il ne sera plus affiché après la fermeture de cette boîte de dialogue."),
            wxString(L"Mot de passe temporaire"),
            lila::shared::text::FromUtf8(password.Value()),
            wxOK);
        passwordDialog.ShowModal();
        *temporaryPassword = "<affiché une seule fois>";
    }
    const bool countsOnly = command.id == "bugs.list" && loadingReportCountsOnly_;
    CacheBotTimingSettings(*result);
    if (ResumeBotTimingEditorIfNeeded(command)) return;
    ShowResult(command, *result);
    if (countsOnly || command.id == "bugs.get") return;
    if (announceLifecycle)
        SetStatus(wxString(L"Opération terminée : ") + wxString(command.label));
    if (keepFocusAfterCommand_)
    {
        keepFocusAfterCommand_ = false;
        FocusCurrentMenu();
    }
    else FocusResult();
}

}
