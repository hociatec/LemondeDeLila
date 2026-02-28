using System;
using System.Collections.Generic;
using System.ComponentModel;
using System.Linq;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Controls.Primitives;
using System.Windows.Input;
using System.Windows.Media;
using System.Windows.Threading;
using client_win.Modules.Game.History.Views;
using client_win.Modules.Game.Room.Input;
using client_win.Modules.Game.Shell.Services;
using client_win.Modules.Game.Shell.ViewModels;
using client_win.Modules.Shell.Services;
using client_win.Modules.Shell.Views;

namespace client_win.Modules.Game.Shell.Views;

public partial class GameRoomView : UserControl, IInitialFocusTarget, IGameFocusHost
{
    private ViewModels.GameRoomViewModel? _vm;
    private IDisposable? _focusHostLease;
    private bool _didHookTabCapture;
    private KeyEventHandler? _tabCaptureHandler;
    private PropertyChangedEventHandler? _vmPropertyChangedHandler;
    private IScreenReaderAnnouncer? _screenReader;
    private IAnnouncementService? _announcements;
    private int _startWizardConfigFocusRequestId;
    private EventHandler? _startWizardAmbienceGeneratorStatusChanged;
    private EventHandler? _startWizardAmbienceLayoutUpdated;
    private EventHandler? _startWizardConfigLayoutUpdated;

    public GameRoomView()
    {
        InitializeComponent();
        DataContextChanged += OnDataContextChanged;
        Unloaded += OnUnloaded;
        if (StartWizardOverlay != null)
        {
            StartWizardOverlay.IsVisibleChanged += OnStartWizardOverlayIsVisibleChanged;
        }
        HookGameZoneTabDelegation();
    }

    public void RequestFocusGameZone(GameFocusReason reason = GameFocusReason.Default) => RequestFocusGameZoneInternal(reason);

    private void OnLoaded(object sender, System.Windows.RoutedEventArgs e)
    {
        HookTabCapture();
        if (StartWizardOverlay != null)
        {
            StartWizardOverlay.IsVisibleChanged -= OnStartWizardOverlayIsVisibleChanged;
            StartWizardOverlay.IsVisibleChanged += OnStartWizardOverlayIsVisibleChanged;
        }
        HookGameZoneTabDelegation();
        HookFocusRequests(DataContext as ViewModels.GameRoomViewModel);

        RequestFocusGameZoneInternal(GameFocusReason.InitialLoad);
    }

    private void OnDataContextChanged(object sender, System.Windows.DependencyPropertyChangedEventArgs e)
    {
        HookFocusRequests(DataContext as ViewModels.GameRoomViewModel);
    }

    private void OnUnloaded(object sender, System.Windows.RoutedEventArgs e)
    {
        HookFocusRequests(null);
        UnhookTabCapture();
        UnhookStartWizardAmbienceFocusObservers();
        UnhookStartWizardConfigFocusObserver();
        if (StartWizardOverlay != null)
        {
            StartWizardOverlay.IsVisibleChanged -= OnStartWizardOverlayIsVisibleChanged;
        }
    }

    private void OnStartWizardOverlayIsVisibleChanged(object sender, DependencyPropertyChangedEventArgs e)
    {
        if (e.NewValue is not bool isVisible)
        {
            return;
        }

        if (!isVisible)
        {
            UnhookStartWizardAmbienceFocusObservers();
            UnhookStartWizardConfigFocusObserver();
            return;
        }

        _ = Dispatcher.BeginInvoke(
            DispatcherPriority.Input,
            new Action(FocusStartWizardPrimary));
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
        _focusHostLease?.Dispose();
        _focusHostLease = null;
        if (_vm != null && _vmPropertyChangedHandler != null)
        {
            _vm.PropertyChanged -= _vmPropertyChangedHandler;
            _vmPropertyChangedHandler = null;
        }

        _vm = vm;

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
        _focusHostLease = _vm.GameZone.FocusCoordinator.AttachHost(this);
        _vmPropertyChangedHandler = OnViewModelPropertyChanged;
        _vm.PropertyChanged += _vmPropertyChangedHandler;
    }

