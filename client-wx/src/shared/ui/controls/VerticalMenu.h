#pragma once

#include <functional>
#include <span>
#include <string>

#include <wx/panel.h>
#include <wx/string.h>

class wxBoxSizer;
class wxCommandEvent;
class wxKeyEvent;
class wxListBox;
class wxWindow;

namespace lila::shared::ui::controls
{
struct VerticalMenuItem
{
    std::string id;
    wxString label;
};

class VerticalMenu final : public wxPanel
{
public:
    using SelectionChangedHandler = std::function<void(std::size_t index)>;
    using ActivatedHandler = std::function<void(std::size_t index)>;

    VerticalMenu(wxWindow* parent, std::span<const VerticalMenuItem> items);

    void SetSelectionChangedHandler(SelectionChangedHandler handler);
    void SetActivatedHandler(ActivatedHandler handler);
    void SetSelectedIndex(std::size_t index);
    void SetItems(std::span<const VerticalMenuItem> items);
    void FocusSelectedItem();
    void FocusFirstItem();
    void SetForwardTabTarget(wxWindow* target);
    void SetBackwardTabTarget(wxWindow* target);
    void SetTabNavigationEnabled(bool enabled);
    [[nodiscard]] std::size_t GetSelectedIndex() const;
    [[nodiscard]] std::size_t GetItemCount() const;
    [[nodiscard]] wxWindow* GetFirstButton() const;
    [[nodiscard]] wxWindow* GetLastButton() const;
    void ApplyTheme();

private:
    void BuildLayout(std::span<const VerticalMenuItem> items);
    void BindListEvents();
    void OnListSelectionChanged(wxCommandEvent& event);
    void OnListActivated(std::size_t index);
    void OnListKeyDown(wxKeyEvent& event);
    void FocusIndex(std::size_t index);
    void NotifySelectionChanged();
    void UpdateVisualSelection();

    wxBoxSizer* sizer_ = nullptr;
    wxListBox* listBox_ = nullptr;
    std::size_t itemCount_ = 0;
    std::size_t selectedIndex_ = 0;
    wxWindow* forwardTabTarget_ = nullptr;
    wxWindow* backwardTabTarget_ = nullptr;
    bool tabNavigationEnabled_ = true;
    SelectionChangedHandler onSelectionChanged_;
    ActivatedHandler onActivated_;
};
}
