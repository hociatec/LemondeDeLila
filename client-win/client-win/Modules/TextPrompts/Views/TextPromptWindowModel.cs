using client_win.Core;

namespace client_win.Modules.TextPrompts.Views;

public sealed class TextPromptWindowModel : ObservableObject
{
    private string _title = "Message";
    private string _label = "Message";
    private string _text = string.Empty;

    public string Title
    {
        get => _title;
        set => SetProperty(ref _title, value);
    }

    public string Label
    {
        get => _label;
        set => SetProperty(ref _label, value);
    }

    public string Text
    {
        get => _text;
        set => SetProperty(ref _text, value);
    }
}

