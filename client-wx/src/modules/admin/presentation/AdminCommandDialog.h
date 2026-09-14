#pragma once

#include <string>
#include <functional>
#include <vector>

#include <nlohmann/json.hpp>
#include <wx/dialog.h>

#include "modules/admin/domain/AdminCommand.h"
#include "modules/admin/domain/AdminFormMetadata.h"

class wxCheckBox;
class wxFlexGridSizer;
class wxKeyEvent;
class wxWindow;

namespace lila::modules::admin::presentation
{
class AdminCommandDialog final : public wxDialog
{
public:
    using SoundPreviewHandler = std::function<void(std::string_view)>;

    AdminCommandDialog(
        wxWindow* parent,
        const domain::AdminCommand& command,
        const nlohmann::json& initialPayload,
        SoundPreviewHandler onSoundPreview = {});

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

    void BuildFields(const nlohmann::json& initialPayload, wxFlexGridSizer& fieldsSizer);
    void FocusFirstField();
    void FocusField(const FieldControl& field);
    [[nodiscard]] nlohmann::json ReadValue(const FieldControl& field) const;
    void HandleKey(wxKeyEvent& event);
    bool TransferDataFromWindow() override;

    const domain::AdminCommand& command_;
    SoundPreviewHandler onSoundPreview_;
    wxWindow* fieldsParent_ = nullptr;
    std::vector<FieldControl> fields_;
    nlohmann::json payload_ = nlohmann::json::object();
};
}
