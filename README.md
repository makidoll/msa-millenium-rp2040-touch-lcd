# MSA Millenium with RP2040 Touch LCD attachment

Currently still working on modifying this model:

https://www.printables.com/model/538771-rp2040-lcd-128-msa

Attaching this to my MSA Millenium gas mask:

https://www.waveshare.com/wiki/RP2040-Touch-LCD-1.28

## Build

Install `pico-sdk picotool`

```bash
mkdir build
cd build
cmake -GNinja ..
```

Hold `BOOT`, press `RESET`, let go of `BOOT`. Screen should off.

`ninja && sudo picotool load main.uf2`

Press `RESET`

## Usage

Long hold on screen to change screen

## Tools

-   **make-image** examples:

    -   Resize image to 240x240 using Lanczos
    -   Compress using huffman encoding and custom bitpacking to reduce size
    -   Save as const unsigned char .h file

    `deno run -A assets/make-image.ts assets/maki.png src/images/maki_image.h`

    `deno run -A assets/make-image.ts assets/hexcorp.png src/images/hexcorp_image.h --grayscale`