    private void OnViewModelPropertyChanged(object? sender, PropertyChangedEventArgs e)
    {
        if (sender is not GameRoomViewModel vm)
        {
            return;
        }

        if (string.Equals(e.PropertyName, nameof(GameRoomViewModel.IsStartWizardConfigLoading), StringComparison.Ordinal) &&
            vm.IsStartWizardOpen &&
            vm.IsStartWizardConfigStep &&
            !vm.IsStartWizardConfigLoading)
        {
            _ = Dispatcher.BeginInvoke(
                DispatcherPriority.Input,
                new Action(RequestFocusStartWizardConfigFirst));
            return;
        }

        if (string.Equals(e.PropertyName, nameof(GameRoomViewModel.IsStartWizardOpen), StringComparison.Ordinal) &&
            vm.IsStartWizardOpen)
        {
            _ = Dispatcher.BeginInvoke(
                DispatcherPriority.Input,
                new Action(FocusStartWizardPrimary));
            return;
        }

        if (string.Equals(e.PropertyName, nameof(GameRoomViewModel.IsStartWizardAmbienceStep), StringComparison.Ordinal) &&
            vm.IsStartWizardOpen &&
            vm.IsStartWizardAmbienceStep)
        {
            _ = Dispatcher.BeginInvoke(
                DispatcherPriority.Input,
                new Action(FocusStartWizardPrimary));
            return;
        }

        if (string.Equals(e.PropertyName, nameof(GameRoomViewModel.HasStartWizardConfig), StringComparison.Ordinal) &&
            vm.IsStartWizardOpen &&
            vm.IsStartWizardConfigStep &&
            vm.HasStartWizardConfig)
        {
            _ = Dispatcher.BeginInvoke(
                DispatcherPriority.Input,
                new Action(RequestFocusStartWizardConfigFirst));
        }
    }

