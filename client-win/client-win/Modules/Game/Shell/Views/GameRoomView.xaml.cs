using System;
using System.Linq;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Controls.Primitives;
using System.Windows.Input;
using System.Windows.Threading;
using System.Windows.Media;
using client_win.Modules.Game.History.Views;
using client_win.Modules.Game.Shell.ViewModels;
using client_win.Modules.Shell.Services;

namespace client_win.Modules.Game.Shell.Views;

public partial class GameRoomView : UserControl
{
    private ViewModels.GameRoomViewModel? _vm;
    private Action? _focusRequestedHandler;
    private bool _didHookTabCapture;
    private KeyEventHandler? _tabCaptureHandler;
    private IScreenReaderAnnouncer? _screenReader;

    public GameRoomView()
    {
        InitializeComponent();
        DataContextChanged += OnDataContextChanged;
        Unloaded += OnUnloaded;
        HookHistoryTabDelegation();
        HookGameZoneTabDelegation();
    }

    public void RequestFocusGameZone() => RequestFocusGameZoneDeferred();

    public void SetScreenReader(IScreenReaderAnnouncer? screenReader)
    {
        _screenReader = screenReader;
        HistoryHost?.SetScreenReader(screenReader);
    }

    private void OnLoaded(object sender, System.Windows.RoutedEventArgs e)
    {
        HookTabCapture();
        HookHistoryTabDelegation();
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
            return;
        }

        _focusRequestedHandler = () =>
        {
            Dispatcher.BeginInvoke(DispatcherPriority.Input, new Action(FocusGameZone));
        };

        _vm.GameZone.FocusRequested += _focusRequestedHandler;
    }

    private void HookHistoryTabDelegation()
    {
        if (HistoryHost == null)
        {
            return;
        }

        HistoryHost.TabNavigationRequested -= OnHistoryTabNavigationRequested;
        HistoryHost.TabNavigationRequested += OnHistoryTabNavigationRequested;
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
                    _screenReader?.CancelSpeech();
                }
            }
        }

        if (e.Key == Key.Escape && DataContext is ViewModels.GameRoomViewModel vm && vm.GameZone.IsStarted)
        {
            e.Handled = true;

            var shortcuts = vm.GameZone.Shortcuts
                .Where(s => s?.Command != null)
                .ToList();

            GameActionMenuWindow.ShowAndExecute(
                owner: Window.GetWindow(this) ?? Application.Current?.MainWindow,
                title: $"Menu — {vm.GameZone.Title}",
                shortcuts: shortcuts);

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
            if (shift && IsChatEnabled())
            {
                FocusChatInput();
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

    private void OnHistoryTabNavigationRequested(object? sender, TabNavigationRequestedEventArgs e)
    {
        Dispatcher.BeginInvoke(DispatcherPriority.Input, new Action(() =>
        {
            if (e.IsShiftPressed && IsChatEnabled())
            {
                FocusChatInput();
                return;
            }

            FocusGameZone();
        }));
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
        var target = HistoryHost?.FocusTarget;
        if (target != null)
        {
            target.Focus();
            Keyboard.Focus(target);
            return;
        }

        // Fallback (ne devrait pas arriver)
        HistoryHost?.Focus();
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
        if (e.Key != Key.Enter)
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
}
