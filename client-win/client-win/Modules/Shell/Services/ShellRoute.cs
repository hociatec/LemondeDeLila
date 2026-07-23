using System;

namespace client_win.Modules.Shell.Services;

public sealed class ShellRoute
{
    private ShellRoute(string key, string contentType)
    {
        Key = key;
        ContentType = contentType;
    }

    public string Key { get; }

    public string ContentType { get; }

    public static ShellRoute FromContent(object content)
    {
        ArgumentNullException.ThrowIfNull(content);

        var type = content.GetType();
        var fullName = type.FullName ?? type.Name;
        return new ShellRoute(fullName, type.Name);
    }
}
