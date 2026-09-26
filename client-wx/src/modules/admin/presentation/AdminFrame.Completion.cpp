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
namespace
{
std::optional<wxString> AmbienceSuccessMessage(
    const domain::AdminCommand& command, const nlohmann::json& result)
{
    const auto name = lila::shared::text::FromUtf8(result.value("name", std::string{}));
    if (command.id == "sounds.ambience.create")
        return name.empty() ? wxString(L"Ambiance créée.") : L"Ambiance « " + name + L" » créée.";
    if (command.id == "sounds.ambience.rename")
        return name.empty() ? wxString(L"Ambiance renommée.") : L"Ambiance renommée : « " + name + L" ».";
    if (command.id == "sounds.ambience.enable")
        return result.value("enabled", false) ? wxString(L"Ambiance activée.")
                                             : wxString(L"Ambiance désactivée.");
    if (command.id == "sounds.ambience.delete") return wxString(L"Ambiance supprimée.");
    return std::nullopt;
}
}

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
        pendingAmbienceUploadPath_.reset();
        uploadingCreatedAmbience_ = false;
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
    if (command.id == "sounds.ambience.create" && pendingAmbienceUploadPath_)
    {
        const auto soundId = result->value("soundId", std::string{});
        const auto* upload = domain::FindAdminCommand("sounds.upload");
        if (!soundId.empty() && upload != nullptr)
        {
            uploadingCreatedAmbience_ = true;
            auto payload = nlohmann::json{{"soundId", soundId},
                {"filePath", std::move(*pendingAmbienceUploadPath_)}};
            pendingAmbienceUploadPath_.reset();
            ExecuteCommand(*upload, std::move(payload), false);
            return;
        }
        pendingAmbienceUploadPath_.reset();
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
        auto successMessage = AmbienceSuccessMessage(command, *result);
        if (uploadingCreatedAmbience_)
        {
            uploadingCreatedAmbience_ = false;
            successMessage = wxString(L"Ambiance créée et son enregistré.");
        }
        RestoreAreaFromItem();
        SetStatus(successMessage.value_or(
            wxString(L"Modification enregistrée. Actualisation de la liste…")));
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
        SetStatus(AmbienceSuccessMessage(command, *result).value_or(
            wxString(L"Opération terminée : ") + wxString(command.label)));
    if (keepFocusAfterCommand_)
    {
        keepFocusAfterCommand_ = false;
        FocusCurrentMenu();
    }
    else FocusResult();
}

}
