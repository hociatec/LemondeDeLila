using System.Windows.Controls;

namespace client_win.Modules.Shell.Services;

public interface INavigationService
{
    UserControl? CurrentView { get; }
    UserContext CurrentUser { get; }
    void SetUser(UserContext user);
    void ClearUser();
    void Show(UserControl view);
}
