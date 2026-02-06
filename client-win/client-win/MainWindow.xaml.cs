// MainWindow.xaml.cs
using System;
using System.Threading.Tasks;
using System.Windows;
using System.Windows.Automation.Peers;
using System.Windows.Automation.Provider;
using System.Windows.Input;
using System.Windows.Interop;
using System.Windows.Media;
using System.Windows.Threading;
using client_win.Modules.Shell.Services;
using client_win.Modules.Shell.Views;

namespace client_win
{
    public partial class MainWindow : Window
    {
        private bool _didStartupFocusNudge;
        private DispatcherTimer? _focusRetryTimer;
        private int _focusRetryAttempts;
        private const int MaxFocusRetryAttempts = 12;
        private bool _pendingScreenReaderAnnouncement;

        public MainWindow()
        {
            InitializeComponent();
            
            // Maximiser la fenêtre au démarrage
            WindowState = WindowState.Maximized;
            
            Loaded += OnLoaded;
            Activated += OnActivated;
            AddHandler(Keyboard.GotKeyboardFocusEvent, new KeyboardFocusChangedEventHandler(OnWindowGotKeyboardFocus), handledEventsToo: true);
        }

        private async void OnLoaded(object sender, RoutedEventArgs e)
        {
            if (_didStartupFocusNudge)
                return;
            _didStartupFocusNudge = true;

            _ = Dispatcher.BeginInvoke(DispatcherPriority.ApplicationIdle, new Action(async () =>
            {
                try
                {
                    // Laisser WPF finaliser la création de la fenêtre / templates avant d'appliquer le focus.
                    await Task.Delay(200);

                    if (!IsVisible || !IsLoaded)
                    {
                        return;
                    }

                    // Best-effort: demander l'activation (peut échouer selon les règles Windows de focus).
                    try { Activate(); } catch { /* ignore */ }

                    // Best-effort: tenter de mettre la fenêtre au premier plan sans casser l'utilisateur.
                    EnsureWindowForeground();

                    // Injecter le focus dans le contenu (Home/Menu).
                    RequestContentInitialFocus();

                    // Retry loop: utile quand la fenêtre est visible mais n'a pas encore le focus OS
                    // (ClickOnce / démarrage silencieux).
                    StartFocusRetryLoop();
                    EnsureInitialKeyboardFocus();
                }
                catch
                {
                    // Ignorer les erreurs (best-effort)
                }
            }));
        }

        private IInputElement? FindFirstFocusableElement()
        {
            var focused = FocusManager.GetFocusedElement(this) as IInputElement;
            if (!ShouldSkipStartupFocusTarget(focused))
            {
                return focused;
            }

            var host = FindName("RootHost") as DependencyObject ?? this;
            return PredictionServices.GetFirstFocusableChild(host, element => !ShouldSkipStartupFocusTarget(element));
        }

        private bool IsFocusableElementWithinRoot(IInputElement element)
        {
            if (element is not DependencyObject dependency)
            {
                return false;
            }

            var host = FindName("RootHost") as DependencyObject ?? this;
            for (var current = dependency; current != null; current = GetParent(current))
            {
                if (ReferenceEquals(current, host))
                {
                    return true;
                }
            }

            return false;
        }

        private static DependencyObject? GetParent(DependencyObject current)
        {
            if (current == null)
            {
                return null;
            }

            if (current is Visual || current is System.Windows.Media.Media3D.Visual3D)
            {
                return VisualTreeHelper.GetParent(current);
            }

            if (current is FrameworkElement fe)
            {
                return fe.Parent ?? fe.TemplatedParent;
            }

            return LogicalTreeHelper.GetParent(current);
        }

        private void FocusAndAnnounce(IInputElement element)
        {
            try { element.Focus(); } catch { /* ignore */ }
            try { Keyboard.Focus(element); } catch { /* ignore */ }
            try { FocusManager.SetFocusedElement(this, element); } catch { /* ignore */ }
            try { NotifyScreenReader(element); } catch { /* ignore */ }
        }

        private bool _isHandlingActivation;

        private void OnActivated(object? sender, EventArgs e)
        {
            if (_isHandlingActivation)
            {
                return;
            }

            _isHandlingActivation = true;
            _ = Dispatcher.BeginInvoke((Action)(() =>
            {
                try
                {
                    EnsureInitialKeyboardFocus();
                }
                finally
                {
                    _isHandlingActivation = false;
                }
            }), DispatcherPriority.Input);
        }

