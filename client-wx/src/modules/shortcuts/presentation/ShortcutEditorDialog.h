#pragma once
#include <wx/dialog.h>
#include "modules/shortcuts/domain/Shortcut.h"
class wxTextCtrl;
class wxListBox;
class wxCheckBox;
class wxStaticText;
namespace lila::modules::shortcuts::presentation
{
class ShortcutEditorDialog final : public wxDialog
{
public:
    ShortcutEditorDialog(wxWindow* parent, std::vector<domain::ShortcutTarget> targets,
        const domain::Shortcut& initial, std::vector<domain::Shortcut> others);
    domain::Shortcut Result() const;
private:
    void FilterTargets();
    void Accept();
    std::vector<domain::ShortcutTarget> targets_;
    std::vector<std::size_t> filtered_;
    std::vector<domain::Shortcut> others_;
    wxTextCtrl* search_ = nullptr;
    wxListBox* destinations_ = nullptr;
    wxTextCtrl* chord_ = nullptr;
    wxTextCtrl* label_ = nullptr;
    wxCheckBox* enabled_ = nullptr;
    wxStaticText* status_ = nullptr;
    std::string selectedTarget_;
};
}
