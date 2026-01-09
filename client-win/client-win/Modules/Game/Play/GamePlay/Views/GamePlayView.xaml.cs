using System.Windows.Controls;

namespace client_win.Modules.Game.Play.GamePlay.Views;

public partial class GamePlayView : UserControl
{
    public GamePlayView()
    {
        InitializeComponent();
        DataContextChanged += OnDataContextChanged;
        Unloaded += OnUnloaded;
    }
}
