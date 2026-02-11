namespace client_win.Modules.Shell.Services;

/// <summary>
/// Per-content caching policy for the shell root host.
/// When implemented by a view-model/content instance, it overrides the host's default type-based rules.
/// </summary>
public interface IShellContentCachePolicy
{
    bool IsCacheable { get; }
}

