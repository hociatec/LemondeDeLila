#pragma once

class wxWindow;

namespace lila::modules::options::presentation
{
class OptionsView;

class OptionsViewPagesBuilder final
{
public:
    static void BuildGeneralPage(OptionsView& view, wxWindow* parent);
    static void BuildSoundsPage(OptionsView& view, wxWindow* parent);
    static void BuildChatPage(OptionsView& view, wxWindow* parent);
};
}
