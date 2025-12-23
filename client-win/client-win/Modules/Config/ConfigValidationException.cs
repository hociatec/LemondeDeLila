using System;

namespace client_win.Modules.Config;

public sealed class ConfigValidationException : Exception
{
    public ConfigValidationException(string message) : base(message)
    {
    }
}
