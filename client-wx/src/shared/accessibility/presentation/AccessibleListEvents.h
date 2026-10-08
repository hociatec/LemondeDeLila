#pragma once

#include <memory>
#include <wx/listbox.h>
#include <wx/weakref.h>

#ifdef __WXMSW__
#include <windows.h>
#include <commctrl.h>

namespace lila::shared::accessibility
{
// Native lists announce selection changes, but replacing the text at the same
// selected index also needs a name-change event for that accessible object.
class AccessibleListEvents final
{
public:
    static void Install(wxListBox& list)
    {
        const auto window = reinterpret_cast<HWND>(list.GetHandle());
        DWORD_PTR existing = 0;
        if (GetWindowSubclass(window, Procedure, 1, &existing)) return;
        auto state = std::make_unique<std::shared_ptr<State>>(std::make_shared<State>(list));
        if (SetWindowSubclass(window, Procedure, 1, reinterpret_cast<DWORD_PTR>(state.get())))
            state.release(); // Released on WM_NCDESTROY, including pending callbacks.
    }

private:
    struct State
    {
        explicit State(wxListBox& window) : list(&window) {}
        wxWeakRef<wxListBox> list;
        bool pending = false;
    };

    static LRESULT CALLBACK Procedure(HWND window, UINT message, WPARAM wParam,
        LPARAM lParam, UINT_PTR id, DWORD_PTR data)
    {
        const auto holder = reinterpret_cast<std::shared_ptr<State>*>(data);
        auto state = *holder;
        if (message == WM_NCDESTROY)
        {
            RemoveWindowSubclass(window, Procedure, id);
            delete holder;
            return DefSubclassProc(window, message, wParam, lParam);
        }
        if (!state->pending && state->list && state->list->HasFocus() &&
            (message == LB_DELETESTRING || message == LB_RESETCONTENT))
        {
            const int selected = static_cast<int>(SendMessage(window, LB_GETCARETINDEX, 0, 0));
            if (selected >= 0 && selected < static_cast<int>(state->list->GetCount()))
            {
                const auto previous = state->list->GetString(selected);
                state->pending = true;
                state->list->CallAfter([state, selected, previous]()
                {
                    state->pending = false;
                    auto* list = state->list.get();
                    if (!list || !list->HasFocus() || !list->IsShownOnScreen() ||
                        selected >= static_cast<int>(list->GetCount())) return;
                    const auto hwnd = reinterpret_cast<HWND>(list->GetHandle());
                    if (SendMessage(hwnd, LB_GETCARETINDEX, 0, 0) == selected &&
                        list->GetString(selected) != previous)
                        NotifyWinEvent(EVENT_OBJECT_NAMECHANGE, hwnd, OBJID_CLIENT, selected + 1);
                });
            }
        }
        return DefSubclassProc(window, message, wParam, lParam);
    }
};
}
#endif
