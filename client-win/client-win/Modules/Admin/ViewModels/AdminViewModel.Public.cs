namespace client_win.Modules.Admin.ViewModels;

public sealed partial class AdminViewModel
{
    public void ShowRootMenu()
    {
        try
        {
            BuildRoot();
        }
        catch
        {
            // best-effort
        }

        try
        {
            NavigationChanged?.Invoke();
        }
        catch
        {
            // best-effort
        }
    }
}

