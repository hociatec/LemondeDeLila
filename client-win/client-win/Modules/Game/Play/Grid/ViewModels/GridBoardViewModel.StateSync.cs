using System;
using System.Collections.Generic;
using System.Collections.ObjectModel;
using System.Globalization;
using System.Linq;
using System.Text.Json;
using System.Windows;
using client_win.Modules.Audio.Models;
using client_win.Modules.Game.Play.Grid.Services;
using client_win.Modules.Game.Play.State.Dtos;

namespace client_win.Modules.Game.Play.Grid.ViewModels;

public sealed partial class GridBoardViewModel
{
    private readonly Dictionary<string, CellSyncSnapshot> _lastCellSyncByKey =
        new(StringComparer.OrdinalIgnoreCase);

    private void SyncFromStateCore(GameStateDto state, int? viewerPlayerId)
    {
        if (state == null)
        {
            IsVisible = false;
            Status = string.Empty;
            _lastCellSyncByKey.Clear();
            _pawnPositionsPrimed = false;
            _lastPawnPosByOwnerId.Clear();
            _wallLayoutPrimed = false;
            _lastWallLayoutHash = 0;
            _pendingSelfWallSound = false;
            return;
        }

        _viewerPlayerId = viewerPlayerId;

        var currentTurnIndex = state.TurnIndex;
        var currentTurnPlayerId = state.Turn?.CurrentPlayerId;
        int? actorPlayerId = null;
        if (_lastSeenTurnIndex >= 0 && currentTurnIndex != _lastSeenTurnIndex)
        {
            actorPlayerId = _lastSeenCurrentPlayerId;
        }
        _lastSeenTurnIndex = currentTurnIndex;
        _lastSeenCurrentPlayerId = currentTurnPlayerId;

        if (!TryReadGridSize(state, out var size))
        {
            IsVisible = false;
            Status = string.Empty;
            _lastCellSyncByKey.Clear();
            _pawnPositionsPrimed = false;
            _lastPawnPosByOwnerId.Clear();
            _wallLayoutPrimed = false;
            _lastWallLayoutHash = 0;
            _pendingSelfWallSound = false;
            RefreshCanExecute();
            return;
        }

        IsVisible = true;
        EnsureCells(size);

        var entitiesByKey = TryReadGridEntities(state);
        var cellTagsByKey = TryReadGridCellTags(state);
        var playerNameById = (state.Players ?? new List<GamePlayerDto>())
            .Where(p => p != null && p.Id != 0)
            .GroupBy(p => p.Id)
            .ToDictionary(
                g => g.Key,
                g => (g.FirstOrDefault()?.Username ?? string.Empty).Trim());
        TryPlayPawnPlaceSounds(entitiesByKey, playerNameById);
        SyncGridStatus(state);

        var renderByKey = TryReadGridRenderCells(state);
        BuildGridActionsIndex(state);
        _isEntityGrabbed = false;

        for (var i = 0; i < Cells.Count; i++)
        {
            var cell = Cells[i];
            var key = GridCellKey.From(cell);

            var border = new Thickness(1);
            var wallNorth = false;
            var wallEast = false;
            var wallSouth = false;
            var wallWest = false;
            if (renderByKey.TryGetValue(key, out var renderCell))
            {
                border = renderCell.Border;
                wallNorth = renderCell.WallNorth;
                wallEast = renderCell.WallEast;
                wallSouth = renderCell.WallSouth;
                wallWest = renderCell.WallWest;
            }

            var entities = entitiesByKey.TryGetValue(key, out var list) ? list : null;
            var safeEntities = entities ?? new List<GridEntity>();
            var entitiesCount = safeEntities.Count;
            var glyph = entitiesCount > 0
                ? safeEntities.Select(e => e.Glyph).FirstOrDefault(s => !string.IsNullOrWhiteSpace(s)) ?? string.Empty
                : string.Empty;

            var hasOwnPawn = false;
            var hasOpponentPawn = false;
            var ownPawnUsername = string.Empty;
            var opponentPawnUsername = string.Empty;
            var entityTypes = Array.Empty<string>();

            if (entitiesCount > 0)
            {
                if (_viewerPlayerId is > 0)
                {
                    var viewerId = _viewerPlayerId.Value;
                    hasOwnPawn = safeEntities.Any(e => e.OwnerId == viewerId);
                    hasOpponentPawn = safeEntities.Any(e => e.OwnerId != null && e.OwnerId != viewerId);

                    if (hasOwnPawn && playerNameById.TryGetValue(viewerId, out var ownName))
                    {
                        ownPawnUsername = ownName;
                    }

                    var opponentOwnerId = safeEntities
                        .Select(e => e.OwnerId)
                        .FirstOrDefault(id => id != null && id.Value != viewerId);
                    if (opponentOwnerId != null &&
                        playerNameById.TryGetValue(opponentOwnerId.Value, out var opponentName))
                    {
                        opponentPawnUsername = opponentName;
                    }
                }

                entityTypes = safeEntities
                    .Select(e => e.Type)
                    .Where(s => !string.IsNullOrWhiteSpace(s))
                    .Distinct(StringComparer.OrdinalIgnoreCase)
                    .ToArray();
            }

            var tags = cellTagsByKey.TryGetValue(key, out var cellTags) && cellTags.Length > 0
                ? cellTags
                : Array.Empty<string>();

            string[] actionLabels = Array.Empty<string>();
            var canPlaceWallH = false;
            var canPlaceWallV = false;
            if (_gridActionsByCellKey.TryGetValue(key, out var actions) && actions.Count > 0)
            {
                actionLabels = actions
                    .Select(a => a.Label)
                    .Where(s => !string.IsNullOrWhiteSpace(s))
                    .ToArray();
                canPlaceWallH = actions.Any(a => a.HasOrientation && HasOrientation(a.Payload, "h"));
                canPlaceWallV = actions.Any(a => a.HasOrientation && HasOrientation(a.Payload, "v"));
            }

            var snapshot = new CellSyncSnapshot(
                border,
                wallNorth,
                wallEast,
                wallSouth,
                wallWest,
                glyph,
                entitiesCount,
                hasOwnPawn,
                hasOpponentPawn,
                ownPawnUsername,
                opponentPawnUsername,
                entityTypes,
                tags,
                actionLabels,
                canPlaceWallH,
                canPlaceWallV);

            if (_lastCellSyncByKey.TryGetValue(key, out var previous) &&
                CellSyncSnapshotEquals(previous, snapshot))
            {
                continue;
            }

            _lastCellSyncByKey[key] = snapshot;
            ApplyCellSyncSnapshot(cell, snapshot);
        }

        TryPlayWallPlacedSound();
        SyncWallHistory(state.Metadata, playerNameById, actorPlayerId);

        RefreshCanExecute();
    }

