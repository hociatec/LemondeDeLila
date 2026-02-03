// MainWindow.xaml.cs
using System;
using System.Threading.Tasks;
using System.Windows;
using System.Windows.Automation.Peers;
using System.Windows.Automation.Provider;
using System.Windows.Input;
using System.Windows.Interop;
using System.Windows.Threading;

namespace client_win
{
    public partial class MainWindow : Window
    {
        private bool _didStartupFocusNudge;
        private DispatcherTimer? _focusRetryTimer;
        private int _focusRetryAttempts;
        private const int MaxFocusRetryAttempts = 12;

        public MainWindow()
        {
            InitializeComponent();
            
            // Maximiser la fenêtre au démarrage
            WindowState = WindowState.Maximized;
            
            Loaded += OnLoaded;
            Activated += OnActivated;
        }

        private async void OnLoaded(object sender, RoutedEventArgs e)
        {
            if (_didStartupFocusNudge)
                return;
            _didStartupFocusNudge = true;

            await Task.Delay(150);

            await Dispatcher.InvokeAsync(() =>
            {
                try
                {
                    if (!IsVisible)
                        return;

                    if (!IsActive)
                    {
                        Activate();
                        var helper = new WindowInteropHelper(this);
                        helper.EnsureHandle();
                        NativeMethods.SetForegroundWindow(helper.Handle);
                    }

            Task.Delay(50).ContinueWith(_ =>
            {
                Dispatcher.Invoke(() =>
                {
                    var firstFocusable = FindFirstFocusableElement();
                    if (firstFocusable == null)
                    {
                        MoveFocus(new TraversalRequest(FocusNavigationDirection.First));
                        firstFocusable = FocusManager.GetFocusedElement(this) as IInputElement;
                        if (ShouldSkipStartupFocusTarget(firstFocusable))
                        {
                            firstFocusable = null;
                        }
                    }

                    EnsureWindowForeground();
                    FocusAndAnnounce(firstFocusable ?? this);
                    StartFocusRetryLoop();
                });
            });
        }
                catch
                {
                    // Ignorer les erreurs (best-effort)
                }
            }, DispatcherPriority.ApplicationIdle);
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
                    EnsureWindowForeground();
                    var target = FindFirstFocusableElement() ?? this;
                    FocusAndAnnounce(target);
                    RequestContentInitialFocus();
                }
                finally
                {
                    _isHandlingActivation = false;
                }
            }), DispatcherPriority.Input);
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
                if (RootHost?.Content is IInitialFocusTarget initialFocusTarget)
                {
                    initialFocusTarget.RequestInitialFocus();
                    if (Keyboard.FocusedElement is IInputElement focused)
                    {
                        NotifyScreenReader(focused);
                        StopFocusRetryLoop();
                    }
                }
            }
            catch
            {
                // best-effort
            }
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
            var host = RootHost;
            if (host != null && host.IsKeyboardFocusWithin)
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

            RequestContentInitialFocus();
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
