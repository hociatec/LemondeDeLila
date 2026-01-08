using System;
using System.Collections.Generic;
using System.Linq;
using System.Windows;
using client_win.Core;

namespace client_win.Modules.Game.Play.ViewModels;

public sealed class GridCellViewModel : ObservableObject
{
    public GridCellViewModel(int x, int y, int index)
    {
        X = x;
        Y = y;
        Index = index;
    }

    public int X { get; }
    public int Y { get; }
    public int Index { get; }

    public int Column => X + 1;
    public int Row => Y + 1;

    public string CellRef => $"{ToColumnLetters(Column)}{Row}";

    private static string ToColumnLetters(int oneBasedColumn)
    {
        var n = Math.Max(1, oneBasedColumn);
        var s = string.Empty;
        while (n > 0)
        {
            n--;
            s = (char)('A' + (n % 26)) + s;
            n /= 26;
        }
        return s;
    }

    public int MaxColumns
    {
        get => _maxColumns;
        set
        {
            if (SetProperty(ref _maxColumns, value))
            {
                OnPropertyChanged(nameof(AccessibleName));
            }
        }
    }
    private int _maxColumns;

    public int MaxRows
    {
        get => _maxRows;
        set
        {
            if (SetProperty(ref _maxRows, value))
            {
                OnPropertyChanged(nameof(AccessibleName));
            }
        }
    }
    private int _maxRows;

    public Thickness CellBorderThickness
    {
        get => _cellBorderThickness;
        set => SetProperty(ref _cellBorderThickness, value);
    }
    private Thickness _cellBorderThickness = new Thickness(1);

    public bool WallNorth
    {
        get => _wallNorth;
        set
        {
            if (SetProperty(ref _wallNorth, value))
            {
                OnPropertyChanged(nameof(AccessibleName));
            }
        }
    }
    private bool _wallNorth;

    public bool WallSouth
    {
        get => _wallSouth;
        set
        {
            if (SetProperty(ref _wallSouth, value))
            {
                OnPropertyChanged(nameof(AccessibleName));
            }
        }
    }
    private bool _wallSouth;

    public bool WallWest
    {
        get => _wallWest;
        set
        {
            if (SetProperty(ref _wallWest, value))
            {
                OnPropertyChanged(nameof(AccessibleName));
            }
        }
    }
    private bool _wallWest;

    public bool WallEast
    {
        get => _wallEast;
        set
        {
            if (SetProperty(ref _wallEast, value))
            {
                OnPropertyChanged(nameof(AccessibleName));
            }
        }
    }
    private bool _wallEast;

    public int? OccupantPlayerId
    {
        get => _occupantPlayerId;
        set
        {
            if (SetProperty(ref _occupantPlayerId, value))
            {
                OnPropertyChanged(nameof(IsOccupied));
                OnPropertyChanged(nameof(Display));
                OnPropertyChanged(nameof(AccessibleName));
            }
        }
    }
    private int? _occupantPlayerId;

    public bool IsOccupied => OccupantPlayerId != null;

    public bool IsOwnPawn
    {
        get => _isOwnPawn;
        set
        {
            if (SetProperty(ref _isOwnPawn, value))
            {
                OnPropertyChanged(nameof(Display));
                OnPropertyChanged(nameof(AccessibleName));
            }
        }
    }
    private bool _isOwnPawn;

    public bool IsLegalMove
    {
        get => _isLegalMove;
        set
        {
            if (SetProperty(ref _isLegalMove, value))
            {
                OnPropertyChanged(nameof(AccessibleName));
            }
        }
    }
    private bool _isLegalMove;

    public IReadOnlyList<string> CellTags
    {
        get => _cellTags;
        set
        {
            if (SetProperty(ref _cellTags, value ?? Array.Empty<string>()))
            {
                OnPropertyChanged(nameof(AccessibleName));
            }
        }
    }
    private IReadOnlyList<string> _cellTags = Array.Empty<string>();

    public IReadOnlyList<string> ActionLabels
    {
        get => _actionLabels;
        set
        {
            if (SetProperty(ref _actionLabels, value ?? Array.Empty<string>()))
            {
                OnPropertyChanged(nameof(AccessibleName));
            }
        }
    }
    private IReadOnlyList<string> _actionLabels = Array.Empty<string>();

    public bool CanPlaceWallH
    {
        get => _canPlaceWallH;
        set
        {
            if (SetProperty(ref _canPlaceWallH, value))
            {
                OnPropertyChanged(nameof(AccessibleName));
            }
        }
    }
    private bool _canPlaceWallH;

    public bool CanPlaceWallV
    {
        get => _canPlaceWallV;
        set
        {
            if (SetProperty(ref _canPlaceWallV, value))
            {
                OnPropertyChanged(nameof(AccessibleName));
            }
        }
    }
    private bool _canPlaceWallV;

    public bool IsSelectedPawn
    {
        get => _isSelectedPawn;
        set
        {
            if (SetProperty(ref _isSelectedPawn, value))
            {
                OnPropertyChanged(nameof(AccessibleName));
            }
        }
    }
    private bool _isSelectedPawn;

    public bool IsCarryingPawn
    {
        get => _isCarryingPawn;
        set
        {
            if (SetProperty(ref _isCarryingPawn, value))
            {
                OnPropertyChanged(nameof(AccessibleName));
            }
        }
    }
    private bool _isCarryingPawn;

    public string Display
    {
        get
        {
            if (IsOwnPawn) return "●";
            if (IsOccupied) return "○";
            return string.Empty;
        }
    }

    public string AccessibleName
    {
        get
        {
            var parts = new List<string> { $"{CellRef}." };

            if (IsOwnPawn) parts.Add("Votre pion.");
            else if (IsOccupied) parts.Add("Pion adverse.");
            else parts.Add("Vide.");

            if (IsSelectedPawn) parts.Add("Sélectionné.");
            if (IsCarryingPawn) parts.Add("Pion en main.");

            if (IsLegalMove && IsCarryingPawn) parts.Add("Destination possible.");

            foreach (var tag in CellTags)
            {
                var t = (tag ?? string.Empty).Trim();
                if (string.IsNullOrWhiteSpace(t)) continue;
                parts.Add(t.EndsWith(".", StringComparison.Ordinal) ? t : $"{t}.");
            }

            if (CanPlaceWallH || CanPlaceWallV)
            {
                if (CanPlaceWallH && CanPlaceWallV) parts.Add("Mur possible.");
                else if (CanPlaceWallH) parts.Add("Mur horizontal possible.");
                else parts.Add("Mur vertical possible.");
            }

            if (WallNorth || WallSouth || WallWest || WallEast)
            {
                if (WallNorth) parts.Add("Mur au nord.");
                if (WallSouth) parts.Add("Mur au sud.");
                if (WallWest) parts.Add("Mur à l'ouest.");
                if (WallEast) parts.Add("Mur à l'est.");
            }

            return string.Join(" ", parts);
        }
    }
}
