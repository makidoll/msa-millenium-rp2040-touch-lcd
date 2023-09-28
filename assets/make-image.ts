import * as flags from "https://deno.land/std/flags/mod.ts";
import {
	FilterType,
	ImageMagick,
	initialize,
} from "https://deno.land/x/imagemagick_deno/mod.ts";
import * as path from "https://deno.land/std/path/mod.ts";
import { makiHuffmanEncode } from "./maki-huffman-encoding.ts";

const cliFlags = flags.parse(Deno.args);

function helpAndExit() {
	console.log("Usage: <input image> <output.c> [--grayscale]");
	Deno.exit(1);
}

if (cliFlags._.length < 2) helpAndExit();
if (!String(cliFlags._[1]).endsWith(".h")) helpAndExit();

const inputFile = String(cliFlags._[0]);
const outputFile = String(cliFlags._[1]);
const grayscale = !!cliFlags.grayscale;

// rgb in 0-255
function r5g6b5asBytes(r: number, g: number, b: number): [number, number] {
	const rgb565 = (((r & 248) << 8) + ((g & 252) << 3) + ((b & 248) >> 3))
		.toString(16)
		.padStart(4, "0");

	const byteA = parseInt(rgb565.slice(0, 2), 16);
	const byteB = parseInt(rgb565.slice(2, 4), 16);

	// bytes need to be swapped
	return [byteB, byteA];
}

await initialize(); // imagemagick

const inputData: Uint8Array = await Deno.readFile(inputFile);

const width = 240;
const height = 240;

// have to do some callbacks because it disposes early
const pixels = await new Promise<Uint8Array | null>(resolve => {
	ImageMagick.read(inputData, image => {
		image.filterType = FilterType.Lanczos2;
		image.resize(width, height);
		image.getPixels(async pixelCollection => {
			resolve(pixelCollection.toByteArray(0, 0, width, height, "rgb"));
		});
	});
});

if (pixels == null) {
	throw new Error("Failed to resize and get pixels");
}

let finalImageDataLength = width * height;
if (!grayscale) {
	finalImageDataLength *= 2;
}

const finalImageData = new Uint8Array(finalImageDataLength);

for (let i = 0; i < width * height; i++) {
	// const x = i % width;
	// const y = Math.floor(i / width);

	const r = pixels[i * 3 + 0];
	const g = pixels[i * 3 + 1];
	const b = pixels[i * 3 + 2];

	if (grayscale) {
		finalImageData[i] = (r + g + b) / 3;
	} else {
		const [byteA, byteB] = r5g6b5asBytes(r, g, b);
		finalImageData[i * 2] = byteA;
		finalImageData[i * 2 + 1] = byteB;
	}
}

// could save here but we're gonna do huffman encoding

// await Deno.writeFile("./input.raw", finalImageData);

const compressed = makiHuffmanEncode(finalImageData);
// const compressed = finalImageData;

// await Deno.writeFile("./encoded.raw", compressed);

const varName = path.basename(outputFile).replace(/\.h$/, "");
const headerName = varName.toUpperCase();

const cData = Array.from(compressed)
	.map(v => v)
	.join(",");

const cOut = `
#ifndef ${headerName}
#define ${headerName}
const unsigned char ${varName}[${compressed.length}] = {${cData}};
#endif
`;

await Deno.writeTextFile(outputFile, cOut.trim() + "\n");
