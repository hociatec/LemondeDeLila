using System;

namespace client_win.Modules.Game.Play.Services;

public interface IGameAnnouncements
{
    void ShortcutKey(string key);
    void Info(string message);
    void Error(string message);
}

