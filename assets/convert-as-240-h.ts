import * as flags from "https://deno.land/std/flags/mod.ts";
import {
	FilterType,
	ImageMagick,
	initialize,
} from "https://deno.land/x/imagemagick_deno/mod.ts";
import * as path from "https://deno.land/std/path/mod.ts";

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

function r5g6b5asUchars(color: Uint8Array): [string, string] {
	const r = color[0];
	const g = color[1];
	const b = color[2];

	const rgb565 = (((r & 248) << 8) + ((g & 252) << 3) + ((b & 248) >> 3))
		.toString(16)
		.padStart(4, "0");

	// bytes need to be swapped
	return [rgb565.slice(2, 4), rgb565.slice(0, 2)];
}

await initialize(); // imagemagick

const inputData: Uint8Array = await Deno.readFile(inputFile);

const varName = path.basename(outputFile).replace(/\.h$/, "");
const headerName = varName.toUpperCase();

const cCharStrs: string[] = [];

// cant await cause it disposes early idk

ImageMagick.read(inputData, image => {
	image.filterType = FilterType.Lanczos2;

	const size = 240;
	const length = size * size;

	image.resize(size, size);

	image.getPixels(async pixels => {
		for (let y = 0; y < size; y++) {
			for (let x = 0; x < size; x++) {
				const pixel = pixels.getPixel(x, y);

				if (grayscale) {
					const avg = Math.floor(
						(pixel[0] + pixel[1] + pixel[2]) / 3,
					);
					const cVal = "0x" + avg.toString(16).padStart(2, "0");
					cCharStrs.push(cVal);
				} else {
					cCharStrs.push("0x" + r5g6b5asUchars(pixel).join(""));
				}
			}
		}

		const cLength = length;
		const cType = grayscale ? "char" : "short";

		const cOut = `
#ifndef ${headerName}
#define ${headerName}
const unsigned ${cType} ${varName}[${cLength}] = {${cCharStrs.join(",")}};
#endif
		`;

		await Deno.writeTextFile(outputFile, cOut.trim() + "\n");
	});
});
