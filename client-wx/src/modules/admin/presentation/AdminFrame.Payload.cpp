#include "modules/admin/presentation/AdminFrame.h"

#include <array>
#include <utility>

#include <wx/filedlg.h>
#include <wx/msgdlg.h>
#include <wx/textdlg.h>

#include "modules/admin/domain/AdminPagination.h"
#include "modules/admin/presentation/AdminCommandDialog.h"
#include "shared/text/presentation/encoding/Encoding.h"

namespace lila::modules::admin::presentation
{
namespace
{
bool IsContextIdentifier(const domain::AdminCommand& command, std::string_view key)
{
    constexpr std::array<std::string_view, 8> identifiers{
        "id", "userId", "toUserId", "messageId", "reportId", "contactId", "roomId", "soundId"};
    for (const auto identifier : identifiers)
        if (key == identifier) return true;
    return (command.id.starts_with("games.") && key == "gameType") ||
        (command.id.starts_with("mnemo.") && key == "categoryId") ||
        (command.id.starts_with("roles.") && key == "name");
}
}

bool AdminFrame::PreparePayload(
    const domain::AdminCommand& command,
    nlohmann::json& payload)
{
    domain::AdminCommand dialogCommand = command;
    nlohmann::json locked = nlohmann::json::object();
    if (showingItemActions_)
    {
        auto form = nlohmann::ordered_json::parse(command.payloadTemplate);
        for (auto iterator = form.begin(); iterator != form.end();)
        {
            if (IsContextIdentifier(command, iterator.key()))
            {
                if (payload.contains(iterator.key())) locked[iterator.key()] = payload[iterator.key()];
                iterator = form.erase(iterator);
            }
            else ++iterator;
        }
        dialogCommand.payloadTemplate = form.dump();
    }
    if (command.transport == domain::AdminTransport::HttpMultipart)
    {
        auto form = nlohmann::ordered_json::parse(dialogCommand.payloadTemplate);
        form.erase("filePath");
        dialogCommand.payloadTemplate = form.dump();
    }
    bool needsInput = false;
    const auto formPayload = nlohmann::json::parse(dialogCommand.payloadTemplate);
    for (const auto& item : formPayload.items())
        if (!domain::IsAdminPaginationField(command.id, item.key()))
        {
            needsInput = true;
            break;
        }
    if (needsInput)
    {
        AdminCommandDialog dialog(this, dialogCommand, payload,
            [this](std::string_view soundId) { PreviewSound(soundId); });
        if (dialog.ShowModal() != wxID_OK) return false;
        auto businessPayload = dialog.Payload();
        for (const auto& item : payload.items())
            if (domain::IsAdminPaginationField(command.id, item.key()))
                businessPayload[item.key()] = item.value();
        for (const auto& item : locked.items()) businessPayload[item.key()] = item.value();
        payload = std::move(businessPayload);
    }
    bool needsFile = false;
    if (command.transport == domain::AdminTransport::HttpMultipart)
    {
        const auto filePath = payload.find("filePath");
        if (filePath != payload.end() && !filePath->is_string())
        {
            SetStatus(wxString(L"Le chemin du fichier doit être une chaîne de caractères."), true);
            return false;
        }
        needsFile = filePath == payload.end() || filePath->get<std::string>().empty();
    }
    if (needsFile)
    {
        wxFileDialog picker(this, wxString(L"Choisir un fichier audio"), wxString{}, wxString{},
            wxString(L"Fichiers audio (*.wav;*.wave;*.ogg;*.mp3)|*.wav;*.wave;*.ogg;*.mp3|Tous les fichiers|*.*"),
            wxFD_OPEN | wxFD_FILE_MUST_EXIST);
        if (picker.ShowModal() != wxID_OK) return false;
        payload["filePath"] = lila::shared::text::ToUtf8(picker.GetPath());
    }
    return true;
}

bool AdminFrame::ConfirmDangerous(const domain::AdminCommand& command)
{
    if (!command.dangerous) return true;
    if (wxMessageBox(
            wxString(L"Cette opération est définitive. Voulez-vous continuer ?"),
            wxString(command.label), wxYES_NO | wxNO_DEFAULT | wxICON_WARNING,
            this) != wxYES)
        return false;
    if (showingItemActions_) return true;
    wxTextEntryDialog confirmation(this,
        wxString(L"Saisissez CONFIRMER pour exécuter l'opération."),
        wxString(L"Confirmation renforcée"));
    return confirmation.ShowModal() == wxID_OK && confirmation.GetValue() == L"CONFIRMER";
}
}
