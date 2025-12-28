namespace client_win.Modules.Leaderboard.ViewModels;

public sealed class LeaderboardMenuItem
{
    public LeaderboardMenuItem(string label, object? tag = null)
    {
        Label = label;
        Tag = tag;
    }

    public string Label { get; }
    public object? Tag { get; }

    public override string ToString() => Label;
}