        private void EnsureInitialKeyboardFocus()
        {
            try
            {
                if (!IsVisible || !IsLoaded)
                {
                    return;
                }

                // Best-effort: request OS activation (may fail due to Windows focus rules).
                try { Activate(); } catch { /* ignore */ }
                try { Focus(); } catch { /* ignore */ }

                // Some startups show the window without giving it OS focus; a brief Topmost toggle can help.
                try
                {
                    if (!IsActive)
                    {
                        var previousTopmost = Topmost;
                        Topmost = true;
                        Topmost = previousTopmost;
                        try { Activate(); } catch { /* ignore */ }
                    }
                }
                catch
                {
                    // best-effort
                }

                // Best-effort: bring the window to foreground.
                EnsureWindowForeground();

                // Ensure WPF has a focused element so Tab / Shift+Tab have a starting point.
                try { FocusParking.Park(this); } catch { /* ignore */ }

                // Try view-provided initial focus (Home/Menu implement IInitialFocusTarget).
                RequestContentInitialFocus();

                // Fallback: traverse to first focusable in content.
                TryMoveFocusIntoContent();
            }
            catch
            {
                // best-effort
            }
        }

        private void EnsureWindowForeground()
        {
            try
            {
                var helper = new WindowInteropHelper(this);
                helper.EnsureHandle();
                var hwnd = helper.Handle;
                if (hwnd == IntPtr.Zero)
                {
                    return;
                }

                NativeMethods.ShowWindow(hwnd, NativeMethods.SW_RESTORE);
                NativeMethods.SetForegroundWindow(hwnd);
                NativeMethods.SetActiveWindow(hwnd);
                NativeMethods.SetFocus(hwnd);
                NativeMethods.SwitchToThisWindow(hwnd, fAltTab: true);
                NativeMethods.ShowWindow(hwnd, NativeMethods.SW_MAXIMIZE);
            }
            catch
            {
                // best-effort
            }
        }

        private void RequestContentInitialFocus()
        {
            try
            {
                IInitialFocusTarget? initialFocusTarget = null;
                try
                {
                    initialFocusTarget = RootHost?.Content as IInitialFocusTarget;
                }
                catch
                {
                    // best-effort
                }

                if (initialFocusTarget == null)
                {
                    initialFocusTarget = FindInitialFocusTargetInRootHost();
                }

                if (initialFocusTarget != null)
                {
                    _pendingScreenReaderAnnouncement = true;
                    initialFocusTarget.RequestInitialFocus();

                    if (!IsKeyboardFocusWithinRootInteractive())
                    {
                        TryMoveFocusIntoContent();
                    }
                }
                else
                {
                    _pendingScreenReaderAnnouncement = false;
                    TryMoveFocusIntoContent();
                }
            }
            catch
            {
                // best-effort
            }
        }

        private bool IsKeyboardFocusWithinRootInteractive()
        {
            try
            {
                var focused = Keyboard.FocusedElement as IInputElement;
                if (focused == null)
                {
                    return false;
                }

                if (!IsFocusableElementWithinRoot(focused))
                {
                    return false;
                }

                return !ShouldSkipStartupFocusTarget(focused);
            }
            catch
            {
                // best-effort
            }

            return false;
        }

        private void TryMoveFocusIntoContent()
        {
            try
            {
                if (!IsVisible || !IsLoaded)
                {
                    return;
                }

                // Ne pas voler le focus à d'autres applications.
                if (!IsActive && !IsKeyboardFocusWithin)
                {
                    return;
                }

                try { RootHost?.MoveFocus(new TraversalRequest(FocusNavigationDirection.First)); } catch { /* ignore */ }

                if (!IsKeyboardFocusWithinRootInteractive())
                {
                    try { MoveFocus(new TraversalRequest(FocusNavigationDirection.First)); } catch { /* ignore */ }
                }
            }
            catch
            {
                // best-effort
            }
        }

        private IInitialFocusTarget? FindInitialFocusTargetInRootHost()
        {
            try
            {
                var rootHost = RootHost;
                if (rootHost == null)
                {
                    return null;
                }

                return FindInitialFocusTargetDescendant(rootHost);
            }
            catch
            {
                // best-effort
            }

            return null;
        }

        private IInitialFocusTarget? FindInitialFocusTargetDescendant(DependencyObject root)
        {
            try
            {
                var childrenCount = VisualTreeHelper.GetChildrenCount(root);
                for (var i = 0; i < childrenCount; i++)
                {
                    var child = VisualTreeHelper.GetChild(root, i);
                    if (child == null)
                    {
                        continue;
                    }

                    if (child is IInitialFocusTarget target)
                    {
                        if (child is UIElement uie && ShouldSkipStartupFocusTarget(uie))
                        {
                            // ignore
                        }
                        else
                        {
                            return target;
                        }
                    }

                    if (FindInitialFocusTargetDescendant(child) is IInitialFocusTarget found)
                    {
                        return found;
                    }
                }
            }
            catch
            {
                // best-effort
            }

            return null;
        }

