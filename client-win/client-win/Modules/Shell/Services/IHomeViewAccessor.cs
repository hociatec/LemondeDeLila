namespace client_win.Modules.Shell.Services;

/// <summary>
/// Stores a reference to the "home" view (menu principal) so other modules can reliably navigate back to it.
/// </summary>
public interface IHomeViewAccessor
{
    object? HomeContent { get; set; }
}

