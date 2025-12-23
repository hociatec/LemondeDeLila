using client_win.Core;

namespace client_win.Modules.Chat.Views;

public sealed class ChatWindowFactory : IViewFactory<ChatWindow>
{
    public ChatWindow Create() => new ChatWindow();
}
