using System.Threading;
using System.Threading.Tasks;

namespace client_win.Modules.Shell.Services;

public interface IShellNavigationAware
{
    Task OnNavigatedToAsync(ShellNavigationContext context, CancellationToken cancellationToken);

    Task OnNavigatedFromAsync(ShellNavigationContext context, CancellationToken cancellationToken);
}
