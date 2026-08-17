using System.Collections.Generic;
using System.Linq;
using System.Windows;

namespace client_win.Modules.Shell.Views;

public partial class CachedContentHost
{
    private void EvictIfNeeded()
    {
        try
        {
            EvictNonCacheables();

            var count = _entries.Count(e => e.Value.Cacheable);
            if (count <= MaxCacheEntries)
            {
                return;
            }

            var protectedContents = GetProtectedContents();

            foreach (var candidate in _entries.Values
                         .Where(e => e.Cacheable && !protectedContents.Contains(e.Content))
                         .OrderBy(e => e.LastAccessTicks)
                         .Take(Math.Max(0, count - MaxCacheEntries))
                         .ToArray())
            {
                RemoveEntry(candidate);
            }
        }
        catch
        {
            // best-effort
        }
    }

    private void EvictNonCacheables()
    {
        try
        {
            var protectedContents = GetProtectedContents();

            foreach (var candidate in _entries.Values
                         .Where(e => !e.Cacheable && !protectedContents.Contains(e.Content))
                         .ToArray())
            {
                RemoveEntry(candidate);
            }
        }
        catch
        {
            // best-effort
        }
    }

    private HashSet<object> GetProtectedContents()
    {
        var protectedContents = new HashSet<object>(ReferenceEqualityComparer.Instance);
        if (_current != null)
        {
            protectedContents.Add(_current.Content);
        }

        if (_previous != null)
        {
            protectedContents.Add(_previous.Content);
        }

        return protectedContents;
    }

    private void RemoveEntry(Entry entry)
    {
        if (entry.IsInHostGrid)
        {
            HostGrid.Children.Remove(entry.Presenter);
            entry.IsInHostGrid = false;
        }

        _entries.Remove(entry.Content);
    }
}
