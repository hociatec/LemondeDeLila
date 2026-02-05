using System;
using System.Linq;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Controls.Primitives;
using System.Windows.Input;
using System.Windows.Threading;
using System.Windows.Media;
using client_win.Modules.Game.History.Views;
using client_win.Modules.Game.Room.Input;
using client_win.Modules.Game.Shell.ViewModels;
using client_win.Modules.Shell.Services;
using client_win.Modules.Shell.Views;

namespace client_win.Modules.Game.Shell.Views;

public partial class GameRoomView : UserControl, IInitialFocusTarget
{
    private ViewModels.GameRoomViewModel? _vm;
    private Action? _focusRequestedHandler;
    private bool _didHookTabCapture;
    private KeyEventHandler? _tabCaptureHandler;
    private IScreenReaderAnnouncer? _screenReader;
    private IAnnouncementService? _announcements;

    public GameRoomView()
    {
        InitializeComponent();
        DataContextChanged += OnDataContextChanged;
        Unloaded += OnUnloaded;
        HookGameZoneTabDelegation();
    }

    public void RequestFocusGameZone() => RequestFocusGameZoneDeferred();

    private void OnLoaded(object sender, System.Windows.RoutedEventArgs e)
    {
        HookTabCapture();
        HookGameZoneTabDelegation();
        HookFocusRequests(DataContext as ViewModels.GameRoomViewModel);

        Dispatcher.BeginInvoke(DispatcherPriority.Input, new Action(() =>
        {
            FocusGameZone();
        }));
    }

    private void OnDataContextChanged(object sender, System.Windows.DependencyPropertyChangedEventArgs e)
    {
        HookFocusRequests(DataContext as ViewModels.GameRoomViewModel);
    }

    private void OnUnloaded(object sender, System.Windows.RoutedEventArgs e)
    {
        HookFocusRequests(null);
        UnhookTabCapture();
    }

    private void HookTabCapture()
    {
        if (_didHookTabCapture)
        {
            return;
        }
        _didHookTabCapture = true;

        _tabCaptureHandler = OnPreviewKeyDown;
        AddHandler(Keyboard.PreviewKeyDownEvent, _tabCaptureHandler, handledEventsToo: true);
    }

    private void UnhookTabCapture()
    {
        if (!_didHookTabCapture || _tabCaptureHandler == null)
        {
            return;
        }

        RemoveHandler(Keyboard.PreviewKeyDownEvent, _tabCaptureHandler);
        _tabCaptureHandler = null;
        _didHookTabCapture = false;
    }

    private void HookFocusRequests(ViewModels.GameRoomViewModel? vm)
    {
        if (_vm != null && _focusRequestedHandler != null)
        {
            _vm.GameZone.FocusRequested -= _focusRequestedHandler;
        }

        _vm = vm;
        _focusRequestedHandler = null;

        if (_vm == null)
        {
            _screenReader = null;
            _announcements = null;
            HistoryHost?.SetScreenReader(null);
            return;
        }

        _screenReader = _vm.ScreenReader;
        _announcements = _vm.Announcements;
        HistoryHost?.SetScreenReader(_screenReader);

        _focusRequestedHandler = () =>
        {
            Dispatcher.BeginInvoke(DispatcherPriority.Input, new Action(FocusGameZone));
        };

        _vm.GameZone.FocusRequested += _focusRequestedHandler;
    }

    private void HookGameZoneTabDelegation()
    {
        if (GameZoneHost is not GameZoneHostView zone)
        {
            return;
        }

        zone.TabToHistoryRequested -= OnGameZoneTabToHistoryRequested;
        zone.TabToHistoryRequested += OnGameZoneTabToHistoryRequested;

        zone.StartRequested -= OnGameZoneStartRequested;
        zone.StartRequested += OnGameZoneStartRequested;
    }

    private void OnGameZoneTabToHistoryRequested(object? sender, EventArgs e)
    {
        Dispatcher.BeginInvoke(DispatcherPriority.Input, new Action(() =>
        {
            if (IsChatEnabled())
            {
                FocusChatInput();
                return;
            }

            FocusHistory();
        }));
    }

