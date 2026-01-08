using System.Windows.Data;

namespace client_win.Modules.Admin.ViewModels;

public sealed partial class AdminViewModel
{
    private bool _isRootGroupingApplied;

    private void ConfigureItemsViewForPage()
    {
        var shouldGroup = _page == AdminPage.Root;
        if (_isRootGroupingApplied == shouldGroup)
        {
            return;
        }

        using (ItemsView.DeferRefresh())
        {
            ItemsView.GroupDescriptions.Clear();
            if (shouldGroup)
            {
                ItemsView.GroupDescriptions.Add(new PropertyGroupDescription(nameof(AdminMenuItem.Category)));
            }
        }

        _isRootGroupingApplied = shouldGroup;
    }
}

