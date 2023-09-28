type FrequencyMap = Map<number, number>; // byte, frequency

function getFrequencyMap(data: Uint8Array): FrequencyMap {
	const map: FrequencyMap = new Map();

	for (const byte of data) {
		const value = map.get(byte);
		if (value == null) {
			map.set(byte, 1);
		} else {
			map.set(byte, value + 1);
		}
	}

	return map;
}

type Bit = 0 | 1; // left | right

interface HuffNode {
	left?: HuffNode;
	right?: HuffNode;
	parent?: HuffNode;
	parentSide?: Bit;
	byte?: number;
	freq: number;
}

function frequencyMapToNodes(freqs: FrequencyMap): {
	charNodes: HuffNode[];
	rootNode: HuffNode;
} {
	const charNodes: HuffNode[] = Array.from(freqs.entries()).map(
		([byte, freq]) => ({ byte, freq }),
	);

	// new array but keep references
	let topLevelNodes = new Array(charNodes.length)
		.fill(null)
		.map((_, i) => charNodes[i]);

	while (true) {
		if (topLevelNodes.length == 1) break;

		let lowestA: HuffNode = { freq: Infinity };
		let lowestB: HuffNode = { freq: Infinity };

		for (const node of topLevelNodes) {
			if (node.freq < lowestA.freq) {
				lowestA = node;
			}
		}

		for (const node of topLevelNodes) {
			if (node.freq < lowestB.freq && node != lowestA) {
				lowestB = node;
			}
		}

		lowestA.parentSide = 0;
		lowestB.parentSide = 1;

		const newNode: HuffNode = {
			left: lowestA,
			right: lowestB,
			freq: lowestA.freq + lowestB.freq,
		};

		lowestA.parent = newNode;
		lowestB.parent = newNode;

		topLevelNodes.splice(topLevelNodes.indexOf(lowestA), 1);
		topLevelNodes.splice(topLevelNodes.indexOf(lowestB), 1);
		topLevelNodes.push(newNode);
	}

	const rootNode = topLevelNodes[0];

	return { charNodes, rootNode };
}

function encodeData(frequencyMap: FrequencyMap, data: Uint8Array) {
	const { charNodes } = frequencyMapToNodes(frequencyMap);

	let allBits: boolean[] = [];

	for (const byte of data) {
		let seq: string[] = [];

		let currentNode: HuffNode | undefined = charNodes.find(
			n => n.byte == byte,
		);

		if (currentNode == null) {
			throw new Error("Node with char not found");
		}

		while (currentNode.parent != null) {
			seq.push(String(currentNode.parentSide));
			currentNode = currentNode?.parent;
		}

		const bits = seq.reverse().map(bit => (bit === "0" ? false : true));

		allBits.push(...bits);
	}

	return allBits;
}

function decode(frequencyMap: FrequencyMap, encoded: boolean[]) {
	const { rootNode } = frequencyMapToNodes(frequencyMap);

	let bytes: number[] = [];

	let currentNode: HuffNode | undefined = rootNode;

	for (const bit of encoded) {
		currentNode = bit == false ? currentNode?.left : currentNode?.right;

		if (currentNode?.byte == null) {
			continue;
		}

		bytes.push(currentNode.byte);

		currentNode = rootNode;
	}

	return Uint8Array.from(bytes);
}

const MAX_UINT8 = 255;
const MAX_UINT16 = 65535;
// const MAX_UINT32 = 4294967295;

function uintXto8(x: 16 | 32, value: number): number[] {
	const tempA = x == 16 ? new Uint16Array(1) : new Uint32Array(1);
	tempA[0] = value;

	const tempB = new Uint8Array(
		tempA.buffer,
		tempA.byteOffset,
		tempA.byteLength,
	);

	return Array.from(tempB);
}

// frequency map:
//
// for each frequency figure out if we need uint8/16/32
// uint8 => 00
// uint16 => 01
// uint32 => 10
// EOF => 11 used once
//
// ...pack the above into uint8 array.
// add one extra if necessary just for the EOF 0b11
//
// ...array of [uint8: byte] [uint8/16/32: frequency]
//
// no eof needed cause we already defined sizes above

