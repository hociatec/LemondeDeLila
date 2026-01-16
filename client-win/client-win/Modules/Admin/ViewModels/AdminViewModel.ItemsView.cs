using System.Windows.Data;
using Serilog;

namespace client_win.Modules.Admin.ViewModels;

public sealed partial class AdminViewModel
{
    private void ConfigureItemsViewForPage()
    {
        // Defensive reset: the inputs view is shared between many admin screens.
        // Ensure we don't keep extra fields from the previous screen.
        //
        // Important: do not clear the multi-field question form while we are on the edit page.
        // Some navigation paths call this method after building the new screen (e.g. in a finally block),
        // so wiping fields here would hide inputs unexpectedly.
        if (_page != AdminPage.EditText)
        {
            PrimaryInputAcceptsReturn = true;
            IsThirdInputVisible = false;
            IsFourthInputVisible = false;
            IsFifthInputVisible = false;
            ThirdInputLabel = string.Empty;
            FourthInputLabel = string.Empty;
            FifthInputLabel = string.Empty;
            ThirdInput = string.Empty;
            FourthInput = string.Empty;
            FifthInput = string.Empty;
        }
        else
        {
            try { Log.Information("Admin: ConfigureItemsViewForPage skip reset (EditText)"); } catch { /* ignore */ }
        }

        using (ItemsView.DeferRefresh())
        {
            ItemsView.GroupDescriptions.Clear();
        }
    }
}

