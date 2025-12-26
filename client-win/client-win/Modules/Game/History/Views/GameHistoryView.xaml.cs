using System;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Input;

namespace client_win.Modules.Game.History.Views;

public partial class GameHistoryView : UserControl
{
    public GameHistoryView()
    {
        InitializeComponent();
        Loaded += OnLoaded;
    }

    public FrameworkElement? FocusTarget => HistoryEditor;

    public event EventHandler<TabNavigationRequestedEventArgs>? TabNavigationRequested;

    private void OnLoaded(object sender, RoutedEventArgs e)
    {
        Dispatcher.BeginInvoke(new Action(() =>
        {
            var lines = HistoryEditor.LineCount;
            if (lines <= 0)
            {
                return;
            }

            MoveCaretToLine(lines - 1);
            HistoryEditor.Focus();
            Keyboard.Focus(HistoryEditor);
        }));
    }

    private void OnHistoryEditorPreviewKeyDown(object sender, KeyEventArgs e)
    {
        if (e.Key == Key.Tab)
        {
            // IMPORTANT: le contrôle ne doit pas "décider" de la navigation clavier.
            // Il empêche juste la consommation de Tab/Maj+Tab et délègue à la vue parente (Room).
            e.Handled = true;

            var shift = (Keyboard.Modifiers & ModifierKeys.Shift) == ModifierKeys.Shift;
            TabNavigationRequested?.Invoke(this, new TabNavigationRequestedEventArgs(shift));
            return;
        }

        if (e.Key != Key.Up && e.Key != Key.Down)
        {
            return;
        }

        // Navigation "ligne par ligne" pour les lecteurs d'écran :
        // on évite la sélection (sinon le lecteur annonce "sélectionné/désélectionné"),
        // et on déplace uniquement le caret sur la ligne précédente/suivante.
        e.Handled = true;

        var delta = e.Key == Key.Up ? -1 : 1;
        var currentLine = HistoryEditor.GetLineIndexFromCharacterIndex(HistoryEditor.SelectionStart);
        var nextLine = Math.Clamp(currentLine + delta, 0, Math.Max(0, HistoryEditor.LineCount - 1));
        MoveCaretToLine(nextLine);
    }

    private void MoveCaretToLine(int lineIndex)
    {
        var count = HistoryEditor.LineCount;
        if (count <= 0)
        {
            return;
        }

        var clamped = Math.Clamp(lineIndex, 0, count - 1);
        var start = HistoryEditor.GetCharacterIndexFromLineIndex(clamped);
        HistoryEditor.SelectionStart = start;
        HistoryEditor.SelectionLength = 0;
        HistoryEditor.CaretIndex = start;
        HistoryEditor.ScrollToLine(clamped);
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