    private void OnGameZoneStartRequested(object? sender, EventArgs e)
    {
        if (DataContext is not ViewModels.GameRoomViewModel vm)
        {
            return;
        }

        if (vm.GameZone.StartCommand.CanExecute(null))
        {
            vm.GameZone.StartCommand.Execute(null);
        }
    }

	    private void OnPreviewKeyDown(object sender, KeyEventArgs e)
	    {
	        if (!e.IsRepeat)
	        {
            var key = e.Key == Key.System ? e.SystemKey : e.Key;
            if (key is not (Key.LeftShift or Key.RightShift or Key.LeftCtrl or Key.RightCtrl or Key.LeftAlt or Key.RightAlt or Key.LWin or Key.RWin))
            {
                HistoryHost?.NotifyUserInteraction();
                HistoryHost?.CancelPendingAnnouncementsFromHost();

                // Ne pas couper la lecture du lecteur d'écran quand l'utilisateur lit l'historique
                // (mot par mot / flèches) ou saisit dans un champ texte.
                if (!IsTextInputFocused() && !IsNavigationKey(key))
                {
                    _announcements?.CancelPending(cancelSpeech: false);
                    // Do not force-cancel NVDA speech here: it often re-announces the currently focused control,
                    // which users perceive as "repeating the previous information" before the new one.
                }
            }
        }

	        // Table menu: use F2 (not Escape) to avoid conflicts with game/UI navigation.
	        if (e.Key == Key.F2 && DataContext is ViewModels.GameRoomViewModel vm)
	        {
	            e.Handled = true;

            // N'afficher que les raccourcis réellement disponibles pour l'utilisateur
            // (owner/spectateur/started) et exécutables à l'instant T.
            var all = vm.GameZone.Shortcuts
                .Where(s => s?.Command != null)
                .Where(s =>
                {
                    try
                    {
                        return s.Command != null && s.Command.CanExecute(s.CommandParameter);
                    }
                    catch
                    {
                        return false;
                    }
                })
                .ToList();

            var seen = new System.Collections.Generic.HashSet<string>(StringComparer.OrdinalIgnoreCase);
            var shortcuts = all
                .Where(s => s != null && s.Command != null)
                .Where(s =>
                {
                    var sig = $"{s.Code}|{s.Description}|{s.Key}|{s.Gesture}";
                    return seen.Add(sig);
                })
                .ToList();

            GameActionMenuWindow.ShowAndExecute(
                owner: Window.GetWindow(this) ?? Application.Current?.MainWindow,
                title: $"Menu — {vm.GameZone.Title}",
                shortcuts: shortcuts);

            RequestFocusGameZoneDeferred();
	            return;
	        }

        // R : afficher les règles de la table (boîte de dialogue).
        // Doit fonctionner même pendant une partie; ne pas l'envoyer au serveur.
        if (!IsTextInputFocused() &&
            (Keyboard.Modifiers & (ModifierKeys.Control | ModifierKeys.Alt | ModifierKeys.Windows)) == ModifierKeys.None &&
            (e.Key == Key.R || (e.Key == Key.System && e.SystemKey == Key.R)) &&
            DataContext is ViewModels.GameRoomViewModel rulesVm &&
            rulesVm.GameZone.RulesCommand.CanExecute(null))
        {
            e.Handled = true;
            rulesVm.GameZone.RulesCommand.Execute(null);
            RequestFocusGameZoneDeferred();
            return;
        }

	        // Démarrage table (accessibilité): Entrée doit fonctionner même si le focus n'est pas exactement sur l'ancre
	        // (après ajout de bot / annonces / navigation SR, WPF peut déplacer le focus).
	        if ((e.Key == Key.Enter || e.Key == Key.Return) &&
	            DataContext is ViewModels.GameRoomViewModel startVm &&
	            !IsTextInputFocused() &&
	            startVm.GameZone.IsStarted == false &&
	            startVm.GameZone.StartCommand.CanExecute(null))
	        {
	            e.Handled = true;
	            startVm.GameZone.StartCommand.Execute(null);
	            RequestFocusGameZoneDeferred();
	            return;
	        }

	        if (e.Key != Key.Tab)
	        {
	            return;
	        }

        // NOTE: Gestion volontairement impérative (code-behind) pour fiabiliser Tab/Maj+Tab avec les lecteurs d'écran :
        // WPF peut "absorber" la navigation quand le focus est dans un TextBox (historique) ou sur un ContentControl vide.
        // Ici on force explicitement le basculement Zone de jeu <-> Historique pour garantir l'accessibilité.
        // On laisse WPF gérer la navigation interne aux contrôles (futurs contrôles de jeu).
        e.Handled = true;

        var shift = (Keyboard.Modifiers & ModifierKeys.Shift) == ModifierKeys.Shift;

        if (HistoryHost?.IsKeyboardFocusWithin == true)
        {
            if (shift)
            {
                if (IsChatEnabled())
                {
                    FocusChatInput();
                    return;
                }

                FocusGameZone();
                return;
            }

            FocusGameZone();
            return;
        }

        if (ChatInput?.IsKeyboardFocusWithin == true || ChatHost?.IsKeyboardFocusWithin == true)
        {
            if (shift)
            {
                FocusGameZone();
                return;
            }

            FocusHistory();
            return;
        }

        if (GameZoneHost?.IsKeyboardFocusWithin == true)
        {
            if (shift)
            {
                FocusHistory();
                return;
            }

            if (IsChatEnabled())
            {
                FocusChatInput();
                return;
            }

            FocusHistory();
            return;
        }

        if (shift)
        {
            FocusGameZone();
            return;
        }

        if (IsChatEnabled())
        {
            FocusChatInput();
            return;
        }

        FocusHistory();

        // Ne pas intercepter Tab quand le focus est déjà dans la zone de jeu : elle délègue (Tab -> Historique).
        // Ici on ne force Tab vers la zone de jeu que si l'utilisateur n'est ni dans l'historique ni dans la zone de jeu.
        return;
    }

