using System.Windows.Data;

namespace client_win.Modules.Admin.ViewModels;

public sealed partial class AdminViewModel
{
    private void ConfigureItemsViewForPage()
    {
        // Defensive reset: the inputs view is shared between many admin screens.
        // Ensure we don't keep extra fields from the previous screen.
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

        using (ItemsView.DeferRefresh())
        {
            ItemsView.GroupDescriptions.Clear();
        }
    }
}

