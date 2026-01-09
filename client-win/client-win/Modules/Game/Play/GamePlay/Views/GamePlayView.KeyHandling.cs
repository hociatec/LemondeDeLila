using System.Threading;
using System.Windows.Input;
using client_win.Modules.Game.Play.GamePlay.ViewModels;

namespace client_win.Modules.Game.Play.GamePlay.Views;

public partial class GamePlayView
{
    private async void OnRootPreviewKeyDown(object sender, KeyEventArgs e)
    {
        HandleGridArrowKey(e);
        if (e.Handled)
        {
            return;
        }

        if (DataContext is not GamePlayViewModel vm)
        {
            return;
        }

        if (IsTextInputFocused())
        {
            return;
        }

        // Client as a bridge: forward key presses to the server; the server decides if it's a shortcut.
        if ((Keyboard.Modifiers & (ModifierKeys.Control | ModifierKeys.Alt | ModifierKeys.Windows)) != ModifierKeys.None)
        {
            return;
        }

        if (!TryMapKeyToServerShortcut(e.Key, out var key))
        {
            return;
        }

        e.Handled = true;
        try
        {
            await vm.TrySendKeyAsync(key, CancellationToken.None).ConfigureAwait(true);
        }
        catch
        {
            // ignore
        }
    }

    private static bool TryMapKeyToServerShortcut(Key key, out string normalized)
    {
        normalized = string.Empty;

        if (key is >= Key.A and <= Key.Z)
        {
            normalized = key.ToString().ToUpperInvariant();
            return true;
        }

        if (key is >= Key.D0 and <= Key.D9)
        {
            var digit = (int)key - (int)Key.D0;
            normalized = digit.ToString();
            return true;
        }

        // Common non-letter shortcuts.
        normalized = key switch
        {
            Key.Space => "SPACE",
            Key.Enter => "ENTER",
            Key.Back => "BACK",
            Key.Escape => "ESC",
            _ => string.Empty
        };

        return !string.IsNullOrWhiteSpace(normalized);
    }
}
