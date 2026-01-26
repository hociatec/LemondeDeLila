namespace client_win.Modules.Game.History.Services;

public interface IGameHistorySink
{
    void Add(string message, string? timestamp = null);
    void AddChat(string message);
}
