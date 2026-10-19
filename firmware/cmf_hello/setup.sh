#!/usr/bin/env bash
# Assemble cmf_hello inside an Actions SDK checkout and build it for ats3089c_dev_watch.
#
#   ./setup.sh [path/to/lv_port_actions_technology]
#
# Requires the Zephyr SDK toolchain (see docs/04-custom-firmware.md).
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
SDK_REPO="${1:-$HERE/../../third_party/lv_port_actions_technology}"

if [ ! -d "$SDK_REPO/action_technology_sdk" ]; then
  echo "Cloning lvgl/lv_port_actions_technology into $SDK_REPO ..."
  git clone --depth 1 https://github.com/lvgl/lv_port_actions_technology.git "$SDK_REPO"
fi
SDK_REPO="$(cd "$SDK_REPO" && pwd)"
APP_DIR="$SDK_REPO/action_technology_sdk/application/app_demo/cmf_hello"

# Start from the vendor template (board configs, linker scripts, firmware.xml),
# then overlay our sources.
rm -rf "$APP_DIR"
cp -r "$SDK_REPO/hello_world" "$APP_DIR"
cp "$HERE/src/main.c" "$HERE/src/app_msg.h" "$APP_DIR/src/"
sed -i 's/project(hello_world)/project(cmf_hello)/' "$APP_DIR/CMakeLists.txt"
cat "$HERE/prj.extra.conf" >> "$APP_DIR/prj.conf"

echo "App assembled at $APP_DIR"
echo
echo "Build:"
echo "  cd $SDK_REPO/action_technology_sdk/zephyr && source zephyr-env.sh && ./build.sh -n"
echo "  -> board: ats3089c_dev_watch, application: app_demo, sub app: cmf_hello"
echo
echo "Output .fw / ota image lands under action_technology_sdk/application/app_demo/cmf_hello/outdir/."
echo "Read docs/04-custom-firmware.md before flashing anything to a real watch."
