using System.Collections.ObjectModel;
using System.Windows;
using client_win.Core;

namespace client_win.Modules.Game.Play.Grid.ViewModels;

public sealed partial class GridCellViewModel : ObservableObject
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
    public int Row => MaxRows > 0 ? (MaxRows - Y) : (Y + 1);
    public string CellRef => $"{GridColumnLetters.ToColumnLetters(Column)}{Row}";

    private int _maxColumns;
    public int MaxColumns
    {
        get => _maxColumns;
        set
        {
            if (SetProperty(ref _maxColumns, value))
            {
                UpdateAccessibleName();
            }
        }
    }

    private int _maxRows;
    public int MaxRows
    {
        get => _maxRows;
        set
        {
            if (SetProperty(ref _maxRows, value))
            {
                UpdateAccessibleName();
            }
        }
    }

    private Thickness _cellBorderThickness = new(1);
    public Thickness CellBorderThickness
    {
        get => _cellBorderThickness;
        set => SetProperty(ref _cellBorderThickness, value);
    }
}
