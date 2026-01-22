using System.Collections.ObjectModel;
using client_win.Core;

namespace client_win.Modules.TextPrompts.Views;

public sealed class ConfigPromptWindowModel : ObservableObject
{
    public string Title { get; set; } = "Configuration";

    public ObservableCollection<ConfigPromptFieldModel> Fields { get; } = new();
}

public sealed class ConfigPromptFieldModel : ObservableObject
{
    public string Key { get; init; } = string.Empty;
    public string Label { get; init; } = string.Empty;
    public string Kind { get; init; } = "text";

    public bool IsBoolean
    {
        get
        {
            var k = (Kind ?? string.Empty).Trim();
            return string.Equals(k, "bool", System.StringComparison.OrdinalIgnoreCase) ||
                   string.Equals(k, "boolean", System.StringComparison.OrdinalIgnoreCase);
        }
    }

    private string _text = string.Empty;
    public string Text
    {
        get => _text;
        set => SetProperty(ref _text, value);
    }

    private bool _boolValue;
    public bool BoolValue
    {
        get => _boolValue;
        set => SetProperty(ref _boolValue, value);
    }

    public override string ToString()
    {
        // WPF automation peers for ItemsControl can fallback to the data item's ToString().
        // Returning a human label avoids NVDA reading the class name ("...ConfigPromptFieldModel élément de données").
        return string.IsNullOrWhiteSpace(Label) ? string.Empty : Label;
    }
}
