using System.Windows.Controls;
using System.Windows;
using System;
using System.Windows.Input;

namespace client_win.Modules.Game.History.Views;

public partial class GameHistoryView : UserControl
{
    public GameHistoryView()
    {
        InitializeComponent();
    }

    public FrameworkElement? FocusTarget => HistoryEditor;

    public event EventHandler<TabNavigationRequestedEventArgs>? TabNavigationRequested;

    private void OnHistoryEditorPreviewKeyDown(object sender, KeyEventArgs e)
    {
        if (e.Key != Key.Tab)
        {
            return;
        }

        // IMPORTANT: le TextBox ne doit pas "décider" de la navigation clavier.
        // Il empêche juste la consommation de Tab/Maj+Tab et délègue à la vue parente (Room).
        e.Handled = true;

        var shift = (Keyboard.Modifiers & ModifierKeys.Shift) == ModifierKeys.Shift;
        TabNavigationRequested?.Invoke(this, new TabNavigationRequestedEventArgs(shift));
    }
}

public sealed class TabNavigationRequestedEventArgs : EventArgs
{
    public TabNavigationRequestedEventArgs(bool isShiftPressed)
    {
        IsShiftPressed = isShiftPressed;
    }

    public bool IsShiftPressed { get; }
}
