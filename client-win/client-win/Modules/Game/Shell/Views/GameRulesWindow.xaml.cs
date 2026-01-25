using System;
using System.Linq;
using System.Windows;

namespace client_win.Modules.Game.Shell.Views;

public partial class GameRulesWindow : Window
{
    private sealed class Vm
    {
        public string WindowTitle { get; init; } = "Règles";
        public string[] RulesLines { get; init; } = Array.Empty<string>();
    }

    public GameRulesWindow(string title, string rules)
    {
        var text = string.IsNullOrWhiteSpace(rules) ? "Aucune règle disponible." : rules.Trim();
        var lines = text.Replace("\r\n", "\n").Split('\n').Select(l => l.TrimEnd('\r')).ToArray();
        if (lines.Length == 0)
        {
            lines = new[] { "Aucune règle disponible." };
        }

        InitializeComponent();
        DataContext = new Vm
        {
            WindowTitle = string.IsNullOrWhiteSpace(title) ? "Règles" : title.Trim(),
            RulesLines = lines,
        };

        Loaded += (_, _) =>
        {
            try { RulesList.Focus(); } catch { }
        };
    }

    public static void Show(Window? owner, string title, string rules)
    {
        var w = new GameRulesWindow(title, rules) { Owner = owner };
        w.ShowDialog();
    }

    private void OnCloseClicked(object sender, RoutedEventArgs e)
    {
        Close();
    }
}
