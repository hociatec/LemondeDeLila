import { access, readdir, readFile } from 'node:fs/promises';
import { basename, extname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../src/', import.meta.url));
const violations = [];
const gameplayRoot = join(root, 'modules/gameplay');
const backendGamesRoot = fileURLToPath(new URL('../../backend/src/game/games/', import.meta.url));

async function sourceFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map(async (entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return ['.cpp', '.h'].includes(extname(entry.name)) ? [path] : [];
  }));
  return nested.flat();
}

function reject(path, source, pattern, message) {
  if (pattern.test(source)) violations.push(`${relative(root, path)}: ${message}`);
}

async function concreteGameIds(directory) {
  try { await access(directory); } catch { return []; }
  const entries = await readdir(directory, { withFileTypes: true });
  const ids = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const child = join(directory, entry.name);
    const files = await readdir(child, { withFileTypes: true });
    if (files.some((file) => file.isFile() && file.name === 'game.json'))
      ids.push(basename(child).toLowerCase());
    ids.push(...await concreteGameIds(child));
  }
  return ids;
}

const gameIds = [...new Set(await concreteGameIds(backendGamesRoot))]
  .filter((id) => id.length >= 4);
// Audited exceptions: every entry is a narrow JSON boundary and carries its
// architectural reason here. Domain models, including GameAction, are never
// eligible for this list.
const jsonBoundaryAllowlist = new Map([
  ['modules/gameplay/prompts/application/GamePromptInputCodec.cpp',
    'parses an explicitly JSON-typed user field and immediately returns GameValue'],
  ['modules/gameplay/state/application/GameValuePayloadCodec.cpp',
    'serializes the extensible GameValue contract at an explicit boundary'],
  ['modules/gameplay/state/application/GameValuePayloadCodec.h',
    'declares only the explicit GameValue serialization boundary'],
]);

// A catch-all is accepted only at a boundary where the concrete exception type
// is unknowable and where the failure is deliberately contained. Keeping exact
// counts makes every new catch (...) fail CI until its behaviour is reviewed.
const catchAllAudit = new Map([
  ['bootstrap/lifecycle/application/AppBootstrap.cpp', { count: 1, reason: 'top-level startup boundary reports unknown failures' }],
  ['modules/audio/infrastructure/AsyncAudioBackend.cpp', { count: 2, reason: 'audio worker contains and logs unknown backend failures' }],
  ['modules/chat/application/ChatService.Heartbeat.cpp', { count: 1, reason: 'heartbeat is best-effort and logs unknown transport failures' }],
  ['modules/gameplay/session/application/GameSessionService.cpp', { count: 2, reason: 'long-lived realtime worker reports unknown failures without terminating the process' }],
  ['modules/presence/application/PresenceMonitor.Activity.cpp', { count: 1, reason: 'best-effort activity publication records unknown failures' }],
  ['modules/presence/application/PresenceMonitor.cpp', { count: 2, reason: 'shutdown and reconnect boundaries contain unknown transport failures' }],
  ['modules/rooms/application/RoomInvitationMonitor.cpp', { count: 4, reason: 'shutdown and reconnect boundaries contain and log unknown transport failures' }],
  ['modules/rooms/application/RoomSessionService.Realtime.cpp', { count: 1, reason: 'heartbeat worker must interrupt the gateway after any failure' }],
  ['modules/rooms/infrastructure/RoomSessionGateway.Commands.cpp', { count: 1, reason: 'command boundary completes pending acknowledgement after any failure' }],
  ['modules/rooms/infrastructure/RoomSessionGateway.cpp', { count: 1, reason: 'leave notification is best-effort before mandatory close' }],
  ['modules/session/application/SessionStore.Refresh.cpp', { count: 4, reason: 'single-flight refresh, secret cleanup and local revocation must run after any failure' }],
  ['modules/update/infrastructure/launcher/UpdateLauncher.Lifecycle.cpp', { count: 2, reason: 'version cleanup is best-effort and cannot invalidate a selected release' }],
  ['modules/update/infrastructure/launcher/UpdateLauncher.Prepare.cpp', { count: 1, reason: 'archive probe treats every filesystem or hashing failure as a cache miss' }],
  ['modules/update/infrastructure/launcher/UpdateLauncher.Process.cpp', { count: 2, reason: 'diagnostic cleanup and launcher comparison are non-fatal boundaries' }],
  ['modules/update/infrastructure/launcher/UpdateLauncher.Runtime.cpp', { count: 2, reason: 'diagnostic housekeeping cannot mask the launcher result' }],
  ['modules/update/infrastructure/launcher/UpdateLauncher.State.cpp', { count: 3, reason: 'no-throw logging and state-backup recovery boundaries' }],
  ['modules/update/infrastructure/launcher/UpdateLauncher.Zip.cpp', { count: 1, reason: 'transactional extraction removes partial output before rethrowing' }],
  ['modules/update/infrastructure/launcher/UpdateLauncher.cpp', { count: 1, reason: 'emergency logging cannot hide the user-facing launcher error' }],
  ['shared/accessibility/infrastructure/NvdaScreenReaderAnnouncer.cpp', { count: 1, reason: 'optional third-party screen-reader callback must remain non-fatal' }],
  ['shared/cache/application/SingleFlightCache.h', { count: 1, reason: 'promise propagation must retain arbitrary exception types' }],
  ['shared/concurrency/application/BackgroundExecutor.cpp', { count: 1, reason: 'worker boundary logs unknown job failures and remains alive' }],
  ['shared/concurrency/application/BackgroundExecutor.h', { count: 1, reason: 'async completion converts unknown failures to AppError' }],
  ['shared/network/application/realtime/ReconnectPolicy.cpp', { count: 1, reason: 'noexcept entropy initialization has a deterministic fallback' }],
  ['shared/network/infrastructure/websocket/WinHttpWebSocketClient.Messaging.cpp', { count: 1, reason: 'operation accounting must finish before arbitrary receive failures propagate' }],
]);
const observedCatchAll = new Set();
let asyncSlotTracks = 0;
let asyncSlotTokens = 0;
let asyncSlotCompletions = 0;

