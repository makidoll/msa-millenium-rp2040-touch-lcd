#ifndef MAKI_HUFFMAN_DECODE_H
#define MAKI_HUFFMAN_DECODE_H

#include <stdint.h>

typedef struct DataWithSize {
	const uint8_t* data;
	uint32_t size;
} DataWithSize;

DataWithSize makiHuffmanDecode(DataWithSize data);

#endif