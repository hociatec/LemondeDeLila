using System;
using System.Collections.Generic;
using System.Linq;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Input;
using System.Windows.Threading;
using client_win.Core.Input;
using client_win.Modules.Game.History.Views;
using client_win.Modules.Game.Shell.ViewModels;

namespace client_win.Modules.Game.Shell.Views;

public partial class GameRoomView : UserControl
{
    private ViewModels.GameRoomViewModel? _vm;
    private Action? _focusRequestedHandler;
    private bool _didHookTabCapture;
    private KeyEventHandler? _tabCaptureHandler;

    public GameRoomView()
    {
        InitializeComponent();
        DataContextChanged += OnDataContextChanged;
        Unloaded += OnUnloaded;
        HookHistoryTabDelegation();
        HookGameZoneTabDelegation();
    }

    public void RequestFocusGameZone() => FocusGameZone();

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
        CancelHistoryAnnouncementsOnInteraction(e);

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

            Dispatcher.BeginInvoke(DispatcherPriority.Input, new Action(FocusGameZone));
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

    private void CancelHistoryAnnouncementsOnInteraction(KeyEventArgs e)
    {
        if (e == null || e.IsRepeat)
        {
            return;
        }

        // IMPORTANT: on annule les annonces "jeu" dès qu'il y a une interaction clavier,
        // mais on ne doit pas annuler sur les raccourcis (jeu/table) sinon on perd des annonces.
        if (DataContext is not GameRoomViewModel vm)
        {
            return;
        }

        var key = e.Key == Key.System ? e.SystemKey : e.Key;
        if (key is Key.LeftShift or Key.RightShift or Key.LeftCtrl or Key.RightCtrl or Key.LeftAlt or Key.RightAlt or Key.LWin or Key.RWin)
        {
            return;
        }

        if (IsShortcutKey(e, vm.GameZone?.Shortcuts))
        {
            return;
        }

        HistoryHost?.CancelPendingAnnouncementsFromHost();
    }

    private static bool IsShortcutKey(KeyEventArgs e, IEnumerable<ShortcutDefinition>? shortcuts)
    {
        if (shortcuts == null)
        {
            return false;
        }

        var key = e.Key == Key.System ? e.SystemKey : e.Key;
        var modifiers = Keyboard.Modifiers;

        // 1) KeyGesture shortcuts
        var list = shortcuts.Where(s => s != null).ToList();
        foreach (var shortcut in list)
        {
            if (shortcut?.Gesture == null)
            {
                continue;
            }

            if (shortcut.Gesture.Key == key && shortcut.Gesture.Modifiers == modifiers)
            {
                return true;
            }
        }

        // 2) Char shortcuts (lettres)
        var typed = TryKeyToChar(key);
        if (typed == null)
        {
            return false;
        }

        var hasCtrlAltWin = (modifiers & (ModifierKeys.Control | ModifierKeys.Alt | ModifierKeys.Windows)) != ModifierKeys.None;
        if (hasCtrlAltWin)
        {
            return false;
        }

        foreach (var shortcut in list)
        {
            if (shortcut?.Key == null)
            {
                continue;
            }

            if (shortcut.Key.Value == typed.Value)
            {
                return true;
            }
        }

        // Fallback insensible à la casse uniquement si une distinction explicite n'existe pas (b/B).
        if (char.IsLetter(typed.Value))
        {
            var lower = char.ToLowerInvariant(typed.Value);
            var upperExactExists = list.Any(s => s.Key == char.ToUpperInvariant(lower));
            var lowerExactExists = list.Any(s => s.Key == lower);
            if (!(upperExactExists && lowerExactExists))
            {
                foreach (var shortcut in list)
                {
                    if (shortcut?.Key == null)
                    {
                        continue;
                    }

                    if (!char.IsLetter(shortcut.Key.Value))
                    {
                        continue;
                    }

                    if (char.ToLowerInvariant(shortcut.Key.Value) == lower)
                    {
                        return true;
                    }
                }
            }
        }

        return false;
    }

    private static char? TryKeyToChar(Key key)
    {
        if (key >= Key.A && key <= Key.Z)
        {
            var shift = (Keyboard.Modifiers & ModifierKeys.Shift) == ModifierKeys.Shift;
            var capsLock = Keyboard.IsKeyToggled(Key.CapsLock);
            var upper = shift ^ capsLock;

            var offset = key - Key.A;
            var c = (char)('a' + offset);
            return upper ? char.ToUpperInvariant(c) : c;
        }

        if (key >= Key.D0 && key <= Key.D9)
        {
            var offset = key - Key.D0;
            return (char)('0' + offset);
        }

        if (key >= Key.NumPad0 && key <= Key.NumPad9)
        {
            var offset = key - Key.NumPad0;
            return (char)('0' + offset);
        }

        return null;
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
