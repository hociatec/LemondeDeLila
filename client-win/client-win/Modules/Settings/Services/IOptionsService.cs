using System;
using System.Threading.Tasks;
using client_win.Modules.Settings.Models;

namespace client_win.Modules.Settings.Services;

public interface IOptionsService
{
    OptionsState Current { get; }
    Task<string> OpenAsync();
    void Update(OptionsState state);
    event EventHandler? Changed;
}
