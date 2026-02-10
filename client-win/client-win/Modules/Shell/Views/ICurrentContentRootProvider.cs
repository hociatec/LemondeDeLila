using System.Windows;

namespace client_win.Modules.Shell.Views;

public interface ICurrentContentRootProvider
{
    DependencyObject? TryGetCurrentContentRoot();
}

