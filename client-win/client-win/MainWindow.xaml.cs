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

        public MainWindow()
        {
            InitializeComponent();
            
            // Maximiser la fenêtre au démarrage
            WindowState = WindowState.Maximized;
            
            Loaded += OnLoaded;
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