function chunk<T>(array: T[], size: number) {
	return Array.from({ length: Math.ceil(array.length / size) }, (_, i) =>
		array.slice(i * size, i * size + size),
	);
}

function packFrequencyMap(frequencyMap: FrequencyMap): Uint8Array {
	const frequencyMapEntries = Array.from(frequencyMap.entries());

	let frequencyUintSize: number[] = [];
	let frequencyUintSizeBinary: string[] = [];

	for (const [_, frequency] of frequencyMapEntries) {
		if (frequency > MAX_UINT16) {
			frequencyUintSize.push(32); // uint32
			frequencyUintSizeBinary.push("1", "0");
		} else if (frequency > MAX_UINT8) {
			frequencyUintSize.push(16); // uint16
			frequencyUintSizeBinary.push("0", "1");
		} else {
			frequencyUintSize.push(8); // uint8
			frequencyUintSizeBinary.push("0", "0");
		}
	}

	frequencyUintSizeBinary.push("1", "1"); // eof

	const packed: number[] = chunk<string>(frequencyUintSizeBinary, 8).map(
		byte => parseInt(byte.join("").padEnd(8, "0"), 2),
	);

	for (let i = 0; i < frequencyMapEntries.length; i++) {
		const [byte, frequency] = frequencyMapEntries[i];

		packed.push(byte);

		const uintSize = frequencyUintSize[i];

		if (uintSize == 8) {
			packed.push(frequency);
		} else if (uintSize == 16) {
			packed.push(...uintXto8(16, frequency));
		} else if (uintSize == 32) {
			packed.push(...uintXto8(32, frequency));
		}
	}

	return Uint8Array.from(packed);
}

function packEncodedData(data: boolean[]) {
	let packed = new Uint8Array(Math.ceil(data.length / 8));
	let pos = 0;

	for (let i = 0; i < data.length; i += 8) {
		const bits = data
			.slice(i, i + 8)
			.map(b => (b === true ? "1" : "0"))
			.join("")
			.padEnd(8, "0");

		packed[pos] = parseInt(bits, 2);
		pos++;
	}

	return { data: packed, bitsToIgnoreAtEnd: packed.length * 8 - data.length };
}

// header (fixed length of 1 byte):
//
// [uint8: how many bits to ignore on last byte, since data is packed]
//
// ...packed frequency map
//
// ...packed data

function huffmanEncode(data: Uint8Array) {
	const frequencyMap = getFrequencyMap(data);

	const encodedData = encodeData(frequencyMap, data);

	const packedFrequencyMap = packFrequencyMap(frequencyMap);
	const packedEncodedData = packEncodedData(encodedData);

	const packedFinal = new Uint8Array(
		1 + packedFrequencyMap.length + packedEncodedData.data.length,
	);

	packedFinal[0] = packedEncodedData.bitsToIgnoreAtEnd;

	for (let i = 0; i < packedFrequencyMap.length; i++) {
		packedFinal[1 + i] = packedFrequencyMap[i];
	}

	for (let i = 0; i < packedEncodedData.data.length; i++) {
		packedFinal[1 + packedFrequencyMap.length + i] =
			packedEncodedData.data[i];
	}

	return packedFinal;
}

// running huffman encoding multiple times compresses down really well
// so keep encoding until at smallest and then append rounds to file

// [uint8: rounds]
// [uint32: final decoded size]

