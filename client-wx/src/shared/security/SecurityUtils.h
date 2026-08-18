#pragma once

#include <string>

namespace lila::shared::security
{
void SecureWipeMemory(void* ptr, std::size_t size);
void SecureWipeString(std::string& str);

std::string ProtectSecret(const std::string& plaintext);
std::string UnprotectSecret(const std::string& cipherTextOrBase64);

void HardenFilePermissions(const std::string& path);
void SecureDeleteFile(const std::string& path);
}
