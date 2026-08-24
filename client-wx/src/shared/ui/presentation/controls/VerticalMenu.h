#pragma once

#include <chrono>
#include <functional>
#include <optional>
#include <span>
#include <string>
#include <string_view>
#include <vector>

#include <wx/event.h>
#include <wx/panel.h>
#include <wx/string.h>

class wxBoxSizer;
class wxCommandEvent;
class wxKeyEvent;
class wxListBox;
class wxWindow;

namespace lila::shared::ui::controls
{
wxDECLARE_EVENT(wxEVT_LILA_MENU_NAVIGATED, wxCommandEvent);
wxDECLARE_EVENT(wxEVT_LILA_MENU_ACTIVATED, wxCommandEvent);

class VerticalMenuEntry;

struct VerticalMenuItem
{
    std::string id;
    wxString label;
};

enum class VerticalMenuRole
{
    Menu,
    List,
    Entries,
};

class VerticalMenu final : public wxPanel
{
public:
    using SelectionChangedHandler = std::function<void(std::size_t index)>;
    using ActivatedHandler = std::function<void(std::size_t index)>;
    using KeyHandler = std::function<bool(int keyCode)>;

    VerticalMenu(
        wxWindow* parent,
        std::span<const VerticalMenuItem> items,
        VerticalMenuRole role = VerticalMenuRole::Menu);
    ~VerticalMenu() override;

    void SetSelectionChangedHandler(SelectionChangedHandler handler);
    void SetActivatedHandler(ActivatedHandler handler);
    void SetKeyHandler(KeyHandler handler);
    void SetSelectedIndex(std::size_t index);
    void SetSelectedIndexSilently(std::size_t index);
    void SetItems(std::span<const VerticalMenuItem> items);
    void SetItemsForNavigation(std::span<const VerticalMenuItem> items, std::size_t selectedIndex);
    void FocusSelectedItem();
    void FocusFirstItem();
    void SetForwardTabTarget(wxWindow* target);
    void SetBackwardTabTarget(wxWindow* target);
    void SetTabNavigationEnabled(bool enabled);
    [[nodiscard]] std::size_t GetSelectedIndex() const;
    [[nodiscard]] std::size_t GetItemCount() const;
    [[nodiscard]] std::string_view GetItemId(std::size_t index) const;
    [[nodiscard]] std::optional<std::string_view> GetSelectedItemId() const;
    [[nodiscard]] wxWindow* GetSelectedControl() const;
    [[nodiscard]] wxWindow* GetFirstButton() const;
    [[nodiscard]] wxWindow* GetLastButton() const;
    void ApplyTheme();

private:
    void BuildLayout(std::span<const VerticalMenuItem> items);
    void BindListEvents();
    void OnListSelectionChanged(wxCommandEvent& event);
    void OnListActivated(std::size_t index);
    void OnListKeyDown(wxKeyEvent& event);
    void BuildEntryLayout(std::span<const VerticalMenuItem> items);
    void SetEntryItems(std::span<const VerticalMenuItem> items);
    void BindEntry(VerticalMenuEntry& entry);
    void OnEntryKeyDown(std::size_t index, wxKeyEvent& event);
    void FocusIndex(std::size_t index, bool notify = true);
    void NotifySelectionChanged();
    void NotifyNavigationFeedback();
    void NotifyActivationFeedback();
    void UpdateVisualSelection();

    wxBoxSizer* sizer_ = nullptr;
    wxListBox* listBox_ = nullptr;
    std::vector<VerticalMenuEntry*> entries_;
    std::size_t itemCount_ = 0;
    std::size_t selectedIndex_ = 0;
    std::vector<std::string> itemIds_;
    wxWindow* forwardTabTarget_ = nullptr;
    wxWindow* backwardTabTarget_ = nullptr;
    bool tabNavigationEnabled_ = false;
    VerticalMenuRole role_ = VerticalMenuRole::Menu;
    SelectionChangedHandler onSelectionChanged_;
    ActivatedHandler onActivated_;
    KeyHandler onKey_;
    std::optional<std::size_t> lastPointerActivatedIndex_;
    std::chrono::steady_clock::time_point lastPointerActivationAt_{};
};
}
