using System;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Controls.Primitives;
using System.Windows.Input;
using client_win.Modules.Shell.Services;

namespace client_win.Core.Accessibility;

public static class SpaceKeyAnnouncer
{
    private static int _initialized;
    private static IScreenReaderAnnouncer? _announcer;

    public static void Initialize(IScreenReaderAnnouncer announcer)
    {
        if (announcer == null) throw new ArgumentNullException(nameof(announcer));
        if (System.Threading.Interlocked.Exchange(ref _initialized, 1) == 1)
        {
            return;
        }

        _announcer = announcer;

        EventManager.RegisterClassHandler(
            typeof(TextBoxBase),
            UIElement.PreviewKeyDownEvent,
            new KeyEventHandler(OnPreviewKeyDown));

        EventManager.RegisterClassHandler(
            typeof(PasswordBox),
            UIElement.PreviewKeyDownEvent,
            new KeyEventHandler(OnPreviewKeyDown));
    }

    private static void OnPreviewKeyDown(object sender, KeyEventArgs e)
    {
        if (e.Handled || e.IsRepeat)
        {
            return;
        }

        var key = e.Key == Key.System ? e.SystemKey : e.Key;
        if (key != Key.Space)
        {
            return;
        }

        // Ignore chord shortcuts (e.g. Ctrl+Space).
        var mods = Keyboard.Modifiers;
        if ((mods & (ModifierKeys.Control | ModifierKeys.Alt | ModifierKeys.Windows)) != 0)
        {
            return;
        }

        // NVDA doesn't always speak spaces as typed characters; announce them explicitly.
        _announcer?.AnnounceAssertive("espace");
    }
}
