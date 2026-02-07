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
                    parts.Add(string.IsNullOrWhiteSpace(OwnPawnUsername)
                        ? "votre pion"
                        : $"pion de {OwnPawnUsername} (vous)");
                }
                if (HasOpponentPawn)
                {
                    parts.Add(string.IsNullOrWhiteSpace(OpponentPawnUsername)
                        ? "camp adverse"
                        : $"pion de {OpponentPawnUsername}");
                }
                var wallDirections = new List<string>();
                if (WallNorth) wallDirections.Add("mur devant");
                if (WallSouth) wallDirections.Add("mur derrière");
                if (WallEast) wallDirections.Add("mur à droite");
                if (WallWest) wallDirections.Add("mur à gauche");
                if (wallDirections.Count > 0)
                {
                    parts.Add($"murs : {string.Join(", ", wallDirections)}");
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
