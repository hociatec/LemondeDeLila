#include "modules/gameplay/presentation/GameActionPromptDialog.h"

#include <utility>

#include <wx/msgdlg.h>
#include <wx/textdlg.h>

#include "modules/gameplay/application/GamePromptInputCodec.h"
#include "modules/gameplay/presentation/GamePlayFormatters.h"

namespace lila::modules::gameplay::presentation
{
std::optional<domain::GameAction> GameActionPromptDialog::Prepare(
    wxWindow& parent,
    domain::GameAction action,
    const std::optional<domain::GamePrompt>& prompt)
{
    if (action.confirm)
    {
        const auto answer = wxMessageBox(
            wxString(L"Confirmer cette action ?"),
            FromUtf8(action.label.empty() ? action.type : action.label),
            wxYES_NO | wxICON_QUESTION,
            &parent);
        if (answer != wxYES) return std::nullopt;
    }

    if (!prompt || prompt->actionType != action.type) return action;
    const auto title = FromUtf8(prompt->title.empty() ? prompt->label : prompt->title);
    for (const auto& field : prompt->fields)
    {
        auto currentValue = field.initialText;
        for (;;)
        {
            wxTextEntryDialog dialog(
                &parent,
                FromUtf8(field.label),
                title.empty() ? wxString(L"Paramètres") : title,
                FromUtf8(currentValue));
            if (dialog.ShowModal() != wxID_OK) return std::nullopt;
            currentValue = dialog.GetValue().ToUTF8().data();
            auto parsed = application::GamePromptInputCodec::Parse(field, currentValue);
            if (parsed.valid)
            {
                action.payload[field.key] = std::move(parsed.value);
                break;
            }
            wxMessageBox(FromUtf8(parsed.error), wxString(L"Valeur invalide"), wxOK | wxICON_ERROR, &parent);
        }
    }
    return action;
}
}