export function makiHuffmanEncode(data: Uint8Array) {
	let rounds = 0;
	let currentData: Uint8Array = data;

	while (true) {
		const newData = huffmanEncode(currentData);
		if (newData.length > currentData.length) break;
		currentData = newData;
		rounds++;
	}

	if (rounds == 0) {
		throw new Error("Can't compress even once");
	}

	const finalDecodedSize = uintXto8(32, data.length);

	const dataOffset = 1 + 4;
	const finalData = new Uint8Array(currentData.length + dataOffset);

	finalData[0] = rounds;
	finalData[1] = finalDecodedSize[0];
	finalData[2] = finalDecodedSize[1];
	finalData[3] = finalDecodedSize[2];
	finalData[4] = finalDecodedSize[3];

	for (let i = 0; i < currentData.length; i++) {
		finalData[i + dataOffset] = currentData[i];
	}

	return finalData;
}

function uint16ToNumber(uint16: Uint8Array) {
	return new Uint16Array(uint16.buffer, 0, 1)[0];
}

function uint32ToNumber(uint32: Uint8Array) {
	return new Uint32Array(uint32.buffer, 0, 1)[0];
}

function unpackEncodedData(
	packedEncodedData: Uint8Array,
	bitsToIgnoreAtEnd: number,
): boolean[] {
	const encodedData: boolean[] = [];

	for (let byte of packedEncodedData) {
		encodedData.push(
			...byte
				.toString(2)
				.padStart(8, "0")
				.split("")
				.map(b => b == "1"),
		);
	}

	return encodedData.slice(0, encodedData.length - bitsToIgnoreAtEnd);
}

function huffmanDecode(data: Uint8Array) {
	let pos = 0;

	const bitsToIgnoreAtEnd = data[pos++];

	// unpack frequency map uint sizes

	let frequencyUintSizes: number[] = []; // 8, 16, 32, -1

	while (true) {
		let byte = data[pos++];
		let binary = byte.toString(2).padStart(8, "0");

		let uintSizes = chunk(binary.split(""), 2)
			.map(a => a.join(""))
			.map(type => {
				if (type == "00") {
					return 8;
				} else if (type == "01") {
					return 16;
				} else if (type == "10") {
					return 32;
				} else {
					return -1;
				}
			});

		if (uintSizes.includes(-1)) {
			// EOF found
			// remove -1 and all after
			uintSizes.splice(uintSizes.indexOf(-1), 999);
			// append and break
			frequencyUintSizes = [...frequencyUintSizes, ...uintSizes];
			break;
		} else {
			// just append
			frequencyUintSizes = [...frequencyUintSizes, ...uintSizes];
		}
	}

	// unpack frequency map data

	const frequencyMap: FrequencyMap = new Map();

	for (const uintSize of frequencyUintSizes) {
		const byte = data[pos++];

		let frequency = 0;

		if (uintSize == 8) {
			frequency = data[pos++];
		} else if (uintSize == 16) {
			frequency = uint16ToNumber(
				Uint8Array.from([data[pos++], data[pos++]]),
			);
		} else if (uintSize == 32) {
			frequency = uint32ToNumber(
				Uint8Array.from([
					data[pos++],
					data[pos++],
					data[pos++],
					data[pos++],
				]),
			);
		}

		frequencyMap.set(byte, frequency);
	}

	// unpack encoded data

	const packedEncodedData = data.slice(pos);

	const encodedData = unpackEncodedData(packedEncodedData, bitsToIgnoreAtEnd);

	const decodedData = decode(frequencyMap, encodedData);

	return decodedData;
}

export function makiHuffmanDecode(data: Uint8Array) {
	const rounds = data[0];

	// this is to optimize for c
	// const finalDataSize = uint32ToNumber(data.slice(1, 5));

	let currentData = data.slice(5, data.length);

	for (let i = 0; i < rounds; i++) {
		currentData = huffmanDecode(currentData);
	}

	return currentData;
}

// console.log(testInput.length / 1000 + " KB");

const testInput = await Deno.readFile("./test-input.png");
// console.log(testInput[testInput.length - 1].toString(2).padStart(8, "0"));

let testEncoded = makiHuffmanEncode(testInput);

let testDecoded = makiHuffmanDecode(testEncoded);

// console.log(testDecoded[testInput.length - 1].toString(2).padStart(8, "0"));
await Deno.writeFile("./test-output.png", testDecoded);
