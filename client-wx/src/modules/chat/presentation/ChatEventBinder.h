#pragma once

#include <functional>

class wxButton;
class wxTextCtrl;
class wxWindow;

namespace lila::modules::chat::presentation
{
class ChatEventBinder final
{
public:
    struct Widgets
    {
        wxTextCtrl& input;
        wxTextCtrl& history;
        wxButton& editButton;
        wxButton& deleteButton;
    };

    struct Handlers
    {
        std::function<void()> send;
        std::function<void()> historySelectionChanged;
        std::function<void()> historyClicked;
        std::function<void()> historyActivated;
        std::function<void()> editSelected;
        std::function<void()> deleteSelected;
        std::function<void()> escape;
        std::function<void()> closeWindow;
    };

    static void Bind(wxWindow& owner, Widgets widgets, Handlers handlers);
};
}
