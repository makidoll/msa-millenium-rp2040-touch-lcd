#include "LCD_1in28.h"
#include "CST816S.h"
#include <stdio.h>
#include <math.h>
#include "screens/maki_profile_picture_screen.h"
#include "screens/hexcorp_screen.h"
#include "screens/mechanyx_screen.h"

void printBits(size_t const size, void const * const ptr)
{
    unsigned char *b = (unsigned char*) ptr;
    unsigned char byte;
    int i, j;
    
    for (i = size-1; i >= 0; i--) {
        for (j = 7; j >= 0; j--) {
            byte = (b[i] >> j) & 1;
            printf("%u", byte);
        }
    }
    puts("");
}

uint8_t currentScreen = 0;
#define MAX_SCREENS 3

void Touch_INT_callback(uint gpio, uint32_t events)
{
    if (gpio == Touch_INT_PIN)
    {
        if (Touch_CTS816.mode == CST816S_Gesture_Mode)
        {
            uint8_t gesture = CST816S_Get_Gesture();
            if (gesture == CST816S_Gesture_Long_Press)
            {
                if (currentScreen >= MAX_SCREENS - 1) {
                    currentScreen = 0; // reset back to 0
                } else {
                    currentScreen++;
                }
            }
        }
    }
}

int main(void)
{
    if (DEV_Module_Init() != 0)
    {
        return -1;
    }
    
    // init lcd

    LCD_1IN28_Init(HORIZONTAL);
    LCD_1IN28_Clear(0x0000);

    DEV_SET_PWM(100);
  
    // init gestures

    CST816S_init(CST816S_Gesture_Mode);
    DEV_KEY_Config(Touch_INT_PIN);
    DEV_IRQ_SET(Touch_INT_PIN, GPIO_IRQ_EDGE_RISE, &Touch_INT_callback);

   // init screens states

    uint16_t buffer[LCD_1IN28_WIDTH * LCD_1IN28_HEIGHT];
    uint8_t lastScreen = MAX_SCREENS + 1;

    HexCorpScreenState hexCorpScreenState;
    InitHexCorpScreenState(&hexCorpScreenState);

    // update and draw

    while (1) {
        bool firstDraw = lastScreen != currentScreen;
        lastScreen = currentScreen;

        bool needsDraw;

        switch (currentScreen) {
            case 0:
                needsDraw = MakiProfilePictureScreen(buffer, firstDraw);
                break;
            case 1:
                needsDraw = HexCorpScreen(&hexCorpScreenState, buffer, firstDraw);
                break;
            case 2:
                needsDraw = MechanyxScreen(buffer, firstDraw);
                break;
        }

        if (needsDraw) {
            LCD_1IN28_Display(buffer);
        }
    }
    
    DEV_Delay_ms(1000);

    // cleanup

    DEV_Module_Exit();
    return 0;
}
