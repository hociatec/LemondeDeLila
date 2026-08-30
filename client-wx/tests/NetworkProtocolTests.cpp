#include <algorithm>
#include <atomic>
#include <iostream>
#include <cassert>
#include <filesystem>
#include <fstream>
#include <future>
#include <chrono>
#include <deque>
#include <mutex>
#include <condition_variable>
#include <thread>
#include <stdexcept>
#include <string>
#include <unordered_set>
#include <vector>

#include <wx/init.h>
#include "modules/audio/application/AudioService.h"
#include "modules/audio/application/IAudioBackend.h"
#include "modules/audio/application/IAudioService.h"
#include "modules/audio/application/IAudioSettingsProvider.h"
#include "modules/audio/application/SoundVolumeResolver.h"
#include "modules/chat/application/ChatMessageStore.h"
#include "modules/chat/domain/ChatMessage.h"
#include "modules/chat/domain/ChatState.h"
#include "modules/chat/infrastructure/ChatProtocol.h"
#include "modules/chat/presentation/ChatMessageActions.h"
#include "modules/catalog/infrastructure/CatalogPayloadCodec.h"
#include "modules/catalog/presentation/CatalogShelfNavigator.h"
#include "modules/storybook/infrastructure/StoryBookPayloadCodec.h"
#include "modules/storybook/presentation/StoryBookNavigator.h"
#include "modules/leaderboard/infrastructure/LeaderboardPayloadCodec.h"
#include "modules/leaderboard/presentation/LeaderboardNavigator.h"
#include "modules/rooms/infrastructure/RoomPayloadCodec.h"
#include "modules/rooms/application/RoomStateUpdatePolicy.h"
#include "modules/rooms/infrastructure/RoomSessionGateway.h"
#include "modules/rooms/presentation/navigation/RoomLobbyNavigator.h"
#include "modules/rooms/presentation/navigation/RoomOpenRequest.h"
#include "modules/rooms/presentation/model/RoomPresentationModel.h"
#include "modules/rooms/presentation/shortcuts/RoomShortcutPolicy.h"
#include "modules/vault/infrastructure/VaultPayloadCodec.h"
#include "modules/vault/presentation/VaultNavigator.h"
#include "modules/vault/presentation/VaultPresentationModel.h"
#include "modules/options/application/OptionsStore.h"
#include "modules/options/domain/IOptionsRepository.h"
#include "modules/options/domain/OptionsState.h"
#include "modules/options/infrastructure/OptionsJsonDocumentCodec.h"
#include "modules/session/application/SessionStore.h"
#include "modules/session/domain/ISessionRepository.h"
#include "modules/session/domain/Session.h"
#include "shared/accessibility/presentation/ActionButton.h"
#include "shared/cache/application/SingleFlightCache.h"
#include "shared/concurrency/application/BackgroundExecutor.h"
#include "shared/concurrency/application/AsyncRequestSlot.h"
#include "shared/accessibility/application/NavigationController.h"
#include "modules/audio/domain/SoundCatalog.h"
#include "modules/audio/infrastructure/LocalSoundManifest.h"
#include "modules/audio/presentation/SoundOptionsCatalog.h"
#include "shared/domain/identifiers/DomainTypes.h"
#include "shared/logging/application/Logger.h"
#include "shared/network/application/realtime/RealtimeProtocol.h"
#include "shared/network/domain/WebSocketConstants.h"
#include "shared/network/application/http/IWsTicketProvider.h"
#include "shared/network/application/websocket/IWebSocketClient.h"
#include "shared/persistence/infrastructure/AtomicFileWriter.h"
#include "shared/persistence/infrastructure/JsonFileStorage.h"
#include "shared/security/domain/JwtPayload.h"
#include "shared/security/infrastructure/SecurityUtils.h"
#include "shared/text/presentation/encoding/Encoding.h"


#include "network_protocol/Support.Session.inc"
#include "network_protocol/Support.Audio.inc"
#include "network_protocol/Support.RoomTransport.inc"
#include "network_protocol/CoreDomainTests.inc"
#include "network_protocol/OptionsAudioTests.inc"
#include "network_protocol/SessionStorageTextTests.inc"
#include "network_protocol/RealtimeChatAccessibilityTests.inc"
#include "network_protocol/CatalogRoomCodecTests.inc"
#include "network_protocol/RoomGatewayTests.inc"
#include "network_protocol/RoomPresentationTests.inc"
#include "network_protocol/RoomStateUpdatePolicyTests.inc"
#include "network_protocol/ContentNavigationTests.inc"
#include "network_protocol/ConcurrencyTests.inc"

}