        private void StartFocusRetryLoop()
        {
            if (_focusRetryTimer != null)
            {
                return;
            }

            _focusRetryAttempts = 0;
            _focusRetryTimer = new DispatcherTimer(
                TimeSpan.FromMilliseconds(150),
                DispatcherPriority.Background,
                OnFocusRetryTick,
                Dispatcher);
            _focusRetryTimer.Start();
        }

        private void OnFocusRetryTick(object? sender, EventArgs e)
        {
            var focused = Keyboard.FocusedElement as IInputElement;
            if (focused != null &&
                IsFocusableElementWithinRoot(focused) &&
                !ShouldSkipStartupFocusTarget(focused))
            {
                StopFocusRetryLoop();
                return;
            }

            _focusRetryAttempts++;
            if (_focusRetryAttempts > MaxFocusRetryAttempts)
            {
                StopFocusRetryLoop();
                return;
            }

            if (!IsVisible || !IsLoaded)
            {
                return;
            }

            EnsureInitialKeyboardFocus();
        }

        private void StopFocusRetryLoop()
        {
            if (_focusRetryTimer == null)
            {
                return;
            }

            _focusRetryTimer.Stop();
            _focusRetryTimer.Tick -= OnFocusRetryTick;
            _focusRetryTimer = null;
            _focusRetryAttempts = 0;
            _pendingScreenReaderAnnouncement = false;
        }

        private void OnWindowGotKeyboardFocus(object? sender, KeyboardFocusChangedEventArgs e)
        {
            if (!_pendingScreenReaderAnnouncement)
            {
                return;
            }

            if (e.NewFocus is IInputElement element && !ShouldSkipStartupFocusTarget(element))
            {
                _pendingScreenReaderAnnouncement = false;
                NotifyScreenReader(element);
                StopFocusRetryLoop();
            }
        }

        private static bool ShouldSkipStartupFocusTarget(IInputElement? element)
        {
            if (element is UIElement uiElement)
            {
                return ShouldSkipStartupFocusTarget(uiElement);
            }
            return false;
        }

        private static bool ShouldSkipStartupFocusTarget(UIElement element)
        {
            if (!element.IsHitTestVisible)
            {
                return true;
            }

            if (element is BootstrapShellView)
            {
                return true;
            }

            if (element is FrameworkElement fe)
            {
                const string sentinelName = "FocusSentinel";
                const string rootHostName = "RootHost";
                var name = fe.Name;
                if (string.Equals(name, sentinelName, StringComparison.Ordinal) ||
                    string.Equals(name, rootHostName, StringComparison.Ordinal))
                {
                    return true;
                }
            }

            return false;
        }

        private void NotifyScreenReader(IInputElement element)
        {
            try
            {
                if (element is UIElement uiElement)
                {
                    var peer = UIElementAutomationPeer.CreatePeerForElement(uiElement);
                    if (peer != null)
                    {
                        try { peer.SetFocus(); } catch { /* ignore */ }
                        peer.RaiseAutomationEvent(AutomationEvents.AutomationFocusChanged);
                        
                        // Si l'élément supporte l'invocation, notifier également
                        if (peer.GetPattern(PatternInterface.Invoke) is IInvokeProvider)
                        {
                            peer.RaiseAutomationEvent(AutomationEvents.LiveRegionChanged);
                        }
                    }
                }
            }
            catch
            {
                // Ignorer les erreurs
            }
        }
    }

    // Classe helper pour trouver le premier élément focusable
    internal static class PredictionServices
    {
        public static IInputElement? GetFirstFocusableChild(DependencyObject parent, Func<UIElement, bool>? allow = null)
        {
            if (parent is UIElement element && element.Focusable && element.IsEnabled && element.Visibility == Visibility.Visible &&
                (allow?.Invoke(element) ?? true))
            {
                return element;
            }

            for (int i = 0; i < System.Windows.Media.VisualTreeHelper.GetChildrenCount(parent); i++)
            {
                var child = System.Windows.Media.VisualTreeHelper.GetChild(parent, i);
                var result = GetFirstFocusableChild(child, allow);
                if (result != null)
                    return result;
            }

            return null;
        }
    }
}
