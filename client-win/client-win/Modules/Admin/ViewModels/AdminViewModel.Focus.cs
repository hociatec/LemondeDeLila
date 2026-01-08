using System;
using System.Collections.Generic;
using System.Linq;
using client_win.Modules.Admin.Dtos;

namespace client_win.Modules.Admin.ViewModels;

public sealed partial class AdminViewModel
{
    private readonly Stack<(AdminPage Page, object? Tag)> _focusStack = new();

    private void PushReturnFocus()
    {
        var tag = SelectedItem?.Tag;
        _focusStack.Push((_page, tag));
    }

    private void RestoreFocusIfAny()
    {
        ConfigureItemsViewForPage();

        if (_focusStack.Count == 0) return;
        var (page, tag) = _focusStack.Peek();
        if (page != _page) return;

        var match = Items.FirstOrDefault(i => TagsMatch(i.Tag, tag));
        if (match != null)
        {
            SelectedItem = match;
        }

        _focusStack.Pop();
    }

    private static bool TagsMatch(object? a, object? b)
    {
        if (a == null || b == null) return false;

        if (a is string sa && b is string sb)
        {
            return string.Equals(sa, sb, StringComparison.Ordinal);
        }

        if (a is AdminUserDto ua && b is AdminUserDto ub)
        {
            return ua.Id == ub.Id;
        }

        if (a is AdminBotNameDto ba && b is AdminBotNameDto bb)
        {
            return ba.Id == bb.Id;
        }

        if (a is AdminGameDto ga && b is AdminGameDto gb)
        {
            return string.Equals(ga.Id, gb.Id, StringComparison.OrdinalIgnoreCase);
        }

        if (a is AdminChatMessageDto ma && b is AdminChatMessageDto mb)
        {
            return string.Equals(ma.Id, mb.Id, StringComparison.OrdinalIgnoreCase);
        }

        // Supporte les tags records internes (ex: ChatDayTag) via Equals().
        return EqualityComparer<object>.Default.Equals(a, b);
    }
}
