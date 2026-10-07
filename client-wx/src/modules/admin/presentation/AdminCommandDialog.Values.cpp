#include "modules/admin/presentation/AdminCommandDialog.h"
#include <stdexcept>
#include <wx/checkbox.h>
#include <wx/choice.h>
#include <wx/textctrl.h>
#include <wx/tokenzr.h>
#include "shared/text/presentation/encoding/Encoding.h"

namespace lila::modules::admin::presentation
{
nlohmann::json AdminCommandDialog::ReadValue(const FieldControl& field) const
{
    if (const auto* checkbox = dynamic_cast<wxCheckBox*>(field.editor))
        return checkbox->GetValue();
    if (const auto* choice = dynamic_cast<wxChoice*>(field.editor))
    {
        const auto selected = choice->GetSelection();
        if (selected == wxNOT_FOUND ||
            static_cast<std::size_t>(selected) >= field.metadata.choices.size())
            throw std::runtime_error("Une valeur de la liste est attendue.");
        return field.metadata.choices[static_cast<std::size_t>(selected)];
    }
    const auto* text = dynamic_cast<wxTextCtrl*>(field.editor);
    if (text == nullptr) throw std::runtime_error("Contrôle de formulaire inconnu.");
    const auto raw = lila::shared::text::ToUtf8(text->GetValue());
    if (field.metadata.kind == domain::AdminFieldKind::StringList)
    {
        nlohmann::json result = nlohmann::json::array();
        wxStringTokenizer lines(text->GetValue(), L"\n", wxTOKEN_STRTOK);
        while (lines.HasMoreTokens())
        {
            auto line = lines.GetNextToken();
            line.Trim(true).Trim(false);
            if (!line.empty()) result.push_back(lila::shared::text::ToUtf8(line));
        }
        return result;
    }
    if (field.initialValue.is_number())
    {
        const auto parsed = nlohmann::json::parse(raw);
        if (!parsed.is_number()) throw std::runtime_error("Un nombre est attendu.");
        return parsed;
    }
    if (field.initialValue.is_array() || field.initialValue.is_object())
        return nlohmann::json::parse(raw);
    if (field.initialValue.is_null()) return raw.empty() ? nlohmann::json(nullptr) : nlohmann::json(raw);
    return raw;
}
}
