#pragma once

#include <string>

#include "shared/security/domain/SecureWipe.h"

namespace lila::shared::security
{
std::string ProtectSecret(const std::string& plaintext);
std::string UnprotectSecret(const std::string& cipherTextOrBase64);

void HardenFilePermissions(const std::string& path);
void SecureDeleteFile(const std::string& path);
}