    private void HookGameZoneTabDelegation()
    {
        if (GameZoneHost is not GameZoneHostView zone)
        {
            return;
        }

        zone.StartRequested -= OnGameZoneStartRequested;
        zone.StartRequested += OnGameZoneStartRequested;
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
        var key = e.Key == Key.System ? e.SystemKey : e.Key;

	        if (!e.IsRepeat)
	        {
            if (key is not (Key.LeftShift or Key.RightShift or Key.LeftCtrl or Key.RightCtrl or Key.LeftAlt or Key.RightAlt or Key.LWin or Key.RWin))
            {
                HistoryHost?.NotifyUserInteraction();
                HistoryHost?.CancelPendingAnnouncementsFromHost();
                _announcements?.NotifyUserInteraction();

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

        if (DataContext is ViewModels.GameRoomViewModel wizardVm &&
            wizardVm.IsStartWizardOpen)
        {
            if (!IsFocusWithinStartWizard())
            {
                _ = Dispatcher.BeginInvoke(
                    DispatcherPriority.Input,
                    new Action(FocusStartWizardPrimary));
            }

            if (key == Key.Escape)
            {
                e.Handled = true;
                return;
            }

            if (key == Key.Tab)
            {
                e.Handled = true;
                var backwards = (Keyboard.Modifiers & ModifierKeys.Shift) == ModifierKeys.Shift;
                CycleStartWizardFocus(backwards);
                return;
            }

            if (key == Key.Space &&
                wizardVm.IsStartWizardAmbienceStep &&
                StartWizardChoicesList != null &&
                IsFocusWithinElement(StartWizardChoicesList))
            {
                e.Handled = true;
                wizardVm.PreviewSelectedStartWizardAmbience();
                return;
            }

            if (key is Key.Enter or Key.Return)
            {
                if (e.IsRepeat)
                {
                    e.Handled = true;
                    return;
                }

                e.Handled = true;
                if (TryGetFocusedStartWizardFooterButton(out var focusedButton))
                {
                    if (ReferenceEquals(focusedButton, StartWizardPreviousButton))
                    {
                        wizardVm.GoPreviousStartWizardStep();
                        _ = Dispatcher.BeginInvoke(
                            DispatcherPriority.Input,
                            new Action(FocusStartWizardPrimary));
                        return;
                    }

                    if (ReferenceEquals(focusedButton, StartWizardCancelButton))
                    {
                        wizardVm.CancelStartWizard();
                        _ = Dispatcher.BeginInvoke(
                            DispatcherPriority.Input,
                            new Action(() => RequestFocusGameZoneInternal(GameFocusReason.AfterDialog)));
                        return;
                    }

                    if (ReferenceEquals(focusedButton, StartWizardNextButton))
                    {
                        _ = GoNextStartWizardStepAndFocusAsync(wizardVm);
                        return;
                    }

                    if (ReferenceEquals(focusedButton, StartWizardStartButton))
                    {
                        _ = wizardVm.ConfirmStartWizardAsync();
                        return;
                    }
                }

                // Enter has no global wizard action: only footer buttons can validate navigation/actions.
                return;
            }
            return;
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

            RequestFocusGameZoneInternal(GameFocusReason.AfterDialog);
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
            RequestFocusGameZoneInternal(GameFocusReason.AfterDialog);
            return;
        }

	        // Démarrage table (accessibilité): Entrée doit fonctionner même si le focus n'est pas exactement sur l'ancre
	        // (après ajout de bot / annonces / navigation SR, WPF peut déplacer le focus).
	        if (!e.Handled &&
                key is Key.Enter or Key.Return &&
	            DataContext is ViewModels.GameRoomViewModel startVm &&
	            !IsTextInputFocused() &&
                !startVm.IsStartWizardOpen &&
	            startVm.GameZone.IsStarted == false &&
	            startVm.GameZone.StartCommand.CanExecute(null))
	        {
                if (e.IsRepeat)
                {
                    e.Handled = true;
                    return;
                }

	            e.Handled = true;
	            startVm.GameZone.StartCommand.Execute(null);
	            return;
	        }

        if (e.Key == Key.Tab)
        {
            e.Handled = true;
            var backwards = (Keyboard.Modifiers & ModifierKeys.Shift) == ModifierKeys.Shift;
            CycleTabFocus(backwards);
            return;
        }
    }

    private void RequestFocusGameZoneInternal(GameFocusReason reason)
    {
        if (_vm != null)
        {
            if (_vm.IsStartWizardOpen)
            {
                _ = Dispatcher.BeginInvoke(
                    DispatcherPriority.Input,
                    new Action(FocusStartWizardPrimary));
                return;
            }

            _vm.GameZone.FocusCoordinator.RequestGameZone(reason);
            return;
        }

        // Fallback: view loaded before DataContext binding.
        FocusGameZone(reason);
    }

    public void ActivateWindow()
    {
        try
        {
            (Window.GetWindow(this) ?? Application.Current?.MainWindow)?.Activate();
        }
        catch
        {
            // ignore
        }
    }

    public GameFocusAttemptResult FocusGameZone(GameFocusReason reason)
    {
        if (_vm?.IsStartWizardOpen == true)
        {
            _ = Dispatcher.BeginInvoke(
                DispatcherPriority.Input,
                new Action(FocusStartWizardPrimary));
            return GameFocusAttemptResult.None;
        }

        if (GameZoneHost is GameZoneHostView zone)
        {
            return zone.FocusGameZone(reason);
        }

        return GameFocusAttemptResult.None;
    }

    private void FocusHistory()
    {
        _vm?.GameZone.FocusCoordinator.CancelPendingRequests();

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
        return DataContext is GameRoomViewModel vm
               && vm.Chat?.IsEnabled == true
               && vm.Chat.IsConnected
               && ChatHost?.Visibility == Visibility.Visible
               && ChatInput?.IsEnabled == true;
    }

    private void FocusChatInput()
    {
        _vm?.GameZone.FocusCoordinator.CancelPendingRequests();

        if (ChatInput != null && ChatInput.IsEnabled && ChatHost?.Visibility == Visibility.Visible)
        {
            ChatInput.Focus();
            Keyboard.Focus(ChatInput);
            return;
        }

        FocusHistory();
    }

    private void CycleTabFocus(bool backwards)
    {
        var regions = GetAvailableFocusRegions();
        if (!regions.Any())
        {
            return;
        }

        var current = GetCurrentFocusRegion();
        var index = regions.IndexOf(current ?? regions.First());
        if (index < 0)
        {
            index = backwards ? regions.Count - 1 : 0;
        }
        else
        {
            index = (index + (backwards ? -1 : 1) + regions.Count) % regions.Count;
        }

        FocusOnRegion(regions[index]);
    }

    private enum FocusRegionKind
    {
        Chat,
        History,
        GameZone,
    }

    private List<FocusRegionKind> GetAvailableFocusRegions()
    {
        var regions = new List<FocusRegionKind>();
        if (IsChatEnabled())
        {
        regions.Add(FocusRegionKind.Chat);
        }

        if (IsHistoryEnabled())
        {
        regions.Add(FocusRegionKind.History);
        }

        if (GameZoneHost != null)
        {
        regions.Add(FocusRegionKind.GameZone);
        }

        return regions;
    }

    private FocusRegionKind? GetCurrentFocusRegion()
    {
        if (ChatHost?.IsKeyboardFocusWithin == true)
        {
            return FocusRegionKind.Chat;
        }

        if (HistoryHost?.IsKeyboardFocusWithin == true)
        {
            return FocusRegionKind.History;
        }

        if (GameZoneHost?.IsKeyboardFocusWithin == true)
        {
            return FocusRegionKind.GameZone;
        }

        return null;
    }

    private void FocusOnRegion(FocusRegionKind region)
    {
        if (region is FocusRegionKind.Chat or FocusRegionKind.History)
        {
            _vm?.GameZone.FocusCoordinator.CancelPendingRequests();
        }

        switch (region)
        {
            case FocusRegionKind.Chat:
                FocusChatInput();
                break;
            case FocusRegionKind.History:
                FocusHistory();
                break;
            case FocusRegionKind.GameZone:
                RequestFocusGameZoneInternal(GameFocusReason.TabCycle);
                break;
        }
    }

    private bool IsFocusWithinStartWizard()
    {
        if (StartWizardOverlay == null || StartWizardOverlay.Visibility != Visibility.Visible)
        {
            return false;
        }

        DependencyObject? focused = Keyboard.FocusedElement as DependencyObject;
        if (focused == null)
        {
            return false;
        }

        while (focused != null)
        {
            if (ReferenceEquals(focused, StartWizardOverlay))
            {
                return true;
            }

            focused = GetVisualOrLogicalParent(focused);
        }

        return false;
    }

    private void FocusStartWizardPrimary()
    {
        if (DataContext is not GameRoomViewModel vm ||
            StartWizardOverlay == null ||
            StartWizardOverlay.Visibility != Visibility.Visible)
        {
            return;
        }

        if (vm.IsStartWizardAmbienceStep && StartWizardChoicesList != null && StartWizardChoicesList.Visibility == Visibility.Visible)
        {
            if (StartWizardChoicesList.SelectedIndex < 0 && StartWizardChoicesList.Items.Count > 0)
            {
                StartWizardChoicesList.SelectedIndex = 0;
            }
            RequestFocusStartWizardAmbienceFirst();
            return;
        }

        if (vm.IsStartWizardConfigStep)
        {
            RequestFocusStartWizardConfigFirst();
            return;
        }

        var focusables = new List<Control>();
        CollectFocusableControls(StartWizardOverlay, focusables);
        var first = focusables.FirstOrDefault(c => c.IsVisible && c.IsEnabled);
        if (first != null)
        {
            first.Focus();
            Keyboard.Focus(first);
            return;
        }

        StartWizardOverlay.Focus();
        Keyboard.Focus(StartWizardOverlay);
    }

    private void CycleStartWizardFocus(bool backwards)
    {
        if (StartWizardOverlay == null || StartWizardOverlay.Visibility != Visibility.Visible)
        {
            return;
        }

        var focusables = BuildStartWizardFocusOrder();
        if (focusables.Count == 0)
        {
            FocusStartWizardPrimary();
            return;
        }

        var current = Keyboard.FocusedElement as DependencyObject;
        var currentControl = FindAncestorControl(current);
        var idx = currentControl != null ? focusables.IndexOf(currentControl) : -1;
        var nextIdx = backwards
            ? (idx <= 0 ? focusables.Count - 1 : idx - 1)
            : (idx < 0 || idx >= focusables.Count - 1 ? 0 : idx + 1);

        var target = focusables[nextIdx];
        target.Focus();
        Keyboard.Focus(target);
    }

    private List<Control> BuildStartWizardFocusOrder()
    {
        var ordered = new List<Control>();

        if (DataContext is not GameRoomViewModel vm ||
            StartWizardOverlay == null ||
            StartWizardOverlay.Visibility != Visibility.Visible)
        {
            return ordered;
        }

        if (vm.IsStartWizardAmbienceStep)
        {
            AddFocusable(ordered, StartWizardNextButton);
            AddFocusable(ordered, StartWizardStartButton);
            AddFocusable(ordered, StartWizardCancelButton);
            return ordered;
        }

        if (vm.IsStartWizardConfigStep)
        {
            if (!vm.IsStartWizardConfigLoading)
            {
                var configFocusables = new List<Control>();
                if (StartWizardConfigItems != null)
                {
                    CollectFocusableControls(StartWizardConfigItems, configFocusables);
                    foreach (var c in configFocusables)
                    {
                        AddFocusable(ordered, c);
                    }
                }
            }

            AddFocusable(ordered, StartWizardPreviousButton);
            AddFocusable(ordered, StartWizardCancelButton);
            AddFocusable(ordered, StartWizardStartButton);
        }

        return ordered;
    }

    private static void AddFocusable(ICollection<Control> target, Control? control)
    {
        if (control == null || !control.IsVisible || !control.IsEnabled)
        {
            return;
        }

        if (!KeyboardNavigation.GetIsTabStop(control))
        {
            return;
        }

        target.Add(control);
    }

    private async System.Threading.Tasks.Task GoNextStartWizardStepAndFocusAsync(GameRoomViewModel vm)
    {
        if (vm == null)
        {
            return;
        }

        try
        {
            await vm.GoNextStartWizardStepAsync().ConfigureAwait(true);
        }
        catch
        {
            // best-effort
        }
        finally
        {
            _ = Dispatcher.BeginInvoke(
                DispatcherPriority.Input,
                new Action(FocusStartWizardPrimary));
        }
    }

    private void RequestFocusStartWizardAmbienceFirst()
    {
        var requestId = unchecked(++_startWizardConfigFocusRequestId);
        _ = Dispatcher.BeginInvoke(
            DispatcherPriority.Render,
            new Action(() =>
            {
                if (TryFocusStartWizardAmbienceFirstNow(requestId))
                {
                    UnhookStartWizardAmbienceFocusObservers();
                    return;
                }

                HookStartWizardAmbienceFocusObservers(requestId);
            }));
    }

    private bool TryFocusStartWizardAmbienceFirstNow(int requestId)
    {
        if (requestId != _startWizardConfigFocusRequestId)
        {
            return false;
        }

        if (DataContext is not GameRoomViewModel vm ||
            !vm.IsStartWizardOpen ||
            !vm.IsStartWizardAmbienceStep ||
            StartWizardChoicesList == null ||
            StartWizardChoicesList.Visibility != Visibility.Visible)
        {
            return false;
        }

        if (StartWizardChoicesList.SelectedIndex < 0 && StartWizardChoicesList.Items.Count > 0)
        {
            StartWizardChoicesList.SelectedIndex = 0;
        }
        // Perf: avoid forcing a synchronous layout pass here.
        if (StartWizardChoicesList.ItemContainerGenerator.Status != GeneratorStatus.ContainersGenerated)
        {
            return false;
        }

        var index = StartWizardChoicesList.SelectedIndex;
        if (index >= 0)
        {
            StartWizardChoicesList.ScrollIntoView(StartWizardChoicesList.Items[index]);
            if (StartWizardChoicesList.ItemContainerGenerator.ContainerFromIndex(index) is ListBoxItem item)
            {
                item.Focus();
                Keyboard.Focus(item);
                return true;
            }
        }

        return false;
    }

    private void HookStartWizardAmbienceFocusObservers(int requestId)
    {
        if (StartWizardChoicesList == null)
        {
            return;
        }

        UnhookStartWizardAmbienceFocusObservers();
        _startWizardAmbienceGeneratorStatusChanged = (_, _) =>
        {
            if (requestId != _startWizardConfigFocusRequestId)
            {
                UnhookStartWizardAmbienceFocusObservers();
                return;
            }

            if (TryFocusStartWizardAmbienceFirstNow(requestId))
            {
                UnhookStartWizardAmbienceFocusObservers();
            }
        };
        _startWizardAmbienceLayoutUpdated = (_, _) =>
        {
            if (requestId != _startWizardConfigFocusRequestId)
            {
                UnhookStartWizardAmbienceFocusObservers();
                return;
            }

            if (TryFocusStartWizardAmbienceFirstNow(requestId))
            {
                UnhookStartWizardAmbienceFocusObservers();
                return;
            }

            if (StartWizardChoicesList.ItemContainerGenerator.Status == GeneratorStatus.ContainersGenerated)
            {
                StartWizardChoicesList.Focus();
                Keyboard.Focus(StartWizardChoicesList);
                UnhookStartWizardAmbienceFocusObservers();
            }
        };
        StartWizardChoicesList.ItemContainerGenerator.StatusChanged += _startWizardAmbienceGeneratorStatusChanged;
        StartWizardChoicesList.LayoutUpdated += _startWizardAmbienceLayoutUpdated;
    }

    private void RequestFocusStartWizardConfigFirst()
    {
        var requestId = unchecked(++_startWizardConfigFocusRequestId);
        _ = Dispatcher.BeginInvoke(
            DispatcherPriority.Loaded,
            new Action(() =>
            {
                if (TryFocusStartWizardConfigFirstNow(requestId))
                {
                    UnhookStartWizardConfigFocusObserver();
                    return;
                }

                HookStartWizardConfigFocusObserver(requestId);
            }));
    }

    private bool TryFocusStartWizardConfigFirstNow(int requestId)
    {
        if (requestId != _startWizardConfigFocusRequestId)
        {
            return false;
        }

        if (DataContext is not GameRoomViewModel vm ||
            !vm.IsStartWizardOpen ||
            !vm.IsStartWizardConfigStep ||
            StartWizardOverlay == null ||
            StartWizardOverlay.Visibility != Visibility.Visible)
        {
            return false;
        }

        if (TryFocusFirstConfigControlNow())
        {
            return true;
        }

        return false;
    }

    private void HookStartWizardConfigFocusObserver(int requestId)
    {
        if (StartWizardOverlay == null)
        {
            return;
        }

        UnhookStartWizardConfigFocusObserver();
        _startWizardConfigLayoutUpdated = (_, _) =>
        {
            if (requestId != _startWizardConfigFocusRequestId)
            {
                UnhookStartWizardConfigFocusObserver();
                return;
            }

            if (TryFocusStartWizardConfigFirstNow(requestId))
            {
                UnhookStartWizardConfigFocusObserver();
                return;
            }

            StartWizardOverlay.Focus();
            Keyboard.Focus(StartWizardOverlay);
            UnhookStartWizardConfigFocusObserver();
        };
        StartWizardOverlay.LayoutUpdated += _startWizardConfigLayoutUpdated;
    }

    private void UnhookStartWizardAmbienceFocusObservers()
    {
        if (StartWizardChoicesList == null)
        {
            return;
        }

        try
        {
            if (_startWizardAmbienceGeneratorStatusChanged != null)
            {
                StartWizardChoicesList.ItemContainerGenerator.StatusChanged -= _startWizardAmbienceGeneratorStatusChanged;
            }

            if (_startWizardAmbienceLayoutUpdated != null)
            {
                StartWizardChoicesList.LayoutUpdated -= _startWizardAmbienceLayoutUpdated;
            }
        }
        catch
        {
            // best-effort
        }
        finally
        {
            _startWizardAmbienceGeneratorStatusChanged = null;
            _startWizardAmbienceLayoutUpdated = null;
        }
    }

    private void UnhookStartWizardConfigFocusObserver()
    {
        if (StartWizardOverlay == null)
        {
            return;
        }

        try
        {
            if (_startWizardConfigLayoutUpdated != null)
            {
                StartWizardOverlay.LayoutUpdated -= _startWizardConfigLayoutUpdated;
            }
        }
        catch
        {
            // best-effort
        }
        finally
        {
            _startWizardConfigLayoutUpdated = null;
        }
    }

    private bool TryFocusFirstConfigControlNow()
    {
        if (DataContext is GameRoomViewModel vmLoading &&
            vmLoading.IsStartWizardConfigLoading &&
            StartWizardConfigLoadingText != null &&
            StartWizardConfigLoadingText.Visibility == Visibility.Visible)
        {
            StartWizardConfigLoadingText.Focus();
            Keyboard.Focus(StartWizardConfigLoadingText);
            return true;
        }

        if (StartWizardConfigItems == null || StartWizardConfigItems.Visibility != Visibility.Visible)
        {
            return false;
        }

        var configFocusables = new List<Control>();
        CollectFocusableControls(StartWizardConfigItems, configFocusables);
        var firstConfig = configFocusables.FirstOrDefault(c => c.IsVisible && c.IsEnabled);
        if (firstConfig != null)
        {
            firstConfig.Focus();
            Keyboard.Focus(firstConfig);
            return true;
        }

        // No config field available (or not yet focusable): land on a footer action.
        if (StartWizardStartButton != null && StartWizardStartButton.IsVisible && StartWizardStartButton.IsEnabled)
        {
            StartWizardStartButton.Focus();
            Keyboard.Focus(StartWizardStartButton);
            return true;
        }

        if (StartWizardPreviousButton != null && StartWizardPreviousButton.IsVisible && StartWizardPreviousButton.IsEnabled)
        {
            StartWizardPreviousButton.Focus();
            Keyboard.Focus(StartWizardPreviousButton);
            return true;
        }

        if (StartWizardCancelButton != null && StartWizardCancelButton.IsVisible && StartWizardCancelButton.IsEnabled)
        {
            StartWizardCancelButton.Focus();
            Keyboard.Focus(StartWizardCancelButton);
            return true;
        }

        return false;
    }

    private static void CollectFocusableControls(DependencyObject root, ICollection<Control> output)
    {
        if (root is ListBoxItem)
        {
            return;
        }

        // Ignore generic items containers (read by SR as "liste vide") and focus real inputs instead.
        if (root is Control c &&
            root is not ItemsControl &&
            c.IsVisible &&
            c.IsEnabled &&
            KeyboardNavigation.GetIsTabStop(c))
        {
            output.Add(c);
        }

        var count = VisualTreeHelper.GetChildrenCount(root);
        for (var i = 0; i < count; i++)
        {
            var child = VisualTreeHelper.GetChild(root, i);
            if (child == null)
            {
                continue;
            }

            CollectFocusableControls(child, output);
        }
    }

    private static Control? FindAncestorControl(DependencyObject? node)
    {
        var current = node;
        while (current != null)
        {
            if (current is Control control)
            {
                return control;
            }

            current = GetVisualOrLogicalParent(current);
        }

        return null;
    }

    private bool IsHistoryEnabled()
    {
        return HistoryHost != null && HistoryHost.Visibility == Visibility.Visible;
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

            focused = GetVisualOrLogicalParent(focused);
        }

        return false;
    }

    private bool IsStartWizardTextInputFocused()
    {
        if (!IsFocusWithinStartWizard())
        {
            return false;
        }

        return IsTextInputFocused();
    }

    private bool TryGetFocusedStartWizardFooterButton(out Button? button)
    {
        button = null;
        var focused = Keyboard.FocusedElement as DependencyObject;
        while (focused != null)
        {
            if (focused is Button b &&
                (ReferenceEquals(b, StartWizardPreviousButton) ||
                 ReferenceEquals(b, StartWizardNextButton) ||
                 ReferenceEquals(b, StartWizardCancelButton) ||
                 ReferenceEquals(b, StartWizardStartButton)))
            {
                button = b;
                return true;
            }

            focused = GetVisualOrLogicalParent(focused);
        }

        return false;
    }


    private static DependencyObject? GetVisualOrLogicalParent(DependencyObject current)
    {
        try
        {
            if (current is Visual || current is System.Windows.Media.Media3D.Visual3D)
            {
                return VisualTreeHelper.GetParent(current);
            }
        }
        catch
        {
            // Ignore visual tree access issues and fallback to logical parent.
        }

        if (current is FrameworkElement fe)
        {
            return fe.Parent ?? fe.TemplatedParent;
        }

        return LogicalTreeHelper.GetParent(current);
    }

    private static bool IsFocusWithinElement(DependencyObject root)
    {
        var focused = Keyboard.FocusedElement as DependencyObject;
        while (focused != null)
        {
            if (ReferenceEquals(focused, root))
            {
                return true;
            }

            focused = GetVisualOrLogicalParent(focused);
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
        RequestFocusGameZoneInternal(GameFocusReason.InitialLoad);
    }

    private async void OnStartWizardPreviousClick(object sender, RoutedEventArgs e)
    {
        if (DataContext is not GameRoomViewModel vm)
        {
            return;
        }

        vm.GoPreviousStartWizardStep();
        _ = Dispatcher.BeginInvoke(
            DispatcherPriority.Input,
            new Action(FocusStartWizardPrimary));
    }

    private async void OnStartWizardNextClick(object sender, RoutedEventArgs e)
    {
        if (DataContext is not GameRoomViewModel vm)
        {
            return;
        }

        await GoNextStartWizardStepAndFocusAsync(vm).ConfigureAwait(true);
    }

    private void OnStartWizardCancelClick(object sender, RoutedEventArgs e)
    {
        if (DataContext is not GameRoomViewModel vm)
        {
            return;
        }

        vm.CancelStartWizard();
        _ = Dispatcher.BeginInvoke(
            DispatcherPriority.Input,
            new Action(() => RequestFocusGameZoneInternal(GameFocusReason.AfterDialog)));
    }

    private async void OnStartWizardStartClick(object sender, RoutedEventArgs e)
    {
        if (DataContext is not GameRoomViewModel vm)
        {
            return;
        }

        await vm.ConfirmStartWizardAsync().ConfigureAwait(true);
    }
}
