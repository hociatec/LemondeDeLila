using System.Windows.Automation.Peers;
using System.Windows.Controls;

namespace client_win.Modules.Game.Play.Views;

public sealed class A11yGridCell : Button
{
    protected override AutomationPeer OnCreateAutomationPeer()
    {
        return new A11yGridCellAutomationPeer(this);
    }

    private sealed class A11yGridCellAutomationPeer : ButtonAutomationPeer
    {
        public A11yGridCellAutomationPeer(Button owner) : base(owner) { }

        protected override AutomationControlType GetAutomationControlTypeCore()
        {
            // NVDA annonce "bouton" pour AutomationControlType.Button.
            // On expose un contrôle personnalisé avec un libellé de type explicite.
            return AutomationControlType.Custom;
        }

        protected override string GetLocalizedControlTypeCore()
        {
            return "case";
        }

        protected override string GetClassNameCore()
        {
            return "GridCell";
        }
    }
}

