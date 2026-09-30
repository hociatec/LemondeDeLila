#pragma once

#include <cstddef>
#include <string>

namespace lila::shared::security
{
void SecureWipeMemory(void* ptr, std::size_t size);
void SecureWipeString(std::string& str);
}
