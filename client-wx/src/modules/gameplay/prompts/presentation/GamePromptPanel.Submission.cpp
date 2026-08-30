#include "modules/gameplay/prompts/presentation/GamePromptPanel.h"

#include <utility>

#include <wx/checkbox.h>
#include <wx/checklst.h>
#include <wx/choice.h>
#include <wx/rearrangectrl.h>
#include <wx/textctrl.h>

#include "modules/gameplay/prompts/application/GamePromptInputCodec.h"
#include "modules/gameplay/state/infrastructure/GameValueDecoder.h"
#include "modules/gameplay/shell/presentation/formatting/GamePlayFormatters.h"
#include "shared/accessibility/application/NavigationController.h"

namespace lila::modules::gameplay::presentation::prompt
{
void GamePromptPanel::Submit()
{
    if (!IsActive() || !action_) return;
    auto action = *action_;
    for (const auto& control : fields_)
    {
        if (control.ordering != nullptr)
        {
            auto values = nlohmann::json::array();
            for (const int encodedIndex : control.ordering->GetList()->GetCurrentOrder())
            {
                const int index = encodedIndex < 0 ? ~encodedIndex : encodedIndex;
                if (index >= 0 && static_cast<std::size_t>(index) < control.field.choices.size())
                    values.push_back(infrastructure::EncodeGameValue(
                        control.field.choices[static_cast<std::size_t>(index)]));
            }
            action.payload[control.field.key] = std::move(values);
            continue;
        }
        if (control.multipleChoice != nullptr)
        {
            auto values = nlohmann::json::array();
            for (unsigned int index = 0; index < control.multipleChoice->GetCount(); ++index)
                if (control.multipleChoice->IsChecked(index))
                    values.push_back(infrastructure::EncodeGameValue(control.field.choices[index]));
            const int count = static_cast<int>(values.size());
            if (count < control.field.minimumSelections ||
                (control.field.maximumSelections > 0 && count > control.field.maximumSelections))
            {
                if (onValidationError_) onValidationError_(
                    wxString(L"Nombre de sélections invalide."), control.multipleChoice);
                return;
            }
            action.payload[control.field.key] = std::move(values);
            continue;
        }
        if (control.choice != nullptr)
        {
            const int selected = control.choice->GetSelection();
            if (control.field.optional && selected == 0)
            {
                action.payload[control.field.key] = nullptr;
                continue;
            }
            const int valueIndex = selected - (control.field.optional ? 1 : 0);
            if (valueIndex < 0 || static_cast<std::size_t>(valueIndex) >= control.field.choices.size())
                return;
            action.payload[control.field.key] = infrastructure::EncodeGameValue(
                control.field.choices[static_cast<std::size_t>(valueIndex)]);
            continue;
        }
        const std::string raw = control.checkbox != nullptr
            ? (control.checkbox->GetValue() ? "oui" : "non")
            : std::string(control.text->GetValue().ToUTF8().data());
        auto parsed = application::GamePromptInputCodec::Parse(control.field, raw);
        if (!parsed.valid)
        {
            auto* target = control.checkbox != nullptr
                ? static_cast<wxWindow*>(control.checkbox)
                : static_cast<wxWindow*>(control.text);
            if (onValidationError_)
                onValidationError_(FromUtf8(control.field.label + " : " + parsed.error), target);
            lila::shared::accessibility::NavigationController::Focus(target);
            return;
        }
        action.payload[control.field.key] = std::move(parsed.value);
    }
    HidePrompt();
    if (onSubmit_) onSubmit_(std::move(action));
}
}
