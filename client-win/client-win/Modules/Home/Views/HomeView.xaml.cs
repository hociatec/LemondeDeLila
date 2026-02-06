using System;
using System.ComponentModel;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Controls.Primitives;
using System.Windows.Input;
using System.Windows.Media;
using System.Windows.Threading;
using client_win.Modules.Home.ViewModels;
using client_win.Modules.Shell.Services;
using client_win.Modules.Shell.Views;

namespace client_win.Modules.Home.Views;

/// <summary>
/// Vue principale de l'écran d'accueil avec formulaires de connexion et d'inscription.
/// </summary>
public partial class HomeView : UserControl, IInitialFocusTarget
{
    private HomeViewModel? _viewModel;
    private Window? _hostWindow;
    private EventHandler? _hostWindowActivatedHandler;
    private const int InitialFocusMaxAttempts = 12;
    private static readonly TimeSpan InitialFocusRetryInterval = TimeSpan.FromMilliseconds(120);
    private int _initialFocusRemaining;
    private bool _initialFocusScheduled;
    private DispatcherTimer? _initialFocusTimer;

    public HomeView()
    {
        InitializeComponent();
    }

    private void OnLoaded(object sender, RoutedEventArgs e)
    {
        AttachViewModel();
        AttachHostWindowFocusRetry();
        EnsureInitialFocus();
    }

    private void OnUnloaded(object sender, RoutedEventArgs e)
    {
        StopInitialFocusTimer();
        DetachHostWindowFocusRetry();
        DetachViewModel();
    }

    private void OnDataContextChanged(object sender, DependencyPropertyChangedEventArgs e)
    {
        DetachViewModel();
        AttachViewModel();
        AttachHostWindowFocusRetry();
        if (IsLoaded)
        {
            EnsureInitialFocus();
        }
    }

    private void AttachViewModel()
    {
        if (DataContext is HomeViewModel vm)
        {
            _viewModel = vm;
            vm.PropertyChanged += OnViewModelPropertyChanged;
        }
    }

    private void DetachViewModel()
    {
        if (_viewModel != null)
        {
            _viewModel.PropertyChanged -= OnViewModelPropertyChanged;
            _viewModel = null;
        }
    }

    private void OnViewModelPropertyChanged(object? sender, PropertyChangedEventArgs e)
    {
        if (e.PropertyName == nameof(HomeViewModel.CurrentPage) ||
            e.PropertyName == nameof(HomeViewModel.IsLoginVisible) ||
            e.PropertyName == nameof(HomeViewModel.IsRegisterVisible))
        {
            FocusFirstField();
        }
    }

    private void OnPreviewKeyDown(object sender, KeyEventArgs e)
    {
        if (!e.Handled && e.Key == Key.Tab)
        {
            if (IsTabNavigationAllowed(e.OriginalSource))
            {
                var direction = (Keyboard.Modifiers & ModifierKeys.Shift) == ModifierKeys.Shift
                    ? FocusNavigationDirection.Previous
                    : FocusNavigationDirection.Next;

                var origin = Keyboard.FocusedElement as UIElement ?? (sender as UIElement);
                var moved = false;
                try
                {
                    moved = origin?.MoveFocus(new TraversalRequest(direction)) == true;
                }
                catch
                {
                    moved = false;
                }

                // First-launch fallback: if there is no usable focus yet, place focus explicitly
                // on the first interactive field (username/password/landing button).
                if (!moved)
                {
                    moved = TryFocusFirstFieldCore(allowInactiveHost: true);
                }

                e.Handled = moved;
            }
            return;
        }

        if (_viewModel != null &&
            e.Key == Key.Escape &&
            _viewModel.CurrentPage != HomePage.Landing &&
            _viewModel.ShowLandingCommand.CanExecute(null))
        {
            _viewModel.ShowLandingCommand.Execute(null);
            e.Handled = true;
            return;
        }

        if (_viewModel != null &&
            (e.Key == Key.Enter || e.Key == Key.Return) &&
            IsTextEditingControl(e.OriginalSource))
        {
            if (_viewModel.CurrentPage == HomePage.Login)
            {
                var command = _viewModel.LoginForm.SubmitCommand;
                if (command.CanExecute(null))
                {
                    command.Execute(null);
                    e.Handled = true;
                    return;
                }
            }
            else if (_viewModel.CurrentPage == HomePage.Register)
            {
                var command = _viewModel.RegisterForm.SubmitCommand;
                if (command.CanExecute(null))
                {
                    command.Execute(null);
                    e.Handled = true;
                    return;
                }
            }
        }

        if (IsNavigationKey(e.Key) && !IsTextEditingControl(e.OriginalSource))
        {
            e.Handled = true;
        }
    }

