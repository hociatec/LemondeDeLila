#include "modules/admin/presentation/AdminCommandDialog.h"

#include <algorithm>

#include <wx/checkbox.h>
#include <wx/msgdlg.h>

#include "shared/text/presentation/encoding/Encoding.h"

namespace lila::modules::admin::presentation
{
namespace
{
std::vector<domain::AdminFormValue> ToFormValues(const nlohmann::json& payload)
{
    std::vector<domain::AdminFormValue> values;
    if (!payload.is_object()) return values;
    values.reserve(payload.size());
    for (const auto& item : payload.items())
    {
        domain::AdminFormValue value;
        value.field = item.key();
        if (item.value().is_string())
        {
            value.kind = domain::AdminFormValueKind::Text;
            value.text = item.value().get<std::string>();
        }
        else if (item.value().is_number_integer())
        {
            value.kind = domain::AdminFormValueKind::Integer;
            value.number = item.value().get<double>();
        }
        else if (item.value().is_number())
        {
            value.kind = domain::AdminFormValueKind::Number;
            value.number = item.value().get<double>();
        }
        else if (item.value().is_array())
        {
            value.kind = domain::AdminFormValueKind::TextList;
            for (const auto& element : item.value())
            {
                if (!element.is_string())
                {
                    value.kind = domain::AdminFormValueKind::InvalidList;
                    value.textList.clear();
                    break;
                }
                value.textList.push_back(element.get<std::string>());
            }
        }
        values.push_back(std::move(value));
    }
    return values;
}
}

bool AdminCommandDialog::TransferDataFromWindow()
{
    payload_ = nlohmann::json::object();
    for (const auto& field : fields_)
    {
        try
        {
            if (field.include == nullptr || field.include->GetValue())
                payload_[field.key] = ReadValue(field);
        }
        catch (const std::exception& error)
        {
            wxMessageBox(
                field.metadata.label + wxString(L" : ") +
                    lila::shared::text::FromUtf8(error.what()),
                wxString(L"Paramètre invalide"), wxOK | wxICON_ERROR, this);
            CallAfter([this, key = field.key]
            {
                const auto found = std::find_if(fields_.begin(), fields_.end(),
                    [&key](const FieldControl& candidate) { return candidate.key == key; });
                if (found != fields_.end()) FocusField(*found);
            });
            return false;
        }
    }
    if (const auto error = domain::ValidateAdminFormPayload(command_.id, ToFormValues(payload_)))
    {
        wxMessageBox(error->message, wxString(L"Paramètre invalide"),
            wxOK | wxICON_ERROR, this);
        CallAfter([this, key = error->field]
        {
            const auto found = std::find_if(fields_.begin(), fields_.end(),
                [&key](const FieldControl& candidate) { return candidate.key == key; });
            if (found != fields_.end()) FocusField(*found);
        });
        return false;
    }
    return true;
}
}
