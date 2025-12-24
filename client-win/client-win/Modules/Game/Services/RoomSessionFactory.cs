using System;
using Microsoft.Extensions.DependencyInjection;
using client_win.Modules.Config;
using client_win.Modules.Error;
using client_win.Modules.Game.Sessions;
using client_win.Modules.Network.WebSockets;
using client_win.Modules.User.Services;

namespace client_win.Modules.Game.Services;

public sealed class RoomSessionFactory : IRoomSessionFactory
{
    private readonly IServiceProvider _provider;

    public RoomSessionFactory(IServiceProvider provider)
    {
        _provider = provider ?? throw new ArgumentNullException(nameof(provider));
    }

    public RoomSession Create()
    {
        var connection = _provider.GetRequiredService<IWebSocketConnection>();
        var config = _provider.GetRequiredService<ClientConfiguration>();
        var session = _provider.GetRequiredService<ISessionService>();
        var errors = _provider.GetService<ErrorBus>();
        return new RoomSession(connection, config, session, errors);
    }
}
