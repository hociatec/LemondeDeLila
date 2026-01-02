using System;

namespace client_win.Modules.Admin.Services;

public interface IAdminMaintenanceTokenStore
{
    string? TryLoad();
    void Save(string token);
    void Clear();
    bool HasToken();
}

