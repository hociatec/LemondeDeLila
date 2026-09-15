#include "modules/admin/presentation/AdminCommandDialog.h"

#include <algorithm>
#include <stdexcept>

#include <wx/checkbox.h>
#include <wx/choice.h>
#include <wx/msgdlg.h>
#include <wx/scrolwin.h>
#include <wx/sizer.h>
#include <wx/stattext.h>
#include <wx/textctrl.h>
#include <wx/tokenzr.h>

#include "shared/text/presentation/encoding/Encoding.h"
#include "shared/accessibility/presentation/AccessibilityUtils.h"
#include "modules/admin/domain/AdminPagination.h"

namespace lila::modules::admin::presentation
{
namespace
{
wxString StringValue(const nlohmann::json& value)
{
    if (value.is_string()) return lila::shared::text::FromUtf8(value.get<std::string>());
    if (value.is_null()) return {};
    return lila::shared::text::FromUtf8(value.dump());
}
wxString ListValue(const nlohmann::json& value)
{
    if (!value.is_array()) return StringValue(value);
    wxString text;
    for (const auto& item : value)
    {
        if (!text.empty()) text += L"\n";
        text += StringValue(item);
    }
    return text;
}
}
AdminCommandDialog::AdminCommandDialog(
    wxWindow* parent,
    const domain::AdminCommand& command,
    const nlohmann::json& initialPayload,
    SoundPreviewHandler onSoundPreview)
    : wxDialog(parent, wxID_ANY, wxString(command.label), wxDefaultPosition,
          wxSize(720, 620), wxDEFAULT_DIALOG_STYLE | wxRESIZE_BORDER),
      command_(command), onSoundPreview_(std::move(onSoundPreview))
{
    auto* root = new wxBoxSizer(wxVERTICAL);
    auto* introduction = new wxStaticText(this, wxID_ANY, wxString(command.description));
    introduction->Wrap(660);
    root->Add(introduction, 0, wxEXPAND | wxALL, 16);

    auto* scroll = new wxScrolledWindow(this, wxID_ANY, wxDefaultPosition, wxDefaultSize,
        wxVSCROLL | wxTAB_TRAVERSAL);
    fieldsParent_ = scroll;
    scroll->SetScrollRate(0, 16);
    auto* fieldsSizer = new wxFlexGridSizer(2, 10, 12);
    fieldsSizer->AddGrowableCol(1, 1);
    scroll->SetSizer(fieldsSizer);
    root->Add(scroll, 1, wxEXPAND | wxLEFT | wxRIGHT, 16);
    BuildFields(initialPayload, *fieldsSizer);
    root->Add(CreateSeparatedButtonSizer(wxOK | wxCANCEL), 0, wxEXPAND | wxALL, 16);
    SetSizer(root);
    SetAffirmativeId(wxID_OK);
    SetEscapeId(wxID_CANCEL);
    Bind(wxEVT_CHAR_HOOK, &AdminCommandDialog::HandleKey, this);
    CentreOnParent();
    CallAfter([this] { FocusFirstField(); });
}
void AdminCommandDialog::BuildFields(
    const nlohmann::json& initialPayload,
    wxFlexGridSizer& fieldsSizer)
{
    auto* scroll = fieldsParent_;
    const auto orderedPayload = nlohmann::ordered_json::parse(command_.payloadTemplate);
    for (const auto& item : orderedPayload.items())
    {
        if (domain::IsAdminPaginationField(command_.id, item.key())) continue;
        FieldControl field;
        field.key = item.key();
        const auto initial = initialPayload.find(item.key());
        field.initialValue = initial == initialPayload.end()
            ? nlohmann::json(item.value()) : *initial;
        field.metadata = domain::GetAdminFieldMetadata(command_.id, item.key());
        if (field.metadata.kind == domain::AdminFieldKind::Choice)
        {
            auto* choice = new wxChoice(scroll, wxID_ANY);
            for (std::size_t index = 0; index < field.metadata.choices.size(); ++index)
                choice->Append(field.metadata.choiceLabels.size() == field.metadata.choices.size()
                    ? wxString(field.metadata.choiceLabels[index])
                    : lila::shared::text::FromUtf8(field.metadata.choices[index]));
            const auto rawValue = field.initialValue.is_string() ?
                field.initialValue.get<std::string>() : std::string{};
            const auto selected = std::find(
                field.metadata.choices.begin(), field.metadata.choices.end(), rawValue);
            choice->SetSelection(selected == field.metadata.choices.end() ? 0 :
                static_cast<int>(std::distance(field.metadata.choices.begin(), selected)));
            field.editor = choice;
        }
        else if (field.initialValue.is_boolean())
        {
            auto* checkbox = new wxCheckBox(scroll, wxID_ANY, field.metadata.label);
            checkbox->SetValue(field.initialValue.get<bool>());
            field.editor = checkbox;
        }
        else
        {
            const bool multiline = field.metadata.kind == domain::AdminFieldKind::Multiline ||
                field.metadata.kind == domain::AdminFieldKind::StringList ||
                item.value().is_array() || item.value().is_object();
            auto* text = new wxTextCtrl(scroll, wxID_ANY,
                field.metadata.kind == domain::AdminFieldKind::StringList
                    ? ListValue(field.initialValue) : StringValue(field.initialValue),
                wxDefaultPosition, multiline ? wxSize(-1, 90) : wxDefaultSize,
                multiline ? wxTE_MULTILINE : 0);
            field.editor = text;
        }
        lila::shared::accessibility::AccessibilityUtils::SetAccessibleName(
            *field.editor, field.metadata.label, field.metadata.help);
        if (!field.metadata.help.empty()) field.editor->SetToolTip(field.metadata.help);

        if (dynamic_cast<wxCheckBox*>(field.editor) != nullptr)
            fieldsSizer.AddSpacer(1);
        else
        {
            auto* rowLabel = new wxStaticText(scroll, wxID_ANY, field.metadata.label);
            fieldsSizer.Add(rowLabel, 0, wxALIGN_CENTER_VERTICAL | wxTOP, 5);
        }
        auto* valueSizer = new wxBoxSizer(wxVERTICAL);
        if (field.metadata.optional)
        {
            const bool hasInitialValue = initial != initialPayload.end() &&
                *initial != item.value();
            const bool included = field.metadata.includedByDefault || hasInitialValue;
            const auto includeLabel = wxString(L"Inclure le champ « ") +
                field.metadata.label + wxString(L" »");
            field.include = new wxCheckBox(scroll, wxID_ANY, includeLabel);
            lila::shared::accessibility::AccessibilityUtils::SetAccessibleName(
                *field.include, includeLabel);
            field.include->SetValue(included);
            field.editor->Enable(included);
            auto* editor = field.editor;
            field.include->Bind(wxEVT_CHECKBOX, [editor](wxCommandEvent& event)
            {
                editor->Enable(event.IsChecked());
            });
            valueSizer->Add(field.include, 0, wxBOTTOM, 3);
            field.editor->MoveAfterInTabOrder(field.include);
        }
        valueSizer->Add(field.editor, field.metadata.kind == domain::AdminFieldKind::Multiline ||
            field.metadata.kind == domain::AdminFieldKind::StringList ? 1 : 0, wxEXPAND);
        fieldsSizer.Add(valueSizer, 1, wxEXPAND);
        fields_.push_back(std::move(field));
    }
}
void AdminCommandDialog::FocusFirstField()
{
    if (!fields_.empty()) FocusField(fields_.front());
}
void AdminCommandDialog::FocusField(const FieldControl& field)
{
    auto* target = field.include != nullptr && !field.include->GetValue()
        ? static_cast<wxWindow*>(field.include) : field.editor;
    if (target != nullptr) target->SetFocus();
}
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
void AdminCommandDialog::HandleKey(wxKeyEvent& event)
{
    const auto keyCode = event.GetKeyCode();
    if (keyCode == WXK_SPACE && command_.id == "sounds.upload" && onSoundPreview_)
    {
        auto* focused = wxWindow::FindFocus();
        const auto field = std::find_if(fields_.begin(), fields_.end(),
            [focused](const FieldControl& candidate)
            {
                return candidate.key == "soundId" && candidate.editor == focused;
            });
        if (field != fields_.end())
        {
            const auto value = ReadValue(*field);
            if (value.is_string()) onSoundPreview_(value.get<std::string>());
            return;
        }
    }
    if (keyCode == WXK_ESCAPE)
    {
        EndModal(wxID_CANCEL);
        return;
    }
    if (keyCode != WXK_RETURN && keyCode != WXK_NUMPAD_ENTER)
    {
        event.Skip();
        return;
    }
    const auto* focusedText = dynamic_cast<wxTextCtrl*>(wxWindow::FindFocus());
    if (focusedText != nullptr && focusedText->IsMultiLine())
    {
        event.Skip();
        return;
    }
    if (command_.id.starts_with("bugs.") && focusedText != nullptr)
    {
        const auto current = std::find_if(fields_.begin(), fields_.end(),
            [focusedText](const FieldControl& field) { return field.editor == focusedText; });
        if (current != fields_.end() && current->key == "subject")
        {
            const auto next = std::next(current);
            if (next != fields_.end()) FocusField(*next);
            return;
        }
    }
    if (TransferDataFromWindow()) EndModal(wxID_OK);
}

}