    private readonly record struct CellSyncSnapshot(
        Thickness Border,
        bool WallNorth,
        bool WallEast,
        bool WallSouth,
        bool WallWest,
        string Glyph,
        int EntitiesCount,
        bool HasOwnPawn,
        bool HasOpponentPawn,
        string OwnPawnUsername,
        string OpponentPawnUsername,
        string[] EntityTypes,
        string[] CellTags,
        string[] ActionLabels,
        bool CanPlaceWallH,
        bool CanPlaceWallV);

    private static bool CellSyncSnapshotEquals(CellSyncSnapshot a, CellSyncSnapshot b)
    {
        return a.Border.Equals(b.Border) &&
               a.WallNorth == b.WallNorth &&
               a.WallEast == b.WallEast &&
               a.WallSouth == b.WallSouth &&
               a.WallWest == b.WallWest &&
               a.EntitiesCount == b.EntitiesCount &&
               a.HasOwnPawn == b.HasOwnPawn &&
               a.HasOpponentPawn == b.HasOpponentPawn &&
               string.Equals(a.Glyph, b.Glyph, StringComparison.Ordinal) &&
               string.Equals(a.OwnPawnUsername, b.OwnPawnUsername, StringComparison.Ordinal) &&
               string.Equals(a.OpponentPawnUsername, b.OpponentPawnUsername, StringComparison.Ordinal) &&
               SequenceEqualOrdinal(a.EntityTypes, b.EntityTypes) &&
               SequenceEqualOrdinal(a.CellTags, b.CellTags) &&
               SequenceEqualOrdinal(a.ActionLabels, b.ActionLabels) &&
               a.CanPlaceWallH == b.CanPlaceWallH &&
               a.CanPlaceWallV == b.CanPlaceWallV;
    }

    private static bool SequenceEqualOrdinal(IReadOnlyList<string> a, IReadOnlyList<string> b)
    {
        if (ReferenceEquals(a, b))
        {
            return true;
        }
        if (a == null || b == null || a.Count != b.Count)
        {
            return false;
        }
        for (var i = 0; i < a.Count; i++)
        {
            if (!string.Equals(a[i], b[i], StringComparison.Ordinal))
            {
                return false;
            }
        }
        return true;
    }

