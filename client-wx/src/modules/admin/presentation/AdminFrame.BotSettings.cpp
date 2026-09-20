#include "modules/admin/presentation/AdminFrame.h"

#include <array>

#include <wx/string.h>

namespace lila::modules::admin::presentation
{
bool AdminFrame::LoadBotTimingSettingsBeforeEditing(
    const domain::AdminCommand& command)
{
    if (command.id != "bots.settings.update" || !botTimingPayload_.empty()) return false;
    const auto* settingsCommand = domain::FindAdminCommand("bots.settings.get");
    if (!settingsCommand)
    {
        SetStatus(wxString(L"Lecture des attentes des bots indisponible."), true);
        return true;
    }
    openBotTimingEditorAfterRead_ = true;
    ExecuteCommand(*settingsCommand, nlohmann::json::object());
    return true;
}

void AdminFrame::CacheBotTimingSettings(const nlohmann::json& result)
{
    if (!result.is_object()) return;
    constexpr std::array<const char*, 3> botTimingFields{
        "botTurnDelayMs", "botStartDelayMs", "botDrawDelayMs"};
    for (const auto* field : botTimingFields)
        if (const auto value = result.find(field);
            value != result.end() && value->is_number_integer())
            botTimingPayload_[field] = *value;
}

bool AdminFrame::ResumeBotTimingEditorIfNeeded(const domain::AdminCommand& command)
{
    if (command.id != "bots.settings.get" || !openBotTimingEditorAfterRead_) return false;
    openBotTimingEditorAfterRead_ = false;
    if (botTimingPayload_.empty())
    {
        SetStatus(wxString(L"Réponse des attentes des bots invalide."), true);
        return true;
    }
    for (std::size_t index = 0; index < visibleCommands_.size(); ++index)
        if (visibleCommands_[index]->id == "bots.settings.update")
        {
            ActivateCommand(index);
            return true;
        }
    return false;
}
}