    private void FocusGameZone()
    {
        if (GameZoneHost is GameZoneHostView zone)
        {
            zone.FocusGameZone();
        }
    }

    private void RequestFocusGameZoneDeferred()
    {
        try
        {
            (Window.GetWindow(this) ?? Application.Current?.MainWindow)?.Activate();
        }
        catch
        {
            // ignore
        }

        // Le retour de focus après un ShowDialog / une navigation peut être "en retard" :
        // on demande un focus immédiat puis un second passage à l'idle pour fiabiliser.
        Dispatcher.BeginInvoke(DispatcherPriority.Input, new Action(FocusGameZone));
        Dispatcher.BeginInvoke(DispatcherPriority.ApplicationIdle, new Action(FocusGameZone));
    }

    private void FocusHistory()
    {
        if (HistoryHost == null)
        {
            return;
        }

        var target = HistoryHost.FocusTarget ?? (HistoryHost as FrameworkElement);
        if (target != null)
        {
            target.Focus();
            Keyboard.Focus(target);
        }

        HistoryHost.FocusToBottom();
    }

    private bool IsChatEnabled()
    {
        return DataContext is GameRoomViewModel vm && vm.Chat?.IsEnabled == true && ChatHost?.Visibility == Visibility.Visible;
    }

    private void FocusChatInput()
    {
        if (ChatInput != null && ChatHost?.Visibility == Visibility.Visible)
        {
            ChatInput.Focus();
            Keyboard.Focus(ChatInput);
            return;
        }

        FocusHistory();
    }

    private bool IsTextInputFocused()
    {
        var focused = Keyboard.FocusedElement as DependencyObject;
        while (focused != null)
        {
            if (focused is TextBoxBase || focused is PasswordBox)
            {
                return true;
            }

            focused = VisualTreeHelper.GetParent(focused);
        }

        return false;
    }

    private static bool IsNavigationKey(Key key)
    {
        return key is Key.Left
            or Key.Right
            or Key.Up
            or Key.Down
            or Key.Home
            or Key.End
            or Key.PageUp
            or Key.PageDown;
    }

    private void OnChatInputPreviewKeyDown(object sender, KeyEventArgs e)
    {
        var key = e.Key == Key.System ? e.SystemKey : e.Key;
        if (key is not (Key.Enter or Key.Return))
        {
            return;
        }

        if (DataContext is not GameRoomViewModel vm)
        {
            return;
        }

        if (vm.Chat.SendCommand.CanExecute(null))
        {
            e.Handled = true;
            vm.Chat.SendCommand.Execute(null);
        }
    }

    public void RequestInitialFocus()
    {
        RequestFocusGameZoneDeferred();
    }
}