    private static void ApplyCellSyncSnapshot(GridCellViewModel cell, CellSyncSnapshot snapshot)
    {
        cell.CellBorderThickness = snapshot.Border;
        cell.WallNorth = snapshot.WallNorth;
        cell.WallEast = snapshot.WallEast;
        cell.WallSouth = snapshot.WallSouth;
        cell.WallWest = snapshot.WallWest;
        cell.Glyph = snapshot.Glyph;
        cell.EntitiesCount = snapshot.EntitiesCount;
        cell.HasOwnPawn = snapshot.HasOwnPawn;
        cell.HasOpponentPawn = snapshot.HasOpponentPawn;
        cell.OwnPawnUsername = snapshot.OwnPawnUsername;
        cell.OpponentPawnUsername = snapshot.OpponentPawnUsername;
        SyncStringCollection(cell.EntityTypes, snapshot.EntityTypes);
        SyncStringCollection(cell.CellTags, snapshot.CellTags);
        SyncStringCollection(cell.ActionLabels, snapshot.ActionLabels);
        cell.CanPlaceWallH = snapshot.CanPlaceWallH;
        cell.CanPlaceWallV = snapshot.CanPlaceWallV;
    }

    private static void SyncStringCollection(
        ObservableCollection<string> target,
        IReadOnlyList<string> source)
    {
        if (target == null)
        {
            return;
        }

        if (source == null || source.Count == 0)
        {
            if (target.Count > 0)
            {
                target.Clear();
            }
            return;
        }

        var srcCount = source.Count;
        for (var i = 0; i < srcCount; i++)
        {
            var next = source[i] ?? string.Empty;
            if (i < target.Count)
            {
                if (!string.Equals(target[i], next, StringComparison.Ordinal))
                {
                    target[i] = next;
                }
            }
            else
            {
                target.Add(next);
            }
        }

        while (target.Count > srcCount)
        {
            target.RemoveAt(target.Count - 1);
        }
    }

    private void TryPlayWallPlacedSound()
    {
        if (!IsVisible || Size <= 0 || Cells.Count == 0)
        {
            _wallLayoutPrimed = false;
            _lastWallLayoutHash = 0;
            _pendingSelfWallSound = false;
            return;
        }

        unchecked
        {
            var hash = 17;
            foreach (var cell in Cells)
            {
                hash = hash * 31 + (cell.WallNorth ? 1 : 0);
                hash = hash * 31 + (cell.WallSouth ? 1 : 0);
                hash = hash * 31 + (cell.WallWest ? 1 : 0);
                hash = hash * 31 + (cell.WallEast ? 1 : 0);
            }

            if (!_wallLayoutPrimed)
            {
                _wallLayoutPrimed = true;
                _lastWallLayoutHash = hash;
                _pendingSelfWallSound = false;
                return;
            }

            if (hash == _lastWallLayoutHash)
            {
                return;
            }

            _lastWallLayoutHash = hash;

            if (_pendingSelfWallSound)
            {
                _pendingSelfWallSound = false;
                _sounds.Play(SoundId.WallPlacedSelf);
            }
            else
            {
                _sounds.Play(SoundId.WallPlacedOpponent);
            }
        }
    }

    private void TryPlayPawnPlaceSounds(
        Dictionary<string, List<GridEntity>> entitiesByKey,
        Dictionary<int, string> playerNameById)
    {
        if (_viewerPlayerId is not > 0)
        {
            _pawnPositionsPrimed = false;
            _lastPawnPosByOwnerId.Clear();
            return;
        }

        var next = new Dictionary<int, (int X, int Y)>();
        foreach (var kv in entitiesByKey)
        {
            if (!TryParseCellKey(kv.Key, out var x, out var y))
            {
                continue;
            }

            foreach (var e in kv.Value ?? new List<GridEntity>())
            {
                if (e.OwnerId == null)
                {
                    continue;
                }

                if (!string.Equals(e.Type, "pawn", StringComparison.OrdinalIgnoreCase))
                {
                    continue;
                }

                next[e.OwnerId.Value] = (x, y);
            }
        }

        if (!_pawnPositionsPrimed)
        {
            _pawnPositionsPrimed = true;
            _lastPawnPosByOwnerId.Clear();
            foreach (var kv in next)
            {
                _lastPawnPosByOwnerId[kv.Key] = kv.Value;
            }
            return;
        }

        var viewerId = _viewerPlayerId.Value;
        var selfMoved = false;
        var opponentMoved = false;
        var movementDiffs = new List<(int PlayerId, (int X, int Y) From, (int X, int Y) To)>();

        foreach (var kv in next)
        {
            if (!_lastPawnPosByOwnerId.TryGetValue(kv.Key, out var prev))
            {
                continue;
            }

            if (prev.X == kv.Value.X && prev.Y == kv.Value.Y)
            {
                continue;
            }

            if (kv.Key == viewerId)
            {
                selfMoved = true;
            }
            else
            {
                opponentMoved = true;
            }
            movementDiffs.Add((kv.Key, prev, kv.Value));
        }

        if (selfMoved)
        {
            _sounds.Play(SoundId.PawnPlacedSelf);
        }
        else if (opponentMoved)
        {
            _sounds.Play(SoundId.PawnPlacedOpponent);
        }

        AnnouncePawnMoves(movementDiffs, playerNameById);

        _lastPawnPosByOwnerId.Clear();
        foreach (var kv in next)
        {
            _lastPawnPosByOwnerId[kv.Key] = kv.Value;
        }
    }

