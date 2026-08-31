#include "modules/gameplay/prompts/presentation/GamePromptPanel.h"

#include <algorithm>
#include <cctype>
#include <map>

#include <wx/checkbox.h>
#include <wx/checklst.h>
#include <wx/choice.h>
#include <wx/rearrangectrl.h>
#include <wx/sizer.h>
#include <wx/stattext.h>
#include <wx/textctrl.h>

#include "modules/gameplay/prompts/application/GamePromptInputCodec.h"
#include "modules/gameplay/shell/presentation/formatting/GamePlayFormatters.h"
#include "modules/gameplay/state/infrastructure/GameValueDecoder.h"
#include "shared/ui/presentation/theme/Theme.h"

namespace lila::modules::gameplay::presentation::prompt
{
void GamePromptPanel::RebuildFields(const domain::GamePrompt& prompt)
{
    struct FieldMemory final
    {
        std::vector<domain::GameValue> values;
        std::string text;
        bool hasText = false;
        bool checked = false;
        bool hasChecked = false;
    };
    std::map<std::string, FieldMemory> previous;
    for (const auto& control : fields_)
    {
        auto& memory = previous[control.field.key];
        if (control.ordering != nullptr)
            for (const int encodedIndex : control.ordering->GetList()->GetCurrentOrder())
            {
                const int index = encodedIndex < 0 ? ~encodedIndex : encodedIndex;
                if (index >= 0 && static_cast<std::size_t>(index) < control.field.choices.size())
                    memory.values.push_back(control.field.choices[static_cast<std::size_t>(index)]);
            }
        else if (control.multipleChoice != nullptr)
        {
            for (unsigned int index = 0; index < control.multipleChoice->GetCount(); ++index)
                if (control.multipleChoice->IsChecked(index) && index < control.field.choices.size())
                    memory.values.push_back(control.field.choices[index]);
        }
        else if (control.choice != nullptr)
        {
            const int selected = control.choice->GetSelection() - (control.field.optional ? 1 : 0);
            if (selected >= 0 && static_cast<std::size_t>(selected) < control.field.choices.size())
                memory.values.push_back(control.field.choices[static_cast<std::size_t>(selected)]);
        }
        else if (control.checkbox != nullptr)
        {
            memory.checked = control.checkbox->GetValue();
            memory.hasChecked = true;
        }
        else if (control.text != nullptr)
        {
            memory.text = std::string(control.text->GetValue().ToUTF8().data());
            memory.hasText = true;
        }
    }
    fieldsSizer_->Clear(true);
    fields_.clear();
    for (const auto& field : prompt.fields)
    {
        FieldControl control;
        control.field = field;
        std::string kind = field.kind;
        std::transform(kind.begin(), kind.end(), kind.begin(),
            [](unsigned char ch) { return static_cast<char>(std::tolower(ch)); });
        if (!field.choices.empty())
        {
            auto* label = new wxStaticText(this, wxID_ANY, FromUtf8(field.label));
            label->SetForegroundColour(lila::shared::ui::Theme::TextPrimary());
            fieldsSizer_->Add(label, 0, wxEXPAND | wxBOTTOM, 3);
            wxArrayString labels;
            for (const auto& choice : field.choices)
            {
                const auto encoded = infrastructure::EncodeGameValue(choice);
                labels.Add(FromUtf8(encoded.is_string()
                    ? encoded.get<std::string>() : encoded.dump()));
            }
            if (field.ordering)
            {
                wxArrayInt order;
                std::vector<bool> inserted(field.choices.size(), false);
                if (const auto memory = previous.find(field.key); memory != previous.end())
                    for (const auto& value : memory->second.values)
                        for (std::size_t index = 0; index < field.choices.size(); ++index)
                            if (!inserted[index] && field.choices[index] == value)
                            {
                                order.Add(static_cast<int>(index));
                                inserted[index] = true;
                                break;
                            }
                for (std::size_t index = 0; index < field.choices.size(); ++index)
                    if (!inserted[index]) order.Add(static_cast<int>(index));
                control.ordering = new wxRearrangeCtrl(this, wxID_ANY,
                    wxDefaultPosition, wxDefaultSize, order, labels);
                control.ordering->SetName(FromUtf8(field.label +
                    ". Réorganisez avec les boutons haut et bas."));
                fieldsSizer_->Add(control.ordering, 0, wxEXPAND | wxBOTTOM, 8);
            }
            else if (field.multiple)
            {
                control.multipleChoice = new wxCheckListBox(this, wxID_ANY,
                    wxDefaultPosition, wxDefaultSize, labels);
                control.multipleChoice->SetName(FromUtf8(field.label + ". Choix multiples."));
                if (const auto memory = previous.find(field.key); memory != previous.end())
                    for (std::size_t index = 0; index < field.choices.size(); ++index)
                        if (std::find(memory->second.values.begin(), memory->second.values.end(),
                                field.choices[index]) != memory->second.values.end())
                            control.multipleChoice->Check(static_cast<unsigned int>(index));
                fieldsSizer_->Add(control.multipleChoice, 0, wxEXPAND | wxBOTTOM, 8);
            }
            else
            {
                if (field.optional) labels.Insert(wxString(L"Non renseigné"), 0);
                control.choice = new wxChoice(this, wxID_ANY,
                    wxDefaultPosition, wxDefaultSize, labels);
                control.choice->SetSelection(0);
                if (const auto memory = previous.find(field.key);
                    memory != previous.end() && !memory->second.values.empty())
                {
                    const auto found = std::find(field.choices.begin(), field.choices.end(),
                        memory->second.values.front());
                    if (found != field.choices.end())
                        control.choice->SetSelection(static_cast<int>(
                            std::distance(field.choices.begin(), found)) + (field.optional ? 1 : 0));
                }
                control.choice->SetName(FromUtf8(field.label));
                fieldsSizer_->Add(control.choice, 0, wxEXPAND | wxBOTTOM, 8);
            }
        }
        else if (kind == "boolean" || kind == "bool")
        {
            if (field.optional)
            {
                control.field.choices = {domain::GameValue{true}, domain::GameValue{false}};
                control.choice = new wxChoice(this, wxID_ANY, wxDefaultPosition, wxDefaultSize,
                    wxArrayString{wxString(L"Non renseigné"), wxString(L"Oui"), wxString(L"Non")});
                control.choice->SetSelection(0);
                if (const auto memory = previous.find(field.key);
                    memory != previous.end() && !memory->second.values.empty())
                {
                    if (const auto* checked = std::get_if<bool>(
                            &memory->second.values.front().value))
                        control.choice->SetSelection(*checked ? 1 : 2);
                }
                control.choice->SetName(FromUtf8(field.label));
                fieldsSizer_->Add(control.choice, 0, wxEXPAND | wxBOTTOM, 8);
            }
            else
            {
                control.checkbox = new wxCheckBox(this, wxID_ANY, FromUtf8(field.label));
                const auto parsed = application::GamePromptInputCodec::Parse(field, field.initialText);
                control.checkbox->SetValue(
                    parsed.valid && parsed.value.is_boolean() && parsed.value.get<bool>());
                if (const auto memory = previous.find(field.key);
                    memory != previous.end() && memory->second.hasChecked)
                    control.checkbox->SetValue(memory->second.checked);
                control.checkbox->SetName(FromUtf8(field.label));
                fieldsSizer_->Add(control.checkbox, 0, wxEXPAND | wxBOTTOM, 8);
            }
        }
        else
        {
            auto* label = new wxStaticText(this, wxID_ANY, FromUtf8(field.label));
            label->SetForegroundColour(lila::shared::ui::Theme::TextPrimary());
            fieldsSizer_->Add(label, 0, wxEXPAND | wxBOTTOM, 3);
            const long style = wxTE_PROCESS_ENTER | wxWANTS_CHARS |
                ((kind == "array" || kind == "object" || kind == "json") ? wxTE_MULTILINE : 0);
            control.text = new wxTextCtrl(this, wxID_ANY, FromUtf8(field.initialText),
                wxDefaultPosition, wxDefaultSize, style);
            if (const auto memory = previous.find(field.key);
                memory != previous.end() && memory->second.hasText)
                control.text->SetValue(FromUtf8(memory->second.text));
            control.text->SetName(FromUtf8(field.label));
            fieldsSizer_->Add(control.text, 0, wxEXPAND | wxBOTTOM, 8);
        }
        fields_.push_back(std::move(control));
    }
}
}
