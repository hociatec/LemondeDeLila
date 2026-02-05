using System;
using System.Windows;
using System.Windows.Input;

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
        var text = string.IsNullOrWhiteSpace(rules) ? "Aucune règle disponible." : rules.Trim();

        InitializeComponent();
        DataContext = new Vm
        {
            WindowTitle = string.IsNullOrWhiteSpace(title) ? "Règles" : title.Trim(),
            RulesText = text,
        };

        Loaded += (_, _) =>
        {
            try { RulesEditor.Focus(); } catch { }
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

    private void OnPreviewKeyDown(object sender, KeyEventArgs e)
    {
        if (e.Key != Key.Escape)
        {
            return;
        }

        e.Handled = true;
        Close();
    }
}
