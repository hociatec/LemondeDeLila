using System;
using System.Windows;

namespace client_win.Modules.Game.Shell.Views;

public partial class GameRulesWindow : Window
{
    private sealed class Vm
    {
        public string WindowTitle { get; init; } = "Règles";
        public string RulesText { get; init; } = string.Empty;
    }

    public GameRulesWindow(string title, string rules)
    {
        InitializeComponent();
        DataContext = new Vm
        {
            WindowTitle = string.IsNullOrWhiteSpace(title) ? "Règles" : title.Trim(),
            RulesText = string.IsNullOrWhiteSpace(rules) ? "Aucune règle disponible." : rules.Trim(),
        };

        Loaded += (_, _) =>
        {
            try { RulesText.Focus(); } catch { }
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

