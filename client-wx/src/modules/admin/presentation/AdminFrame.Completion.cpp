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
#include "shared/security/domain/SensitiveString.h"
#include "shared/text/presentation/encoding/Encoding.h"

namespace lila::modules::admin::presentation
{
namespace
{
std::optional<wxString> AmbienceSuccessMessage(
    const domain::AdminCommand& command, const nlohmann::json& result,
    bool isAmbienceUpload = false)
{
    const auto name = lila::shared::text::FromUtf8(result.value("name", std::string{}));
    if (command.id == "sounds.ambience.create")
        return name.empty() ? wxString(L"Ambiance créée et son enregistré.") : L"Ambiance « " + name + L" » créée et son enregistré.";
    if (command.id == "sounds.ambience.rename")
        return name.empty() ? wxString(L"Ambiance renommée.") : L"Ambiance renommée : « " + name + L" ».";
    if (command.id == "sounds.ambience.enable")
        return result.value("enabled", false) ? wxString(L"Ambiance activée.")
                                             : wxString(L"Ambiance désactivée.");
    if (command.id == "sounds.ambience.delete") return wxString(L"Ambiance supprimée.");
    if (command.id == "sounds.upload" && isAmbienceUpload)
        return wxString(L"Son de l’ambiance enregistré.");
    return std::nullopt;
}

bool IsAmbienceCommand(const domain::AdminCommand& command, bool isAmbienceUpload)
{
    return command.id.starts_with("sounds.ambience.") ||
        (command.id == "sounds.upload" && isAmbienceUpload);
}
}

void AdminFrame::CompleteCommand(
    lila::shared::concurrency::AsyncRequestSlot::Token generation,
    const domain::AdminCommand& command,
    bool announceLifecycle,
    std::optional<lila::shared::errors::AppError> error,
    std::optional<domain::AdminPayload> resultPayload)
{
    if (!requestSlot_.Complete(generation)) return;
    loading_ = false;
    std::optional<nlohmann::json> result;
    if (resultPayload)
    {
        try
        {
            result = nlohmann::json::parse(resultPayload->Serialized());
        }
        catch (const nlohmann::json::exception&)
        {
            error = lila::shared::errors::ToAppError(
                "Réponse administrateur invalide.", "Invalid admin JSON response.");
        }
    }
    if (error.has_value() || !result.has_value())
    {
        if (!pendingQuestionEditor_ && !showingItemActions_ &&
            (command.id == "mnemo.categories" || command.id == "mnemo.questions") &&
            !gameNavigation_.empty() && gameNavigation_.back().itemActions)
            RestoreGameNavigation();
        pendingQuestionEditor_.reset();
        const bool isAmbienceUpload =
            (command.id == "sounds.upload" &&
             currentResultItemKind_ == domain::AdminItemKind::Ambience);
        const bool isAmbienceCommand = IsAmbienceCommand(command, isAmbienceUpload);
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
                isAmbienceCommand ? L"Gestion des ambiances" : L"Gestion des sons",
                wxOK | wxICON_ERROR, this);
        }
        FocusCurrentMenu();
        return;
    }
    if (command.id == "mnemo.categories" && pendingQuestionEditor_)
    {
        const auto index = *pendingQuestionEditor_;
        pendingQuestionEditor_.reset();
        questionCategories_ = result->value("categories", nlohmann::json::array());
        if (!questionCategories_.is_array() || questionCategories_.empty())
        {
            SetStatus(L"Aucune catégorie disponible pour modifier cette question.", true);
            return;
        }
        questionCategoriesReady_ = true;
        ActivateCommand(index);
        questionCategoriesReady_ = false;
        return;
    }
    if (refreshAreaAfterCommand_ &&
        domain::GetAdminAreas()[selectedSection_].id == "games" &&
        RestoreGameNavigation())
    {
        refreshAreaAfterCommand_ = false;
        ExecuteCommand(*gameResultCommand_, gameResultPayload_, false);
        return;
    }
    if (command.id == "contacts.reply")
        audioService_.Play(lila::modules::audio::domain::SoundCue::AdminContactSent);
    if (ConfirmSoundChange(command))
    {
        audioService_.RefreshAssets();
        refreshAreaAfterCommand_ = true;
    }
    if ((command.id == "bugs.comment" || command.id == "bugs.comment.delete") &&
        activeCommentsReportId_)
    {
        refreshAreaAfterCommand_ = false;
        RestoreAreaFromItem();
        SetStatus(command.id == "bugs.comment"
            ? L"Commentaire ajouté. Actualisation de la liste…"
            : L"Commentaire supprimé. Actualisation de la liste…");
        if (const auto* comments = domain::FindAdminCommand("bugs.comments"))
        {
            ExecuteCommand(*comments,
                {{"reportId", *activeCommentsReportId_}, {"offset", 0}, {"limit", 50}},
                false);
            return;
        }
    }
    if (refreshAreaAfterCommand_)
    {
        refreshAreaAfterCommand_ = false;
        const bool isAmbienceUpload =
            (command.id == "sounds.upload" &&
             currentResultItemKind_ == domain::AdminItemKind::Ambience);
        auto successMessage = AmbienceSuccessMessage(command, *result, isAmbienceUpload);
        RestoreAreaFromItem();
        SetStatus(successMessage.value_or(
            wxString(L"Modification enregistrée. Actualisation de la liste…")));
        if (successMessage.has_value())
            wxMessageBox(*successMessage, L"Gestion des ambiances",
                wxOK | wxICON_INFORMATION, this);
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
