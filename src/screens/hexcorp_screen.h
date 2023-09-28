#ifndef MAKI_HEXCORP_SCREEN
#define MAKI_HEXCORP_SCREEN

#include <stdbool.h>
#include <stdint.h>

#include "../color.h"
#include "../images/hexcorp_image.h"
#include "../maki_huffman_decode.h"

typedef struct {
	DataWithSize image;
	Color hexCorpColor;
	Color blackColor;
} HexCorpScreenState;

void InitHexCorpScreenState(HexCorpScreenState* state) {
	DataWithSize input;
	input.data = hexcorp_image;
	input.size = sizeof(hexcorp_image);
	state->image = makiHuffmanDecode(input);

	state->hexCorpColor = hexColor(0xff, 0x66, 0xff);
	state->blackColor = hexColor(0x00, 0x00, 0x00);
}

bool HexCorpScreen(HexCorpScreenState* state, uint16_t* buffer, bool redraw) {
	if (redraw) {
		for (uint16_t i = 0; i < 240 * 240; i++) {
			Color color = lerpColor(state->blackColor, state->hexCorpColor,
			                        (float)state->image.data[i] / 0xff);
			buffer[i] = color.raw;
		}

		return true;
	}

	return false;
}

#endif