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
            if (TryFocusListBoxIndexNow(ChoicesList, index))
            {
                UnhookChoicesListFocusObservers();
                return;
            }

            HookListFocusObservers(ChoicesList, index, requestId, isHandList: false);
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
            if (TryFocusListBoxIndexNow(HandList, index))
            {
                UnhookHandListFocusObservers();
                return;
            }

            HookListFocusObservers(HandList, index, requestId, isHandList: true);
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
            if (IsFocusWithinList(list))
            {
                return true;
            }
        }

        return false;
    }

    private bool IsFocusWithinList(ListBox list)
    {
        var focused = Keyboard.FocusedElement as DependencyObject;
        while (focused != null)
        {
            if (ReferenceEquals(focused, list))
            {
                return true;
            }

            focused = GetVisualOrLogicalParent(focused);
        }

        return false;
    }

    private void HookListFocusObservers(ListBox list, int index, int requestId, bool isHandList)
    {
        if (!IsListRequestCurrent(requestId, isHandList))
        {
            return;
        }

        if (isHandList)
        {
            UnhookHandListFocusObservers();
        }
        else
        {
            UnhookChoicesListFocusObservers();
        }

        EventHandler statusChanged = (_, _) =>
        {
            if (!IsListRequestCurrent(requestId, isHandList))
            {
                if (isHandList) UnhookHandListFocusObservers();
                else UnhookChoicesListFocusObservers();
                return;
            }

            if (TryFocusListBoxIndexNow(list, index))
            {
                if (isHandList) UnhookHandListFocusObservers();
                else UnhookChoicesListFocusObservers();
            }
        };

        EventHandler layoutUpdated = (_, _) =>
        {
            if (!IsListRequestCurrent(requestId, isHandList))
            {
                if (isHandList) UnhookHandListFocusObservers();
                else UnhookChoicesListFocusObservers();
                return;
            }

            if (TryFocusListBoxIndexNow(list, index))
            {
                if (isHandList) UnhookHandListFocusObservers();
                else UnhookChoicesListFocusObservers();
                return;
            }

        };

        if (isHandList)
        {
            _handListGeneratorStatusChanged = statusChanged;
            _handListLayoutUpdated = layoutUpdated;
        }
        else
        {
            _choicesListGeneratorStatusChanged = statusChanged;
            _choicesListLayoutUpdated = layoutUpdated;
        }

        list.ItemContainerGenerator.StatusChanged += statusChanged;
        list.LayoutUpdated += layoutUpdated;
    }

    private bool IsListRequestCurrent(int requestId, bool isHandList)
    {
        return isHandList
            ? requestId == _handFocusRequestId
            : requestId == _choicesFocusRequestId;
    }

    private void UnhookChoicesListFocusObservers()
    {
        if (ChoicesList == null)
        {
            return;
        }

        try
        {
            if (_choicesListGeneratorStatusChanged != null)
            {
                ChoicesList.ItemContainerGenerator.StatusChanged -= _choicesListGeneratorStatusChanged;
            }

            if (_choicesListLayoutUpdated != null)
            {
                ChoicesList.LayoutUpdated -= _choicesListLayoutUpdated;
            }
        }
        catch
        {
            // best-effort
        }
        finally
        {
            _choicesListGeneratorStatusChanged = null;
            _choicesListLayoutUpdated = null;
        }
    }

    private void UnhookHandListFocusObservers()
    {
        if (HandList == null)
        {
            return;
        }

        try
        {
            if (_handListGeneratorStatusChanged != null)
            {
                HandList.ItemContainerGenerator.StatusChanged -= _handListGeneratorStatusChanged;
            }

            if (_handListLayoutUpdated != null)
            {
                HandList.LayoutUpdated -= _handListLayoutUpdated;
            }
        }
        catch
        {
            // best-effort
        }
        finally
        {
            _handListGeneratorStatusChanged = null;
            _handListLayoutUpdated = null;
        }
    }
}