    private void EnsureCells(int size)
    {
        var safe = size <= 0 ? 9 : size;
        Size = safe;
        if (Cells.Count != safe * safe)
        {
            Cells.Clear();
            _lastCellSyncByKey.Clear();
            for (var y = 0; y < safe; y++)
            {
                for (var x = 0; x < safe; x++)
                {
                    var idx = y * safe + x;
                    Cells.Add(new GridCellViewModel(x, y, idx));
                }
            }
        }

        foreach (var cell in Cells)
        {
            cell.MaxColumns = safe;
            cell.MaxRows = safe;
        }
    }

    private sealed record GridEntity(int X, int Y, int? OwnerId, string Type, string Glyph);

    private static Dictionary<string, List<GridEntity>> TryReadGridEntities(GameStateDto state)
    {
        var dict = new Dictionary<string, List<GridEntity>>(StringComparer.OrdinalIgnoreCase);
        try
        {
            if (state.Extras.ValueKind != System.Text.Json.JsonValueKind.Object ||
                !state.Extras.TryGetProperty("grid", out var grid) ||
                grid.ValueKind != System.Text.Json.JsonValueKind.Object ||
                !grid.TryGetProperty("entities", out var entities) ||
                entities.ValueKind != System.Text.Json.JsonValueKind.Array)
            {
                return dict;
            }

            foreach (var item in entities.EnumerateArray())
            {
                if (item.ValueKind != System.Text.Json.JsonValueKind.Object)
                {
                    continue;
                }

                var x = item.TryGetProperty("x", out var xNode) && xNode.TryGetInt32(out var xi) ? xi : int.MinValue;
                var y = item.TryGetProperty("y", out var yNode) && yNode.TryGetInt32(out var yi) ? yi : int.MinValue;
                if (x == int.MinValue || y == int.MinValue)
                {
                    continue;
                }

                int? ownerId = null;
                if (item.TryGetProperty("ownerId", out var oNode) &&
                    oNode.ValueKind == System.Text.Json.JsonValueKind.Number &&
                    oNode.TryGetInt32(out var oi))
                {
                    ownerId = oi;
                }

                var type = item.TryGetProperty("type", out var tNode) && tNode.ValueKind == System.Text.Json.JsonValueKind.String
                    ? (tNode.GetString() ?? string.Empty).Trim()
                    : string.Empty;
                var glyph = item.TryGetProperty("glyph", out var gNode) && gNode.ValueKind == System.Text.Json.JsonValueKind.String
                    ? (gNode.GetString() ?? string.Empty)
                    : string.Empty;

                var key = GridCellKey.From(x, y);
                if (!dict.TryGetValue(key, out var list))
                {
                    list = new List<GridEntity>();
                    dict[key] = list;
                }

                list.Add(new GridEntity(x, y, ownerId, type, glyph));
            }
        }
        catch
        {
            // ignore
        }

        return dict;
    }

    private static bool TryParseCellKey(string raw, out int x, out int y)
    {
        x = 0;
        y = 0;
        var parts = (raw ?? string.Empty).Split(',');
        if (parts.Length != 2)
        {
            return false;
        }

        return int.TryParse(parts[0], out x) && int.TryParse(parts[1], out y);
    }

    private void AnnouncePawnMoves(
        List<(int PlayerId, (int X, int Y) From, (int X, int Y) To)> moves,
        Dictionary<int, string> playerNameById)
    {
        if (ShouldSuppressGridHistoryAnnouncements())
        {
            return;
        }

        if (moves == null || moves.Count == 0 || _viewerPlayerId is not > 0 || !_pawnPositionsPrimed)
        {
            return;
        }

        var viewerId = _viewerPlayerId.Value;
        foreach (var diff in moves)
        {
            if (diff.PlayerId == viewerId)
            {
                continue;
            }

            var actorName = FormatPlayerName(diff.PlayerId, playerNameById);
            var from = FormatCellRef(diff.From.X, diff.From.Y, Size);
            var to = FormatCellRef(diff.To.X, diff.To.Y, Size);
            _announce($"{actorName} se déplace de {from} à {to}.");
        }
    }

