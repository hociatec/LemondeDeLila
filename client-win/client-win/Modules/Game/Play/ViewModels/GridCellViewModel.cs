using System;
using System.Collections.Generic;
using System.Collections.ObjectModel;
using System.Linq;
using System.Windows;
using client_win.Core;

namespace client_win.Modules.Game.Play.ViewModels
{
    public sealed class GridCellViewModel : ObservableObject
    {
        public GridCellViewModel(int x, int y, int index)
        {
            X = x;
            Y = y;
            Index = index;
            _cellTags = new ObservableCollection<string>();
            _actionLabels = new ObservableCollection<string>();
        }

        public int X { get; }
        public int Y { get; }
        public int Index { get; }

        public int Column => X + 1;
        public int Row => Y + 1;
        public string CellRef => ToColumnLetters(Column);

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
                    UpdateAccessibleName();
            }
        }
        private int _maxColumns;

        public int MaxRows
        {
            get => _maxRows;
            set
            {
                if (SetProperty(ref _maxRows, value))
                    UpdateAccessibleName();
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
                    UpdateAccessibleName();
            }
        }
        private bool _wallNorth;

        public bool WallSouth
        {
            get => _wallSouth;
            set
            {
                if (SetProperty(ref _wallSouth, value))
                    UpdateAccessibleName();
            }
        }
        private bool _wallSouth;

        public bool WallWest
        {
            get => _wallWest;
            set
            {
                if (SetProperty(ref _wallWest, value))
                    UpdateAccessibleName();
            }
        }
        private bool _wallWest;

        public bool WallEast
        {
            get => _wallEast;
            set
            {
                if (SetProperty(ref _wallEast, value))
                    UpdateAccessibleName();
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
                    _isDisplayDirty = true;
                    OnPropertyChanged(nameof(IsOccupied));
                    UpdateAccessibleName();
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
                    _isDisplayDirty = true;
                    UpdateAccessibleName();
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
                    UpdateAccessibleName();
            }
        }
        private bool _isLegalMove;

        public ObservableCollection<string> CellTags
        {
            get => _cellTags;
            set
            {
                if (SetProperty(ref _cellTags, value ?? new ObservableCollection<string>()))
                    UpdateAccessibleName();
            }
        }
        private ObservableCollection<string> _cellTags;

        public ObservableCollection<string> ActionLabels
        {
            get => _actionLabels;
            set
            {
                if (SetProperty(ref _actionLabels, value ?? new ObservableCollection<string>()))
                    UpdateAccessibleName();
            }
        }
        private ObservableCollection<string> _actionLabels;

        public bool CanPlaceWallH
        {
            get => _canPlaceWallH;
            set
            {
                if (SetProperty(ref _canPlaceWallH, value))
                    UpdateAccessibleName();
            }
        }
        private bool _canPlaceWallH;

        public bool CanPlaceWallV
        {
            get => _canPlaceWallV;
            set
            {
                if (SetProperty(ref _canPlaceWallV, value))
                    UpdateAccessibleName();
            }
        }
        private bool _canPlaceWallV;

        public bool IsSelectedPawn
        {
            get => _isSelectedPawn;
            set
            {
                if (SetProperty(ref _isSelectedPawn, value))
                    UpdateAccessibleName();
            }
        }
        private bool _isSelectedPawn;

        public bool IsCarryingPawn
        {
            get => _isCarryingPawn;
            set
            {
                if (SetProperty(ref _isCarryingPawn, value))
                    UpdateAccessibleName();
            }
        }
        private bool _isCarryingPawn;

        private string _displayCache = string.Empty;
        private bool _isDisplayDirty = true;
        public string Display
        {
            get
            {
                if (_isDisplayDirty)
                {
                    _displayCache = IsOwnPawn ? "●" : IsOccupied ? "○" : string.Empty;
                    _isDisplayDirty = false;
                }
                return _displayCache;
            }
        }

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

            if (IsOwnPawn)
                parts.Add("Votre pion.");
            else if (IsOccupied)
                parts.Add("Pion adverse.");
            else
                parts.Add("Vide.");

            if (IsSelectedPawn)
                parts.Add("Sélectionné.");
            if (IsCarryingPawn)
                parts.Add("Pion en main.");

            if (IsLegalMove && IsCarryingPawn)
                parts.Add("Destination possible.");

            foreach (var tag in CellTags)
            {
                var t = (tag ?? string.Empty).Trim();
                if (!string.IsNullOrWhiteSpace(t))
                    parts.Add(t.EndsWith(".") ? t : $"{t}.");
            }

            if (CanPlaceWallH || CanPlaceWallV)
            {
                if (CanPlaceWallH && CanPlaceWallV)
                    parts.Add("Mur possible.");
                else if (CanPlaceWallH)
                    parts.Add("Mur horizontal possible.");
                else
                    parts.Add("Mur vertical possible.");
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
}
