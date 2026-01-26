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

            // Attendre que la fenêtre soit complètement chargée
            await Task.Delay(150);

            await Dispatcher.InvokeAsync(() =>
            {
                try
                {
                    if (!IsVisible)
                        return;

                    // Forcer l'activation de la fenêtre
                    if (!IsActive)
                    {
                        Activate();
                        var helper = new WindowInteropHelper(this);
                        helper.EnsureHandle();
                        NativeMethods.SetForegroundWindow(helper.Handle);
                    }

                    // Attendre un instant supplémentaire pour la stabilisation
                    Task.Delay(50).ContinueWith(_ =>
                    {
                        Dispatcher.Invoke(() =>
                        {
                            // Positionner le focus sur le premier élément interactif
                            var firstFocusable = FindFirstFocusableElement();
                            if (firstFocusable != null)
                            {
                                firstFocusable.Focus();
                                Keyboard.Focus(firstFocusable);
                                
                                // Notifier les lecteurs d'écran
                                NotifyScreenReader(firstFocusable);
                            }
                            else
                            {
                                MoveFocus(new TraversalRequest(FocusNavigationDirection.First));
                            }
                        });
                    });
                }
                catch
                {
                    // Ignorer les erreurs (best-effort)
                }
            }, DispatcherPriority.ApplicationIdle);
        }

        private IInputElement FindFirstFocusableElement()
        {
            // Rechercher le premier élément focusable dans l'arborescence visuelle
            return FocusManager.GetFocusedElement(this) as IInputElement 
                   ?? PredictionServices.GetFirstFocusableChild(this);
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
        public static IInputElement GetFirstFocusableChild(DependencyObject parent)
        {
            if (parent is UIElement element && element.Focusable && element.IsEnabled && element.Visibility == Visibility.Visible)
            {
                return element;
            }

            for (int i = 0; i < System.Windows.Media.VisualTreeHelper.GetChildrenCount(parent); i++)
            {
                var child = System.Windows.Media.VisualTreeHelper.GetChild(parent, i);
                var result = GetFirstFocusableChild(child);
                if (result != null)
                    return result;
            }

            return null;
        }
    }
}