    private void OnCommandButtonPreviewKeyDown(object sender, KeyEventArgs e)
    {
        if (e.Handled || e.IsRepeat)
        {
            return;
        }

        if (e.Key != Key.Enter && e.Key != Key.Return)
        {
            return;
        }

        if (sender is not ButtonBase button)
        {
            return;
        }

        var command = button.Command;
        var parameter = button.CommandParameter;
        if (command == null || !command.CanExecute(parameter))
        {
            return;
        }

        // IMPORTANT (NVDA): if navigation happens while the key event is still being processed,
        // the focused button may disappear -> "indisponible". Park focus and defer execution.
        e.Handled = true;
        FocusParking.Park();
        _ = Dispatcher.BeginInvoke(DispatcherPriority.Background, new Action(() =>
        {
            try
            {
                command.Execute(parameter);
            }
            catch
            {
                // best-effort
            }
        }));
    }

    private static bool IsNavigationKey(Key key)
    {
        return key == Key.Up ||
               key == Key.Down ||
               key == Key.Left ||
               key == Key.Right ||
               key == Key.Home ||
               key == Key.End ||
               key == Key.PageUp ||
               key == Key.PageDown;
    }

    private static bool IsTextEditingControl(object? source)
    {
        return source is TextBoxBase || source is PasswordBox;
    }

    private static bool IsTabNavigationAllowed(object? source)
    {
        if (source is TextBoxBase tb && tb.AcceptsTab)
        {
            return false;
        }

        if (source is RichTextBox rtb && rtb.AcceptsTab)
        {
            return false;
        }

        return true;
    }

    private void FocusFirstField(bool immediate = false)
    {
        if (immediate && Dispatcher.CheckAccess())
        {
            if (TryFocusFirstFieldCore())
            {
                return;
            }
        }

        _ = Dispatcher.BeginInvoke(DispatcherPriority.Input, new Action(() => TryFocusFirstFieldCore(allowInactiveHost: false)));
        _ = Dispatcher.BeginInvoke(DispatcherPriority.ApplicationIdle, new Action(() => TryFocusFirstFieldCore(allowInactiveHost: false)));
    }

    private bool TryFocusFirstFieldCore(bool allowInactiveHost = false)
    {
        var vm = _viewModel;
        if (vm == null)
        {
            return false;
        }

        if (!IsLoaded || !IsVisible)
        {
            return false;
        }

        if (!allowInactiveHost && !IsHostWindowActive())
        {
            return false;
        }

        try
        {
            return vm.CurrentPage switch
            {
                HomePage.Landing => FocusLandingButton(),
                HomePage.Login => FocusLoginField(),
                HomePage.Register => FocusRegisterField(),
                _ => false,
            };
        }
        catch
        {
            // Focus is best-effort: never crash the UI thread.
        }

        return false;
    }

    private void EnsureInitialFocus()
    {
        _initialFocusRemaining = InitialFocusMaxAttempts;
        StartInitialFocusTimer();
        QueueInitialFocusAttempt();
    }

    private void StartInitialFocusTimer()
    {
        if (_initialFocusTimer == null)
        {
            _initialFocusTimer = new DispatcherTimer(DispatcherPriority.ApplicationIdle, Dispatcher);
            _initialFocusTimer.Tick += OnInitialFocusTimerTick;
        }

        _initialFocusTimer.Interval = InitialFocusRetryInterval;
        _initialFocusTimer.Start();
    }

    private void StopInitialFocusTimer()
    {
        if (_initialFocusTimer == null)
        {
            return;
        }

        _initialFocusTimer.Stop();
    }

    private void OnInitialFocusTimerTick(object? sender, EventArgs e)
    {
        InitialFocusAttempt();
    }

    private void QueueInitialFocusAttempt()
    {
        if (_initialFocusRemaining <= 0 || _initialFocusScheduled)
        {
            return;
        }

        _initialFocusScheduled = true;
        _ = Dispatcher.BeginInvoke(DispatcherPriority.ApplicationIdle, new Action(InitialFocusAttempt));
    }

    private void InitialFocusAttempt()
    {
        _initialFocusScheduled = false;

        if (_initialFocusRemaining <= 0)
        {
            StopInitialFocusTimer();
            return;
        }

        if (!IsLoaded || !IsVisible)
        {
            return;
        }

        if (IsFocusWithinView())
        {
            _initialFocusRemaining = 0;
            StopInitialFocusTimer();
            return;
        }

        if (TryFocusFirstFieldCore(allowInactiveHost: true))
        {
            _initialFocusRemaining = 0;
            StopInitialFocusTimer();
            return;
        }

        _initialFocusRemaining--;
        if (_initialFocusRemaining <= 0)
        {
            StopInitialFocusTimer();
            return;
        }

        QueueInitialFocusAttempt();
    }

    private bool FocusLandingButton()
    {
        if (LandingPrimaryButton?.IsVisible == true && LandingPrimaryButton.IsEnabled)
        {
            return TryKeyboardFocus(LandingPrimaryButton);
        }
        return false;
    }

    private bool FocusLoginField()
    {
        if (LoginUsernameBox?.IsVisible == true && LoginUsernameBox.IsEnabled)
        {
            return TryKeyboardFocus(LoginUsernameBox);
        }
        else if (LoginPasswordBox?.IsVisible == true && LoginPasswordBox.IsEnabled)
        {
            return TryKeyboardFocus(LoginPasswordBox);
        }
        else if (LoginPasswordTextBox?.IsVisible == true && LoginPasswordTextBox.IsEnabled)
        {
            return TryKeyboardFocus(LoginPasswordTextBox);
        }

        return false;
    }

