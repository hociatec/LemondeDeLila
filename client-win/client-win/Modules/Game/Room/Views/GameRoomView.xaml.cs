using System;
using System.Windows.Controls;
using System.Windows.Input;
using System.Windows.Threading;
using client_win.Modules.Game.History.Views;

namespace client_win.Modules.Game.Room.Views;

public partial class GameRoomView : UserControl
{
    public GameRoomView()
    {
        InitializeComponent();
        HookHistoryTabDelegation();
    }

    private void OnLoaded(object sender, System.Windows.RoutedEventArgs e)
    {
        HookHistoryTabDelegation();

        Dispatcher.BeginInvoke(DispatcherPriority.Input, new Action(() =>
        {
            FocusGameZone();
        }));
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

    private void OnPreviewKeyDown(object sender, KeyEventArgs e)
    {
        if (e.Key != Key.Tab)
        {
            return;
        }

        // NOTE: Gestion volontairement impérative (code-behind) pour fiabiliser Tab/Maj+Tab avec les lecteurs d'écran :
        // WPF peut "absorber" la navigation quand le focus est dans un TextBox (historique) ou sur un ContentControl vide.
        // Ici on force explicitement le basculement Zone de jeu <-> Historique pour garantir l'accessibilité.
        // On laisse WPF gérer la navigation interne aux contrôles (futurs contrôles de jeu).
        // On n'intercepte Tab que dans deux cas :
        // - focus sur l'ancre "Zone de jeu vide" (GameZoneEmptyAnchor)
        // - focus sur le conteneur (fallback)
        var focused = Keyboard.FocusedElement;
        var shift = (Keyboard.Modifiers & ModifierKeys.Shift) == ModifierKeys.Shift;

        if (ReferenceEquals(focused, GameZoneEmptyAnchor))
        {
            e.Handled = true;
            FocusHistory();
            return;
        }

        // Si le focus n'est nulle part de clair, s'assurer que Tab atterrit sur la zone de jeu.
        if (!shift && Root?.IsKeyboardFocusWithin == true && HistoryHost?.IsKeyboardFocusWithin != true && GameZoneEmptyAnchor?.IsKeyboardFocusWithin != true)
        {
            e.Handled = true;
            FocusGameZone();
        }
    }

    private void OnHistoryTabNavigationRequested(object? sender, TabNavigationRequestedEventArgs e)
    {
        // La Room reste le "décideur" : ici on choisit de boucler entre Historique et Zone de jeu.
        // Tab ou Maj+Tab depuis l'historique => retour Zone de jeu (l'autre sens est géré depuis GameZoneHost).
        Dispatcher.BeginInvoke(DispatcherPriority.Input, new Action(FocusGameZone));
    }

    private void FocusGameZone()
    {
        if (GameZoneHost?.Content is System.Windows.FrameworkElement contentRoot)
        {
            if (contentRoot.MoveFocus(new TraversalRequest(FocusNavigationDirection.First)))
            {
                return;
            }

            if (contentRoot.Focusable && contentRoot.Focus())
            {
                return;
            }
        }

        GameZoneEmptyAnchor?.Focus();
        Keyboard.Focus(GameZoneEmptyAnchor);
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
}
