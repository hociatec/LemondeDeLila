#pragma once

#include <string>
#include <vector>

#include <nlohmann/json.hpp>
#include <wx/dialog.h>

#include "modules/admin/domain/AdminCommand.h"
#include "modules/admin/domain/AdminFormMetadata.h"

class wxCheckBox;
class wxKeyEvent;
class wxWindow;

namespace lila::modules::admin::presentation
{
class AdminCommandDialog final : public wxDialog
{
public:
    AdminCommandDialog(
        wxWindow* parent,
        const domain::AdminCommand& command,
        const nlohmann::json& initialPayload);

    [[nodiscard]] const nlohmann::json& Payload() const noexcept { return payload_; }

private:
    struct FieldControl final
    {
        std::string key;
        nlohmann::json initialValue;
        domain::AdminFieldMetadata metadata;
        wxCheckBox* include = nullptr;
        wxWindow* editor = nullptr;
    };

    void BuildFields(const nlohmann::json& initialPayload);
    [[nodiscard]] nlohmann::json ReadValue(const FieldControl& field) const;
    void HandleKey(wxKeyEvent& event);
    bool TransferDataFromWindow() override;

    const domain::AdminCommand& command_;
    wxWindow* fieldsParent_ = nullptr;
    std::vector<FieldControl> fields_;
    nlohmann::json payload_ = nlohmann::json::object();
};
}
