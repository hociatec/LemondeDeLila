using System.Windows.Automation.Peers;
using System.Windows.Controls;

namespace client_win.Modules.Game.Shell.Views;

public sealed class GameZoneFocusAnchor : Button
{
    protected override AutomationPeer OnCreateAutomationPeer() => new GameZoneFocusAnchorAutomationPeer(this);

    private sealed class GameZoneFocusAnchorAutomationPeer : ButtonAutomationPeer
    {
        public GameZoneFocusAnchorAutomationPeer(GameZoneFocusAnchor owner)
            : base(owner)
        {
        }

        // Pane est annoncé comme "volet" (bruit), Custom comme "inconnu" selon le lecteur d'écran.
        // Group reste neutre tout en évitant l'annonce "inconnu".
        protected override AutomationControlType GetAutomationControlTypeCore() => AutomationControlType.Group;

        protected override string GetLocalizedControlTypeCore() => "zone de jeu";

        protected override string GetClassNameCore() => nameof(GameZoneFocusAnchor);
    }
}
