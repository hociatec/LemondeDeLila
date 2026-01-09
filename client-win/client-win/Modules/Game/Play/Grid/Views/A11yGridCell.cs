using System.Windows.Automation.Peers;
using System.Windows.Controls;

namespace client_win.Modules.Game.Play.Grid.Views;

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

        protected override int GetPositionInSetCore()
        {
            // Eviter "78 sur 81" (bruit NVDA) : ne pas préciser la position dans une liste.
            return 0;
        }

        protected override int GetSizeOfSetCore()
        {
            // Eviter "78 sur 81" (bruit NVDA) : ne pas préciser la taille de l'ensemble.
            return 0;
        }

        protected override string GetItemTypeCore()
        {
            return string.Empty;
        }

        protected override string GetItemStatusCore()
        {
            return string.Empty;
        }
    }
}

