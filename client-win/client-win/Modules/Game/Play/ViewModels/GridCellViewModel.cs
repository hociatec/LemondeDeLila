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
            var parts = new List<string> { $"Colonne {Column}, ligne {Row}." };

            if (IsOwnPawn) parts.Add("Votre pion.");
            else if (IsOccupied) parts.Add("Pion adverse.");
            else parts.Add("Vide.");

            if (IsSelectedPawn) parts.Add("Sélectionné.");
            if (IsCarryingPawn) parts.Add("Pion en main.");

            if (IsLegalMove && IsCarryingPawn) parts.Add("Déplacement disponible.");

            if (CanPlaceWallH || CanPlaceWallV)
            {
                if (CanPlaceWallH && CanPlaceWallV) parts.Add("Mur disponible (horizontal ou vertical).");
                else if (CanPlaceWallH) parts.Add("Mur horizontal disponible.");
                else parts.Add("Mur vertical disponible.");
            }

            if (WallNorth || WallSouth || WallWest || WallEast)
            {
                var walls = new List<string>();
                if (WallNorth) walls.Add("nord");
                if (WallSouth) walls.Add("sud");
                if (WallWest) walls.Add("ouest");
                if (WallEast) walls.Add("est");
                parts.Add($"Mur : {string.Join(", ", walls)}.");
            }

            if (ActionLabels.Count > 0)
            {
                var shown = ActionLabels.Take(3).ToArray();
                var suffix = ActionLabels.Count > shown.Length ? $" (+{ActionLabels.Count - shown.Length})" : string.Empty;
                parts.Add($"Actions : {string.Join(", ", shown)}{suffix}.");
            }

            return string.Join(" ", parts);
        }
    }
}
