using System.Threading.Tasks;

namespace client_win.Modules.Shell.Services;

public interface IDialogService
{
    Task ShowError(string title, string message);
    Task ShowInfo(string title, string message);
    Task<bool?> Confirm(string title, string message, string? okText = null, string? cancelText = null);
}