    private void SyncWallHistory(
        JsonElement metadata,
        Dictionary<int, string> playerNameById,
        int? actorId)
    {
        var (horizontal, vertical) = ExtractWallSets(metadata);
        if (ShouldSuppressGridHistoryAnnouncements())
        {
            _previousHorizontalWalls = horizontal;
            _previousVerticalWalls = vertical;
            return;
        }

        var newHorizontals = horizontal.Except(_previousHorizontalWalls).ToList();
        var newVerticals = vertical.Except(_previousVerticalWalls).ToList();

        if (actorId != null)
        {
            var actorName = FormatPlayerName(actorId.Value, playerNameById);
            foreach (var key in newHorizontals)
            {
                if (TryParseWallKey(key, out var x, out var y))
                {
                    var cell = FormatCellRef(x, y, Size);
                    _announce($"{actorName} place un mur horizontal en {cell}.");
                }
            }
            foreach (var key in newVerticals)
            {
                if (TryParseWallKey(key, out var x, out var y))
                {
                    var cell = FormatCellRef(x, y, Size);
                    _announce($"{actorName} place un mur vertical en {cell}.");
                }
            }
        }

        _previousHorizontalWalls = horizontal;
        _previousVerticalWalls = vertical;
    }

    private bool ShouldSuppressGridHistoryAnnouncements()
    {
        return string.Equals(_gameId, "corridor", StringComparison.OrdinalIgnoreCase);
    }

    private static (HashSet<string> Horizontal, HashSet<string> Vertical) ExtractWallSets(JsonElement metadata)
    {
        var horizontal = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        var vertical = new HashSet<string>(StringComparer.OrdinalIgnoreCase);

        if (metadata.ValueKind != JsonValueKind.Object)
        {
            return (horizontal, vertical);
        }

        if (!metadata.TryGetProperty("walls", out var walls) || walls.ValueKind != JsonValueKind.Object)
        {
            return (horizontal, vertical);
        }

        void Collect(JsonElement parent, string property, HashSet<string> target)
        {
            if (!parent.TryGetProperty(property, out var arr) || arr.ValueKind != JsonValueKind.Array)
            {
                return;
            }

            foreach (var entry in arr.EnumerateArray())
            {
                string? value = entry.ValueKind switch
                {
                    JsonValueKind.String => entry.GetString(),
                    JsonValueKind.Number => entry.GetRawText(),
                    _ => entry.ToString()
                };

                var trimmed = (value ?? string.Empty).Trim();
                if (trimmed.Length > 0)
                {
                    target.Add(trimmed);
                }
            }
        }

        Collect(walls, "h", horizontal);
        Collect(walls, "v", vertical);
        return (horizontal, vertical);
    }

    private static bool TryParseWallKey(string raw, out int x, out int y)
    {
        x = 0;
        y = 0;
        if (string.IsNullOrWhiteSpace(raw))
        {
            return false;
        }

        var parts = raw.Split(',');
        if (parts.Length != 2)
        {
            return false;
        }

        return int.TryParse(parts[0], NumberStyles.Integer, CultureInfo.InvariantCulture, out x) &&
               int.TryParse(parts[1], NumberStyles.Integer, CultureInfo.InvariantCulture, out y);
    }

    private static string FormatCellRef(int x, int y, int size)
    {
        if (size <= 0)
        {
            return $"{x},{y}";
        }

        var column = ToColumnLetters(x + 1);
        var row = Math.Max(1, size - y);
        return $"{column}{row}";
    }

    private static string ToColumnLetters(int column)
    {
        var n = Math.Max(1, column);
        var builder = string.Empty;
        while (n > 0)
        {
            n--;
            builder = $"{(char)('A' + (n % 26))}{builder}";
            n /= 26;
        }
        return builder;
    }

    private static string FormatPlayerName(int playerId, Dictionary<int, string> names)
    {
        if (names != null && names.TryGetValue(playerId, out var name) && !string.IsNullOrWhiteSpace(name))
        {
            return name;
        }

        return playerId <= 0 ? $"Bot {Math.Abs(playerId)}" : $"Joueur {playerId}";
    }
}
