#ifndef MAKI_COLOR_H
#define MAKI_COLOR_H

#include <stdint.h>
#include <math.h>

typedef struct {
    float r;
    float g;
    float b;
    uint16_t raw;
} Color;

void updateRaw(Color* color) {
    uint8_t r = color->r * 0xff;
    uint8_t g = color->g * 0xff;
    uint8_t b = color->b * 0xff;

    // r5 g6 b5
    color->raw = (
        ((r & 0b11111000) << 8) + 
        ((g & 0b11111100) << 3) +
        ((b & 0b11111000) >> 3
    ));
    
    // swaps first 8 bits with last
    color->raw = ((color->raw << 8) & 0xff00) | (color->raw >> 8);
}

uint16_t getRaw(uint8_t r, uint8_t g, uint8_t b) {
    // r5 g6 b5
    uint16_t raw = (
        ((r & 0b11111000) << 8) + 
        ((g & 0b11111100) << 3) +
        ((b & 0b11111000) >> 3)
    );

    // swaps first 8 bits with last
    raw = ((raw << 8) & 0xff00) | (raw >> 8);

    return raw;
}

Color hexColor(uint8_t r, uint8_t g, uint8_t b) {
    Color color;
	color.r = (float)r / 0xff;
	color.g = (float)g / 0xff;
	color.b = (float)b / 0xff;
    updateRaw(&color);
    return color;
}

float lerp(float a, float b, float f)
{
    return a * (1.0 - f) + (b * f);
}

Color lerpColor(Color a, Color b, float t) {
    Color color;
    color.r = lerp(a.r, b.r, t);
    color.g = lerp(a.g, b.g, t);
    color.b = lerp(a.b, b.b, t);
    updateRaw(&color);
    return color;
}

#endif