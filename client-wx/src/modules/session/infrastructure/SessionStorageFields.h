#pragma once

#include <string_view>

namespace lila::modules::session::infrastructure::fields
{
inline constexpr int CurrentSchemaVersion = 1;
inline constexpr int LegacySchemaVersion = 0;

inline constexpr std::string_view SchemaVersion = "schemaVersion";
inline constexpr std::string_view UserId = "userId";
inline constexpr std::string_view Username = "username";
inline constexpr std::string_view Token = "token";
inline constexpr std::string_view RefreshToken = "refreshToken";
inline constexpr std::string_view ExpiresAt = "expiresAt";
inline constexpr std::string_view ResumeOnce = "resumeOnce";
inline constexpr std::string_view ResumeUntil = "resumeUntil";
}
