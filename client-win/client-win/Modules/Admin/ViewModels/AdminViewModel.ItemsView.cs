using System.Windows.Data;

namespace client_win.Modules.Admin.ViewModels;

public sealed partial class AdminViewModel
{
    private void ConfigureItemsViewForPage()
    {
        using (ItemsView.DeferRefresh())
        {
            ItemsView.GroupDescriptions.Clear();
        }
    }
}

