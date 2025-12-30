using System;
using client_win.Modules.Network;
using client_win.Modules.User.Services;

namespace client_win.Modules.Admin.Services;

public sealed partial class AdminService : IAdminService
{
    private readonly WsRequestClient _ws;
    private readonly ISessionService _session;

    public AdminService(WsRequestClient ws, ISessionService session)
    {
        _ws = ws ?? throw new ArgumentNullException(nameof(ws));
        _session = session ?? throw new ArgumentNullException(nameof(session));
    }

    private string EnsureAuth()
    {
        var token = _session.CurrentUser?.Token;
        if (string.IsNullOrWhiteSpace(token))
        {
            throw new InvalidOperationException("Session non authentifiée.");
        }
        return token!;
    }
}
