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

        // NVDA annonce "volet" quand le ControlType est Pane. Or cette ancre de focus est invisible et ne doit pas polluer
        // la navigation. On expose un type neutre pour que NVDA lise surtout le nom (si présent) ou le moins possible.
        protected override AutomationControlType GetAutomationControlTypeCore() => AutomationControlType.Custom;

        protected override string GetLocalizedControlTypeCore() => "zone de jeu";

        protected override string GetClassNameCore() => nameof(GameZoneFocusAnchor);
    }
}
