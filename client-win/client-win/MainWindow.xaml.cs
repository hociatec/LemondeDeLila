using System;
using System.Windows;
using System.Windows.Input;
using System.Windows.Threading;
using client_win.Modules.Shell.Services;

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

        private void OnLoaded(object sender, RoutedEventArgs e)
        {
            if (_didStartupFocusNudge)
            {
                return;
            }
            _didStartupFocusNudge = true;

            // Au démarrage, le client peut être lancé en arrière-plan (ClickOnce / démarrage silencieux)
            // et l'utilisateur est obligé d'aller sur une autre fenêtre puis revenir pour "récupérer" le focus.
            // On tente un nudge best-effort sur la fenêtre principale pour que les champs de connexion
            // reçoivent le focus initial sans action supplémentaire.
            Dispatcher.BeginInvoke(DispatcherPriority.ApplicationIdle, new Action(() =>
            {
                try
                {
                    if (!IsVisible)
                    {
                        return;
                    }

                    if (!IsActive)
                    {
                        try { Activate(); } catch { /* ignore */ }
                    }

                    // UIA + focus sentinelle (NVDA): améliore la fiabilité du focus initial.
                    FocusParking.Park(this);

                    // Dernier nudge: placer le focus clavier sur le premier élément interactif
                    // (évite les cas où aucune touche ne répond avant un Alt-Tab / Maj+Tab).
                    if (!IsKeyboardFocusWithin)
                    {
                        try { Focus(); } catch { /* ignore */ }
                        try { Keyboard.Focus(this); } catch { /* ignore */ }
                        try { MoveFocus(new TraversalRequest(FocusNavigationDirection.First)); } catch { /* ignore */ }
                    }
                }
                catch
                {
                    // best-effort
                }
            }));
        }
    }
}