for (const path of await sourceFiles(root)) {
  const source = await readFile(path, 'utf8');
  const name = relative(root, path).replaceAll('\\', '/');
  const includes = [...source.matchAll(/#include\s*[<"]([^">]+)[">]/g)]
    .map((match) => match[1]);
  const sourceModule = name.match(/^modules\/([^/]+)\//)?.[1];
  const catchAllCount = source.match(/catch\s*\(\s*\.\.\.\s*\)/g)?.length ?? 0;
  asyncSlotTracks += source.match(/(?:requestSlot_|inputRequestSlot_)\.Track\s*\(/g)?.length ?? 0;
  asyncSlotTokens += source.match(/(?:requestSlot_|inputRequestSlot_)\.CurrentToken\s*\(/g)?.length ?? 0;
  asyncSlotCompletions += source.match(/(?:requestSlot_|inputRequestSlot_)\.Complete\s*\(/g)?.length ?? 0;

  reject(path, source, /\benum\s+(?!class\b|struct\b)[A-Za-z_]/,
    'les états fermés doivent utiliser enum class');
  reject(path, source, /\{\s*["']type["']\s*,\s*["'][A-Za-z][A-Za-z0-9_.-]+["']\s*\}/,
    'un type de message réseau doit utiliser une constante de protocole nommée');
  reject(path, source, /\bRequest\s*\(\s*["'][A-Za-z][A-Za-z0-9_.-]+["']/,
    'une requête réseau doit utiliser une constante de protocole nommée');
  if (name.includes('/presentation/') &&
      includes.some((dependency) => /^(?:modules\/[^/]+|shared\/[^/]+)\/(?:[^/]+\/)*infrastructure\//.test(dependency)))
    violations.push(`${name}: presentation ne doit pas dépendre directement d’infrastructure`);
  if (!name.includes('/presentation/') &&
      includes.some((dependency) => /^(?:modules\/[^/]+|shared\/[^/]+)\/(?:[^/]+\/)*presentation\//.test(dependency)))
    violations.push(`${name}: une couche interne ne doit pas dépendre de presentation`);
  if (sourceModule) {
    for (const dependency of includes) {
      const target = dependency.match(/^modules\/([^/]+)\/(?:[^/]+\/)*infrastructure\//)?.[1];
      if (target && target !== sourceModule)
        violations.push(`${name}: dépendance vers l’infrastructure interne du module ${target}`);
    }
  }
  if (!name.startsWith('bootstrap/composition/') &&
      /(?:make_unique|make_shared)\s*<[^>]*::infrastructure::/.test(source))
    violations.push(`${name}: les implémentations concrètes doivent être construites dans bootstrap/composition`);

  if (catchAllCount > 0) {
    const audit = catchAllAudit.get(name);
    if (!audit) {
      violations.push(`${name}: catch (...) non audité`);
    } else {
      observedCatchAll.add(name);
      if (catchAllCount !== audit.count)
        violations.push(`${name}: ${catchAllCount} catch (...) observé(s), ${audit.count} audité(s)`);
      if (!audit.reason.trim())
        violations.push(`${name}: justification du catch (...) manquante`);
    }
  }

  if (name.startsWith('modules/admin/domain/')) {
    reject(path, source, /nlohmann(?:\/json|::json)/, 'le domaine Admin ne doit pas dépendre de JSON');
  }
  if (name.startsWith('modules/admin/application/')) {
    reject(path, source, /nlohmann(?:\/json|::json)/, "l'application Admin ne doit pas exposer JSON");
  }
  if (name.startsWith('app/navigation/presentation/AppNavigator')) {
    reject(path, source, /nlohmann(?:\/json|::json)|\bgameType\b|PayloadCodec|Protocol::/,
      'AppNavigator doit rester limité à la navigation et à l’orchestration');
  }
  if (/\/(?:domain|application)\//.test(`/${name}`)) {
    reject(path, source, /#include\s*[<"](?:windows\.h|winhttp\.h)[>"]/, 'WinHTTP appartient à infrastructure');
    reject(path, source, /#include\s*[<"]wx\//, 'wxWidgets appartient à présentation');
    if (name.startsWith('modules/'))
      reject(path, source, /#include\s*[<"]shared\/text\/presentation\//,
        'le domaine et l’application ne doivent pas dépendre du catalogue UI');
  }
  if (name.includes('GamePlayPanel')) {
    reject(
      path,
      source,
      /\b(?:roomStarted_|awaitingStartedState_|roomStartPending_|roomStartFlowRequested_|observedEventIdentities_)\b/,
      'ancien état booléen ou stockage de déduplication non borné',
    );
    reject(path, source, /workflowKind|SelectedQuizAnswer|ActivateDiceRoll/,
      'GamePlayPanel doit piloter les interactions génériques du serveur');
    reject(path, source, /(?:ResolveShortcutAction|action\.type\s*==)\s*\(?'(?:answer|roll)'/,
      'action métier codée en dur dans GamePlayPanel');
  }
  if (name.startsWith('modules/gameplay/')) {
    if (name !== 'modules/gameplay/session/domain/GameProtocol.h')
      reject(path, source,
        /["']game\.(?:join|state|rules|key|action(?:\.candidates)?|ack|turn|message)["']/,
        'les types de messages gameplay doivent utiliser GameProtocol');
    reject(path, source,
      /(?:gameType\s*(?:==|!=)\s*["']|["'][^"']*["']\s*(?:==|!=)\s*gameType|switch\s*\([^)]*gameType)/,
      'branche comportementale fondée sur gameType');
    for (const id of gameIds) {
      if (source.toLowerCase().includes(id))
        violations.push(`${name}: identifiant de jeu concret interdit (${id})`);
    }
    if (!name.includes('/infrastructure/')) {
      reject(path, source,
        /\.(?:winnerPlayerIds|currentPlayerId|score|actions|allowedActions)\s*=|\b(?:CalculateWinner|ComputeScore|IsLegalAction|CanPlayCard|NextPlayer|SpendResource)\b/,
        'victoire, score, tour, légalité et actions doivent venir de la projection serveur');
    }
  }
  if (name.startsWith('modules/rooms/') && !name.includes('/infrastructure/'))
    reject(path, source, /\.allowedActions\s*=|\.allowedActions\.(?:push_back|emplace|insert)\s*\(/,
      'les autorisations de salle doivent venir du serveur');
  if (name.startsWith('modules/audio/') && name !== 'modules/audio/infrastructure/BassAudioBackend.cpp')
    reject(path, source, /std::this_thread::sleep_for\s*\(/,
      'les attentes audio BASS doivent rester dans le backend exécuté par le worker');
  if ((name.includes('/presentation/') || name.startsWith('app/navigation/presentation/')) &&
      /\bRunAsync(?:<[^;]+?>)?\s*\(/s.test(source) && !/wxWeakRef\s*</.test(source))
    violations.push(`${name}: une tâche de présentation directe doit protéger sa cible par wxWeakRef`);
  if (name.includes('/presentation/'))
    reject(path, source, /FromUtf8\s*\([^)]*\.what\s*\(\s*\)/s,
      'exception.what() est réservé au diagnostic, jamais au message utilisateur');
  if (name === 'modules/update/infrastructure/launcher/UpdateLauncher.cpp')
    reject(path, source, /MessageBoxW\s*\([^;]*\.what\s*\(\s*\)/s,
      'le launcher ne doit pas afficher exception.what() à l’utilisateur');
  if (!name.startsWith('app/navigation/presentation/AppNavigator') &&
      /CallAfter\s*\(\s*\[this\b/s.test(source))
    violations.push(`${name}: un callback différé vers un widget doit utiliser wxWeakRef`);
  if (name.startsWith('modules/update/infrastructure/launcher/') &&
      name !== 'modules/update/infrastructure/launcher/UpdateLauncher.Progress.cpp')
    reject(path, source, /std::this_thread::sleep_for\s*\(/,
      'les attentes Update doivent passer par le délai borné et annulable centralisé');
  if (name !== 'bootstrap/composition/infrastructure/audio/AudioComposition.cpp')
    reject(path, source, /make_unique\s*<[^>]*BassAudioBackend/,
      'BassAudioBackend doit être construit uniquement derrière AsyncAudioBackend');
  if (name === 'bootstrap/composition/infrastructure/audio/AudioComposition.cpp' &&
      /make_unique\s*<[^>]*BassAudioBackend/.test(source) &&
      !/make_unique\s*<[^>]*AsyncAudioBackend>[\s\S]*make_unique\s*<[^>]*BassAudioBackend/.test(source))
    violations.push(`${name}: BassAudioBackend doit être enveloppé par AsyncAudioBackend`);
  if (name === 'modules/gameplay/actions/domain/GameAction.h')
    reject(path, source, /nlohmann(?:\/json|::json)/,
      'GameAction doit conserver un payload GameValue typé');
  if (/\/modules\/gameplay\/(?:domain|application)\//.test(`/${name}`) &&
      !jsonBoundaryAllowlist.has(name))
    reject(path, source, /nlohmann(?:\/json|::json)/,
      'JSON interdit hors contrat applicatif explicitement autorisé');
  reject(path, source, /\bReconnectDelay\s*\(/, 'utiliser la politique ReconnectPolicy partagée');
  if (name.startsWith('shared/network/infrastructure/')) {
    reject(path, source, /WithDetails\s*\([^,]+,\s*endpoint\s*\)/,
      'une erreur WinHTTP ne doit jamais recopier un endpoint potentiellement sensible');
    if (name.includes('WinHttpWebSocketInternals'))
      reject(path, source, /return\s+std::string\s*\(\s*closeReason\.data\s*\(/,
        'une raison de fermeture contrôlée par le serveur ne doit pas être journalisable');
  }
  if (name === 'shared/network/infrastructure/http/AuthenticatedHttpClient.cpp' ||
      name === 'modules/update/infrastructure/launcher/UpdateLauncher.Platform.cpp')
    reject(path, source,
      /(?:MultiByteToWideChar|WideCharToMultiByte)\s*\([^;]*static_cast<int>\s*\(\s*value\.size\(\)\s*\)/s,
      'une longueur Win32 doit être vérifiée contre INT_MAX avant conversion');
}

if (asyncSlotTracks === 0 || asyncSlotTracks !== asyncSlotTokens ||
    asyncSlotTracks !== asyncSlotCompletions)
  violations.push(`audit AsyncRequestSlot incohérent: ${asyncSlotTracks} Track, ` +
    `${asyncSlotTokens} CurrentToken, ${asyncSlotCompletions} Complete`);

for (const name of catchAllAudit.keys()) {
  if (!observedCatchAll.has(name))
    violations.push(`${name}: entrée catch (...) auditée devenue absente; mettre l'audit à jour`);
}

async function requireOrderedMarkers(name, markers, message) {
  const source = await readFile(join(root, name), 'utf8');
  let previous = -1;
  for (const marker of markers) {
    const current = source.indexOf(marker, previous + 1);
    if (current < 0 || current <= previous) {
      violations.push(`${name}: ${message}`);
      return;
    }
    previous = current;
  }
}

async function requireMarkerCount(name, marker, minimum, message) {
  const source = await readFile(join(root, name), 'utf8');
  const count = source.split(marker).length - 1;
  if (count < minimum) violations.push(`${name}: ${message}`);
}

await requireOrderedMarkers(
  'modules/update/infrastructure/launcher/UpdateLauncher.Runtime.cpp',
  ['ParseManifest(', 'PrepareRelease(', 'ActivateRelease('],
  'la signature et la préparation vérifiée doivent précéder l’activation');
await requireOrderedMarkers(
  'modules/update/infrastructure/launcher/UpdateLauncher.Prepare.cpp',
  ['Sha256(archive, progress)', 'InspectArchive(', 'ExtractArchive(', 'RenameWithRetry('],
  'hash, inspection, extraction et commit doivent conserver cet ordre');
await requireOrderedMarkers(
  'modules/update/infrastructure/launcher/UpdateLauncher.Zip.cpp',
  ['ExtractEntries(archive, destination, progress);', 'VerifyExtractedPayload(destination'],
  'l’extraction doit être suivie des contrôles Authenticode avant retour');
await requireMarkerCount(
  'modules/update/infrastructure/launcher/UpdateLauncher.Download.cpp',
  'progress->ThrowIfCancelled()', 2,
  'le téléchargement doit tester l’annulation avant et pendant les écritures');
await requireMarkerCount(
  'modules/update/infrastructure/launcher/UpdateLauncher.Security.cpp',
  'progress->ThrowIfCancelled()', 1,
  'le hash doit rester annulable entre les blocs');
await requireMarkerCount(
  'modules/update/infrastructure/launcher/UpdateLauncher.Zip.cpp',
  'progress->ThrowIfCancelled()', 2,
  'extraction et vérification doivent tester l’annulation entre les entrées');
await requireMarkerCount(
  'modules/gameplay/state/domain/GameSystem.h',
  'std::string value;', 1,
  'les phases serveur extensibles doivent rester des identifiants chaîne');
await requireMarkerCount(
  'modules/catalog/domain/CatalogShelf.h',
  'std::string status;', 1,
  'les statuts catalogue extensibles doivent rester des identifiants chaîne');
await requireMarkerCount(
  'modules/rooms/domain/Room.h',
  'std::string status;', 2,
  'les statuts de salle extensibles doivent rester des identifiants chaîne');
await requireOrderedMarkers(
  'modules/gameplay/shell/presentation/panel/GamePlayPanel.Session.cpp',
  ['action.type.empty() || action.disabled', 'state_.version', 'service->ExecuteAction(command, stopToken)'],
  'une commande gameplay doit contrôler puis transmettre uniquement une action de la projection versionnée');
await requireOrderedMarkers(
  'modules/gameplay/state/infrastructure/GameSystemDecoder.cpp',
  ['decoded.winnerPlayerIds = IntArray(', 'turn.currentPlayerId = detail::ReadOptionalPlayerId('],
  'victoire et prochain joueur doivent rester décodés depuis la projection serveur');
await requireOrderedMarkers(
  'modules/rooms/presentation/actions/RoomActionPolicy.cpp',
  ['room.allowedActions.begin()', 'room.allowedActions.end()'],
  'les autorisations de salle doivent rester fondées sur allowedActions du serveur');
await requireMarkerCount(
  'modules/gameplay/actions/application/GameActionPresentationPolicy.cpp',
  'return {};', 1,
  'le client ne doit pas fabriquer une liste locale d’actions disponibles');

if (violations.length > 0) {
  console.error(`Frontières client invalides:\n${violations.join('\n')}`);
  process.exit(1);
}

console.log('Architecture client vérifiée.');
