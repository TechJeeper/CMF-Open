#!/usr/bin/env bash
# Make a distro arm-none-eabi GCC usable as Zephyr's "gnuarmemb" toolchain.
#
# Zephyr 2.7 expects newlib under $GNUARMEMB_TOOLCHAIN_PATH/arm-none-eabi, but
# Debian/Ubuntu install it in /usr/lib/arm-none-eabi. Without this shim the
# hard-float libc/libm search path is wrong and the link fails with
# "uses VFP register arguments ... nofp/libm.a does not".
#
#   source firmware/toolchain-shim.sh     # exports ZEPHYR_TOOLCHAIN_VARIANT/GNUARMEMB_TOOLCHAIN_PATH
set -euo pipefail

SHIM="${CMF_TOOLCHAIN_SHIM:-$HOME/.cache/cmfkit/gnuarmemb}"
GCC="$(command -v arm-none-eabi-gcc)" || { echo "install gcc-arm-none-eabi first" >&2; return 1 2>/dev/null || exit 1; }
SYSROOT="$(dirname "$(dirname "$GCC")")/lib/arm-none-eabi"
[ -d "$SYSROOT/lib" ] || SYSROOT="$(dirname "$(dirname "$GCC")")/arm-none-eabi"

mkdir -p "$SHIM"
ln -sfn "$(dirname "$GCC")" "$SHIM/bin"
ln -sfn "$SYSROOT" "$SHIM/arm-none-eabi"

export ZEPHYR_TOOLCHAIN_VARIANT=gnuarmemb
export GNUARMEMB_TOOLCHAIN_PATH="$SHIM"
echo "gnuarmemb toolchain shim: $SHIM (sysroot -> $SYSROOT)"
set +euo pipefail
