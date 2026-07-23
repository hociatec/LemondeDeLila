namespace client_win.Modules.Shell.Services;

public sealed class ShellNavigationContext
{
    public ShellNavigationContext(ShellRoute route, object content, UserContext user)
    {
        Route = route;
        Content = content;
        User = user;
    }

    public ShellRoute Route { get; }

    public object Content { get; }

    public UserContext User { get; }
}
