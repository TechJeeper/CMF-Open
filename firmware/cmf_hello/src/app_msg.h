/*
 * SPDX-License-Identifier: Apache-2.0
 */

#ifndef CMF_HELLO_APP_MSG_H
#define CMF_HELLO_APP_MSG_H

#include <msg_manager.h>

#define APP_NAME "main"

enum APP_MSG_TYPE {
	MSG_UI = MSG_APP_MESSAGE_START,
	MSG_OTA,
};

enum APP_MSG_CMD {
	CMD_NULL = 0,
	CMD_SCREEN_OFF,
	CMD_SCREEN_ON,
	CMD_KEY_PRESS,
};

int app_msg_init(void);
int app_msg_send(const char *receiver, uint8_t type, uint8_t cmd);

#endif
