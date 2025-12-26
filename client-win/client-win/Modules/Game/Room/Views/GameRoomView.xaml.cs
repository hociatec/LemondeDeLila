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
        HookGameZoneTabDelegation();
    }

    private void OnLoaded(object sender, System.Windows.RoutedEventArgs e)
    {
        HookHistoryTabDelegation();
        HookGameZoneTabDelegation();

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

    private void HookGameZoneTabDelegation()
    {
        if (GameZoneHost is not GameZoneHostView zone)
        {
            return;
        }

        zone.TabToHistoryRequested -= OnGameZoneTabToHistoryRequested;
        zone.TabToHistoryRequested += OnGameZoneTabToHistoryRequested;
    }

    private void OnGameZoneTabToHistoryRequested(object? sender, EventArgs e)
    {
        Dispatcher.BeginInvoke(DispatcherPriority.Input, new Action(FocusHistory));
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
        var shift = (Keyboard.Modifiers & ModifierKeys.Shift) == ModifierKeys.Shift;

        // Ne pas intercepter Tab quand le focus est déjà dans la zone de jeu : elle délègue (Tab -> Historique).
        // Ici on ne force Tab vers la zone de jeu que si l'utilisateur n'est ni dans l'historique ni dans la zone de jeu.
        if (!shift &&
            Root?.IsKeyboardFocusWithin == true &&
            HistoryHost?.IsKeyboardFocusWithin != true &&
            GameZoneHost?.IsKeyboardFocusWithin != true)
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
}
