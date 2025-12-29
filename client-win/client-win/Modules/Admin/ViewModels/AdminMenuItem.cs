namespace client_win.Modules.Admin.ViewModels;

public sealed class AdminMenuItem
{
    public AdminMenuItem(string label, object? tag = null, bool isCheckable = false, bool isChecked = false)
    {
        Label = label;
        Tag = tag;
        IsCheckable = isCheckable;
        IsChecked = isChecked;
    }

    public string Label { get; }
    public object? Tag { get; }
    public bool IsCheckable { get; }
    public bool IsChecked { get; }

    public override string ToString() => Label;
}
