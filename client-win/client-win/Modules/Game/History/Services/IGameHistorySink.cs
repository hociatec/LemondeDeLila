namespace client_win.Modules.Game.History.Services;

public interface IGameHistorySink
{
    void Add(string message);
    void AddChat(string message);
}
