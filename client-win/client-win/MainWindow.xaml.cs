// MainWindow.xaml.cs
using System;
using System.Threading.Tasks;
using System.Windows;
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
            Loaded += OnLoaded;
        }

        private async void OnLoaded(object sender, RoutedEventArgs e)
        {
            if (_didStartupFocusNudge)
                return;

            _didStartupFocusNudge = true;

            // Attendre que la fenêtre soit complètement chargée
            await Task.Delay(100);

            Dispatcher.BeginInvoke(DispatcherPriority.ApplicationIdle, () =>
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

                    // Positionner le focus sur le premier élément interactif

                    if (!IsKeyboardFocusWithin)
                    {
                        MoveFocus(new TraversalRequest(FocusNavigationDirection.First));
                    }
                }
                catch
                {
                    // Ignorer les erreurs (best-effort)
                }
            });
        }
    }
}