    private bool FocusRegisterField()
    {
        if (RegisterUsernameBox?.IsVisible == true && RegisterUsernameBox.IsEnabled)
        {
            return TryKeyboardFocus(RegisterUsernameBox);
        }
        else if (RegisterEmailBox?.IsVisible == true && RegisterEmailBox.IsEnabled)
        {
            return TryKeyboardFocus(RegisterEmailBox);
        }
        else if (RegisterPasswordBox?.IsVisible == true && RegisterPasswordBox.IsEnabled)
        {
            return TryKeyboardFocus(RegisterPasswordBox);
        }
        else if (RegisterPasswordTextBox?.IsVisible == true && RegisterPasswordTextBox.IsEnabled)
        {
            return TryKeyboardFocus(RegisterPasswordTextBox);
        }

        return false;
    }

    private static bool TryKeyboardFocus(IInputElement target)
    {
        if (target == null)
        {
            return false;
        }

        try { (target as UIElement)?.Focus(); } catch { /* ignore */ }
        try
        {
            var focused = Keyboard.Focus(target);
            if (ReferenceEquals(focused, target))
            {
                return true;
            }
        }
        catch
        {
            // ignore
        }

        if (target is UIElement element && element.IsKeyboardFocused)
        {
            return true;
        }

        if (target is DependencyObject targetNode &&
            Keyboard.FocusedElement is DependencyObject focusedNode &&
            IsDescendantOrSelf(focusedNode, targetNode))
        {
            return true;
        }

        return false;
    }

    private static bool IsDescendantOrSelf(DependencyObject node, DependencyObject ancestor)
    {
        for (DependencyObject? current = node; current != null; current = GetParent(current))
        {
            if (ReferenceEquals(current, ancestor))
            {
                return true;
            }
        }

        return false;
    }

    private bool IsHostWindowActive()
    {
        try
        {
            var window = Window.GetWindow(this);
            if (window == null)
            {
                return false;
            }

            return window.IsActive || window.IsKeyboardFocusWithin;
        }
        catch
        {
            // best-effort
        }

        return false;
    }

    private bool IsFocusWithinView()
    {
        var focused = Keyboard.FocusedElement as DependencyObject;
        if (focused == null)
        {
            return false;
        }

        for (DependencyObject? current = focused; current != null; current = GetParent(current))
        {
            if (ReferenceEquals(current, this))
            {
                return true;
            }
        }

        return false;
    }

    private static DependencyObject? GetParent(DependencyObject current)
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
            // ignore
        }

        if (current is FrameworkElement fe)
        {
            return fe.Parent ?? fe.TemplatedParent;
        }

        return LogicalTreeHelper.GetParent(current);
    }

    private void AttachHostWindowFocusRetry()
    {
        try
        {
            var window = Window.GetWindow(this);
            if (window == null)
            {
                return;
            }

            if (ReferenceEquals(_hostWindow, window) && _hostWindowActivatedHandler != null)
            {
                return;
            }

            DetachHostWindowFocusRetry();
            _hostWindow = window;

            // Au démarrage, la vue peut être chargée avant que la fenêtre ne soit réellement active
            // (surtout via ClickOnce / démarrage silencieux). NVDA ne "voit" pas le focus tant que
            // la fenêtre n'a pas le focus OS. On retente au moment de l'activation.
            _hostWindowActivatedHandler = (_, _) =>
            {
                try
                {
                    if (!IsLoaded || !IsVisible)
                    {
                        return;
                    }

                    Dispatcher.BeginInvoke(DispatcherPriority.ApplicationIdle, new Action(() =>
                    {
                        try
                        {
                            EnsureInitialFocus();
                        }
                        catch
                        {
                            // best-effort
                        }
                    }));
                }
                catch
                {
                    // best-effort
                }
            };

            window.Activated += _hostWindowActivatedHandler;

            // Si la fenêtre est déjà active au moment où on attache le handler, l'événement Activated
            // a potentiellement déjà eu lieu (au tout début du démarrage). Dans ce cas, on fait un
            // "retry" immédiat pour éviter d'obliger l'utilisateur à alt-tab.
            if (window.IsActive)
            {
                Dispatcher.BeginInvoke(DispatcherPriority.ApplicationIdle, new Action(() =>
                {
                    try
                    {
                        EnsureInitialFocus();
                    }
                    catch
                    {
                        // best-effort
                    }
                }));
            }
        }
        catch
        {
            // best-effort
        }
    }

    private void DetachHostWindowFocusRetry()
    {
        try
        {
            if (_hostWindow != null && _hostWindowActivatedHandler != null)
            {
                _hostWindow.Activated -= _hostWindowActivatedHandler;
            }
        }
        catch
        {
            // best-effort
        }
        finally
        {
            _hostWindowActivatedHandler = null;
            _hostWindow = null;
        }
    }

    public void RequestInitialFocus()
    {
        EnsureInitialFocus();
    }
}
