using System.Collections.Generic;

namespace client_win.Modules.Game.Play.Grid.ViewModels;

public sealed partial class GridCellViewModel
{
    private string _accessibleNameCache = string.Empty;
    private bool _isAccessibleNameDirty = true;

    public string AccessibleName
    {
        get
        {
            if (_isAccessibleNameDirty)
            {
                _accessibleNameCache = BuildAccessibleName();
                _isAccessibleNameDirty = false;
            }
            return _accessibleNameCache;
        }
    }

    private string BuildAccessibleName()
    {
        var parts = new List<string> { $"{CellRef}." };

        if (HasEntities)
        {
            parts.Add("Occupée.");
        }
        else
        {
            parts.Add("Vide.");
        }

        if (EntityTypes.Count > 0)
        {
            var types = string.Join(", ", EntityTypes);
            if (!string.IsNullOrWhiteSpace(types))
            {
                parts.Add($"Éléments: {types}.");
            }
        }

        foreach (var tag in CellTags)
        {
            var t = (tag ?? string.Empty).Trim();
            if (!string.IsNullOrWhiteSpace(t))
            {
                parts.Add(t.EndsWith(".") ? t : $"{t}.");
            }
        }

        if (CanPlaceWallH || CanPlaceWallV)
        {
            if (CanPlaceWallH && CanPlaceWallV)
            {
                parts.Add("Mur possible.");
            }
            else if (CanPlaceWallH)
            {
                parts.Add("Mur horizontal possible.");
            }
            else
            {
                parts.Add("Mur vertical possible.");
            }
        }

        if (WallNorth || WallSouth || WallWest || WallEast)
        {
            if (WallNorth) parts.Add("Mur en haut.");
            if (WallSouth) parts.Add("Mur en bas.");
            if (WallWest) parts.Add("Mur à gauche.");
            if (WallEast) parts.Add("Mur à droite.");
        }

        return string.Join(" ", parts);
    }

    private void UpdateAccessibleName()
    {
        _isAccessibleNameDirty = true;
        OnPropertyChanged(nameof(AccessibleName));
    }

    public override string ToString() => AccessibleName;
}
