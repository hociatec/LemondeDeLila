using System.Windows.Controls;

namespace client_win.Modules.Shell.Services;

public sealed class HomeViewAccessor : IHomeViewAccessor
{
    public UserControl? HomeView { get; set; }
}

