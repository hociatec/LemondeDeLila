using System.Windows;
using System.Windows.Controls;

namespace client_win.Modules.Game.Shell.Views;

public partial class GameRoomHeaderView : UserControl
{
    public GameRoomHeaderView()
    {
        InitializeComponent();
    }

    public FrameworkElement? NameFocusTarget => GameNameEntry;
}
