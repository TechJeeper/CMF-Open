/*
 * cmf_hello - minimal custom firmware app for the CMF Watch 3 Pro (Actions ATS3089C).
 *
 * Built on the Actions Zephyr SDK from lvgl/lv_port_actions_technology. Draws a
 * round 466x466 watch screen with a live clock and a counter driven by the crown
 * key, which is the smallest useful proof that our own code is running on the SoC.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

#include <stdio.h>
#include <stdbool.h>
#include <string.h>
#include <board_cfg.h>
#include <os_common_api.h>
#include <lvgl/lvgl.h>
#include <lvgl/lvgl_ext.h>
#include <drivers/input/input_dev.h>
#include <mem_manager.h>
#include <sys_manager.h>
#include <thread_timer.h>
#include <sys_wakelock.h>
#include "app_msg.h"

#define CMF_ORANGE LV_COLOR_MAKE(0xFF, 0x5A, 0x1F)

static K_SEM_DEFINE(g_vsync_sem, 0, 1);
static uint8_t g_disp_active = 1;
static uint32_t g_presses;

static lv_obj_t *g_time_label;
static lv_obj_t *g_count_label;
static lv_obj_t *g_arc;

static void _vsync_cb(const lvx_display_observer_t *observer, uint32_t timestamp)
{
	k_sem_give(&g_vsync_sem);
}

static void _state_cb(const lvx_display_observer_t *observer, uint32_t state)
{
	if (state == LVX_DISPLAY_STATE_ON) {
		app_msg_send(APP_NAME, MSG_UI, CMD_SCREEN_ON);
	}
}

static const lvx_display_observer_t g_observer = {
	.vsync_cb = _vsync_cb,
	.state_cb = _state_cb,
};

static void _update_counter(void)
{
	lv_label_set_text_fmt(g_count_label, "crown x%u", (unsigned int)g_presses);
	lv_arc_set_value(g_arc, (int32_t)(g_presses % 13));
}

/* Runs in the input driver's context: hand off to the UI thread via a message. */
static void _key_cb(struct device *dev, struct input_value *val)
{
	static uint32_t last_value;
	bool pressed = val->keypad.value != last_value && val->keypad.value != 0;

	last_value = val->keypad.value;
	if (pressed) {
		sys_wake_lock(FULL_WAKE_LOCK);
		sys_wake_unlock(FULL_WAKE_LOCK);
		app_msg_send(APP_NAME, MSG_UI, CMD_KEY_PRESS);
	}
}

static void _key_init(void)
{
	struct device *dev = (struct device *)device_get_binding(CONFIG_INPUT_DEV_ACTS_ONOFF_KEY_NAME);

	if (!dev) {
		SYS_LOG_ERR("no key device %s", CONFIG_INPUT_DEV_ACTS_ONOFF_KEY_NAME);
		return;
	}
	input_dev_enable(dev);
	input_dev_register_notify(dev, _key_cb);
}

static void _clock_tick(struct thread_timer *timer, void *data)
{
	uint32_t s = k_uptime_get_32() / 1000;

	lv_label_set_text_fmt(g_time_label, "%02u:%02u:%02u",
			      (unsigned int)(s / 3600) % 24, (unsigned int)(s / 60) % 60, (unsigned int)s % 60);
}

static void _ui_create(void)
{
	lv_obj_t *scr = lv_screen_active();

	lv_obj_set_style_bg_color(scr, lv_color_black(), 0);
	lv_obj_set_style_bg_opa(scr, LV_OPA_COVER, 0);

	g_arc = lv_arc_create(scr);
	lv_obj_set_size(g_arc, 440, 440);
	lv_obj_center(g_arc);
	lv_arc_set_range(g_arc, 0, 12);
	lv_arc_set_bg_angles(g_arc, 0, 360);
	lv_arc_set_rotation(g_arc, 270);
	lv_obj_remove_style(g_arc, NULL, LV_PART_KNOB);
	lv_obj_set_style_arc_width(g_arc, 10, LV_PART_MAIN);
	lv_obj_set_style_arc_width(g_arc, 10, LV_PART_INDICATOR);
	lv_obj_set_style_arc_color(g_arc, lv_color_hex(0x222222), LV_PART_MAIN);
	lv_obj_set_style_arc_color(g_arc, CMF_ORANGE, LV_PART_INDICATOR);

	lv_obj_t *title = lv_label_create(scr);
	lv_label_set_text(title, "cmfkit firmware");
	lv_obj_set_style_text_color(title, lv_color_hex(0x9A9A9A), 0);
	lv_obj_align(title, LV_ALIGN_CENTER, 0, -90);

	g_time_label = lv_label_create(scr);
	lv_obj_set_style_text_font(g_time_label, &lv_font_montserrat_24, 0);
	lv_obj_set_style_text_color(g_time_label, lv_color_white(), 0);
	lv_obj_align(g_time_label, LV_ALIGN_CENTER, 0, -20);

	g_count_label = lv_label_create(scr);
	lv_obj_set_style_text_color(g_count_label, CMF_ORANGE, 0);
	lv_obj_align(g_count_label, LV_ALIGN_CENTER, 0, 50);

	_update_counter();
}

static void _process_ui_msg(struct app_msg *msg)
{
	switch (msg->cmd) {
	case CMD_SCREEN_OFF:
		g_disp_active = 0;
		break;
	case CMD_SCREEN_ON:
		g_disp_active = 1;
		lv_obj_invalidate(lv_screen_active());
		break;
	case CMD_KEY_PRESS:
		g_presses++;
		_update_counter();
		break;
	default:
		break;
	}
}

int main(void)
{
	static struct thread_timer clock_timer;

	mem_manager_init();
	system_init();
	app_msg_init();

	lvx_port_init();
	lvx_display_add_observer(&g_observer);
	lvx_refr_set_manual(NULL);

	_ui_create();
	thread_timer_init(&clock_timer, _clock_tick, NULL);
	thread_timer_start(&clock_timer, 0, 1000);

	_key_init();
	system_ready();

	while (1) {
		struct app_msg msg;
		uint32_t timeout = MIN(lv_task_handler(), thread_timer_next_timeout());
		int rc = poll_msg(&msg, &g_vsync_sem, timeout);

		if (rc == OS_POLL_MSG) {
			if (msg.type == MSG_UI) {
				_process_ui_msg(&msg);
			}
			if (msg.callback) {
				msg.callback(&msg, 0, NULL);
			}
		} else if (rc == OS_POLL_SEM && g_disp_active) {
			lvx_refr_all();
		}
		thread_timer_handle_expired();
	}
	return 0;
}
