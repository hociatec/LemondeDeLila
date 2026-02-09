using System;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Controls.Primitives;
using System.Windows.Input;
using System.Windows.Threading;

namespace client_win.Modules.Game.Play.GamePlay.Views;

public partial class GamePlayView
{
    private static int ClampIndex(int index, int count)
    {
        if (count <= 0)
        {
            return 0;
        }

        if (index < 0)
        {
            return 0;
        }

        if (index >= count)
        {
            return count - 1;
        }

        return index;
    }

    private void RequestFocusChoiceListIndex(int index)
    {
        if (ChoicesList == null)
        {
            return;
        }

        var requestId = ++_choicesFocusRequestId;
        Dispatcher.BeginInvoke(DispatcherPriority.Loaded, new Action(() =>
        {
            TryFocusListBoxIndexWithRetry(ChoicesList, index, requestId, isHandList: false, remainingAttempts: 6);
        }));
    }

    private void RequestFocusHandListIndex(int index)
    {
        if (HandList == null)
        {
            return;
        }

        var requestId = ++_handFocusRequestId;
        Dispatcher.BeginInvoke(DispatcherPriority.Loaded, new Action(() =>
        {
            TryFocusListBoxIndexWithRetry(HandList, index, requestId, isHandList: true, remainingAttempts: 6);
        }));
    }

    private bool TryFocusListBoxIndexNow(ListBox list, int index)
    {
        if (list.Visibility != Visibility.Visible || list.Items.Count <= 0)
        {
            return false;
        }

        index = ClampIndex(index, list.Items.Count);

        try
        {
            list.ScrollIntoView(list.Items[index]);
        }
        catch
        {
            // ignore
        }

        if (list.ItemContainerGenerator.ContainerFromIndex(index) is ListBoxItem item)
        {
            item.Focus();
            Keyboard.Focus(item);
            return true;
        }

        return false;
    }

    private void TryFocusListBoxIndexWithRetry(ListBox list, int index, int requestId, bool isHandList, int remainingAttempts)
    {
        if (isHandList)
        {
            if (requestId != _handFocusRequestId)
            {
                return;
            }
        }
        else
        {
            if (requestId != _choicesFocusRequestId)
            {
                return;
            }
        }

        if (TryFocusListBoxIndexNow(list, index))
        {
            return;
        }

        if (remainingAttempts <= 0)
        {
            list.Focus();
            Keyboard.Focus(list);
            return;
        }

        Dispatcher.BeginInvoke(DispatcherPriority.Loaded, new Action(() =>
        {
            TryFocusListBoxIndexWithRetry(list, index, requestId, isHandList, remainingAttempts - 1);
        }));
    }
}

