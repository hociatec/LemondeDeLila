namespace client_win.Modules.Stats.ViewModels;

public sealed class StatsMenuItem
{
    public StatsMenuItem(string label, object? tag = null)
    {
        Label = label;
        Tag = tag;
    }

    public string Label { get; }
    public object? Tag { get; }

    public override string ToString() => Label;
}
