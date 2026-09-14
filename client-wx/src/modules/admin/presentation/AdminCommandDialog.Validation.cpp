#include "modules/admin/presentation/AdminCommandDialog.h"

#include <algorithm>

#include <wx/checkbox.h>
#include <wx/msgdlg.h>

#include "shared/text/presentation/encoding/Encoding.h"

namespace lila::modules::admin::presentation
{
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
    if (const auto error = domain::ValidateAdminFormPayload(command_.id, payload_))
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