int main()
{
    try
    {
        wxInitializer wx;
        Expect(wx.IsOk(), "Initialisation wxWidgets attendue");

        auto run = [](const char* name, auto&& test)
        {
            std::cout << "[RUNNING] " << name << '\n';
            std::cout.flush();
            test();
        };

        std::cout << "Running automated unit tests for client-wx...\n";
        std::cout.flush();
        run("SessionValidation", TestSessionValidation);
        run("JwtPayloadExpiration", TestJwtPayloadExpiration);
        run("OptionsStateNormalization", TestOptionsStateNormalization);
        run("DomainTypes", TestDomainTypes);
        run("SecurityWipe", TestSecurityWipe);
        run("JsonFileStorageRejectsOversizedFiles", TestJsonFileStorageRejectsOversizedFiles);
        run("JsonFileStorageRejectsCorruptedFiles", TestJsonFileStorageRejectsCorruptedFiles);
        run("OptionsCodecMigratesLegacyFieldsAndSchema", TestOptionsCodecMigratesLegacyFieldsAndSchema);
        run("SoundCatalogAndPerCueOptionsRoundTrip", TestSoundCatalogAndPerCueOptionsRoundTrip);
        run("AudioSettingsAndServiceRouting", TestAudioSettingsAndServiceRouting);
        run("SessionClearWipesRefreshToken", TestSessionClearWipesRefreshToken);
        run("SessionMovePreservesSecrets", TestSessionMovePreservesSecrets);
        run("SessionStoreRestoreLoadsPersistedSession", TestSessionStoreRestoreLoadsPersistedSession);
        run("SessionStoreRejectsSupersededConcurrentRefresh", TestSessionStoreRejectsSupersededConcurrentRefresh);
        run("AtomicFileWriterReplacesExistingContent", TestAtomicFileWriterReplacesExistingContent);
        run("EncodingRoundTripUnicode", TestEncodingRoundTripUnicode);
        run("EncodingRejectsInvalidUtf8", TestEncodingRejectsInvalidUtf8);
        run("BrokenAccentRepairCanBeToggled", TestBrokenAccentRepairCanBeToggled);
        run("RealtimeProtocolFallbackTypeAndPayloadValidation", TestRealtimeProtocolFallbackTypeAndPayloadValidation);
        run("ChatProtocolHandlesMalformedAndUnknownEvents", TestChatProtocolHandlesMalformedAndUnknownEvents);
        run("ChatMessageStoreEnforcesLimits", TestChatMessageStoreEnforcesLimits);
        run("ChatMessageActionRights", TestChatMessageActionRights);
        run("ActionButtonKeyboardSemantics", TestActionButtonKeyboardSemantics);
        run("NavigationControllerKeyboardSemantics", TestNavigationControllerKeyboardSemantics);
        run("CatalogPayloadCodecReadsShelfTree", TestCatalogPayloadCodecReadsShelfTree);
        run("CatalogShelfNavigatorRestoresParentSelection", TestCatalogShelfNavigatorRestoresParentSelection);
        run("RoomPayloadCodecs", TestRoomPayloadCodecs);
        run("RoomSessionGatewayUsesBackendHandshakeContract", TestRoomSessionGatewayUsesBackendHandshakeContract);
        run("AsyncRequestSlotRejectsStaleCompletion", TestAsyncRequestSlotRejectsStaleCompletion);
        run("SingleFlightCacheSharesLoadsAndSupportsInvalidation", TestSingleFlightCacheSharesLoadsAndSupportsInvalidation);
        run("RoomPresentationMatchesWpfWaitingTable", TestRoomPresentationMatchesWpfWaitingTable);
        run("RoomStateUpdatePolicyRejectsPreviousRuns", TestRoomStateUpdatePolicyRejectsPreviousRuns);
        run("VaultPayloadCodec", TestVaultPayloadCodec);
        run("RoomAndVaultPresentationState", TestRoomAndVaultPresentationState);
        run("StoryBookPayloadAndNavigation", TestStoryBookPayloadAndNavigation);
        run("LeaderboardPayloadAndNavigation", TestLeaderboardPayloadAndNavigation);
        std::cout << "All tests completed successfully!\n";
        return 0;
    }
    catch (const std::exception& error)
    {
        std::cerr << "[TEST FAILED] " << error.what() << '\n';
        return 1;
    }
}
