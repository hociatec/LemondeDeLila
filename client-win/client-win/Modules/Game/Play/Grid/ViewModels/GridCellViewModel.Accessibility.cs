using System.Collections.Generic;

namespace client_win.Modules.Game.Play.Grid.ViewModels;

public sealed partial class GridCellViewModel
{
    public string AccessibleName
    {
        get
        {
            var parts = new List<string> { CellRef };
            if (HasOwnPawn)
            {
                parts.Add("votre pion");
            }
            if (HasOpponentPawn)
            {
                parts.Add("camp adverse");
            }
            return string.Join(", ", parts);
        }
    }

    private void UpdateAccessibleName()
    {
        OnPropertyChanged(nameof(CellRef));
        OnPropertyChanged(nameof(AccessibleName));
    }

    public override string ToString() => AccessibleName;
}

