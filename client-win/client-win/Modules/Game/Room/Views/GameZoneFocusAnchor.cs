using System.Windows.Automation.Peers;
using System.Windows.Controls;

namespace client_win.Modules.Game.Room.Views;

public sealed class GameZoneFocusAnchor : Button
{
    protected override AutomationPeer OnCreateAutomationPeer() => new GameZoneFocusAnchorAutomationPeer(this);

    private sealed class GameZoneFocusAnchorAutomationPeer : ButtonAutomationPeer
    {
        public GameZoneFocusAnchorAutomationPeer(GameZoneFocusAnchor owner)
            : base(owner)
        {
        }

        protected override AutomationControlType GetAutomationControlTypeCore() => AutomationControlType.Pane;

        protected override string GetLocalizedControlTypeCore() => string.Empty;

        protected override string GetClassNameCore() => nameof(GameZoneFocusAnchor);
    }
}

