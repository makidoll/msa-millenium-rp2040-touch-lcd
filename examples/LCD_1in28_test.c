/*****************************************************************************
* | File      	:   LCD_1in28_test.c
* | Author      :   Waveshare team
* | Function    :   1.3inch LCD  test demo
* | Info        :
*----------------
* |	This version:   V1.0
* | Date        :   2021-08-20
* | Info        :
#
# Permission is hereby granted, free of charge, to any person obtaining a copy
# of this software and associated documnetation files (the "Software"), to deal
# in the Software without restriction, including without limitation the rights
# to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
# copies of the Software, and to permit persons to  whom the Software is
# furished to do so, subject to the following conditions:
#
# The above copyright notice and this permission notice shall be included in
# all copies or substantial portions of the Software.
#
# THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
# IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
# FITNESS OR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
# AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
# LIABILITY WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
# OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
# THE SOFTWARE.
#
******************************************************************************/
#include "LCD_Test.h"
#include "LCD_1in28.h"
#include "QMI8658.h"
#include <stdio.h>
#include "pico/stdlib.h"
#include "hardware/adc.h"
#include "CST816S.h"

uint8_t flag = 0;

void Touch_INT_callback(uint gpio, uint32_t events);

int LCD_1in28_test(void)
{
    if (DEV_Module_Init() != 0)
    {
        return -1;
    }
    printf("LCD_1in28_test Demo\r\n");
    LCD_1IN28_Init(HORIZONTAL);
    LCD_1IN28_Clear(WHITE);

    DEV_SET_PWM(100);
    uint32_t Imagesize = LCD_1IN28_HEIGHT * LCD_1IN28_WIDTH * 2;
    uint16_t *BlackImage;
    if ((BlackImage = (uint16_t *)malloc(Imagesize)) == NULL)
    {
        printf("Failed to apply for black memory...\r\n");
        exit(0);
    }
    // /*1.Create a new image cache named IMAGE_RGB and fill it with white*/
    Paint_NewImage((uint8_t *)BlackImage, LCD_1IN28.WIDTH, LCD_1IN28.HEIGHT, 0, WHITE);
    Paint_SetScale(65);
    Paint_Clear(WHITE);
    Paint_SetRotate(ROTATE_0);
    Paint_Clear(WHITE);
    // /* GUI */
    printf("drawing...\r\n");
    // /*2.Drawing on the image*/
#if 1
    Paint_DrawPoint(50, 41, BLACK, DOT_PIXEL_1X1, DOT_FILL_RIGHTUP); // 240 240
    Paint_DrawPoint(50, 46, BLACK, DOT_PIXEL_2X2, DOT_FILL_RIGHTUP);
    Paint_DrawPoint(50, 51, BLACK, DOT_PIXEL_3X3, DOT_FILL_RIGHTUP);
    Paint_DrawPoint(50, 56, BLACK, DOT_PIXEL_4X4, DOT_FILL_RIGHTUP);
    Paint_DrawPoint(50, 61, BLACK, DOT_PIXEL_5X5, DOT_FILL_RIGHTUP);

    Paint_DrawLine(60, 40, 90, 70, MAGENTA, DOT_PIXEL_2X2, LINE_STYLE_SOLID);
    Paint_DrawLine(60, 70, 90, 40, MAGENTA, DOT_PIXEL_2X2, LINE_STYLE_SOLID);

    Paint_DrawRectangle(60, 40, 90, 70, RED, DOT_PIXEL_2X2, DRAW_FILL_EMPTY);
    Paint_DrawRectangle(100, 40, 130, 70, BLUE, DOT_PIXEL_2X2, DRAW_FILL_FULL);

    Paint_DrawLine(135, 55, 165, 55, CYAN, DOT_PIXEL_1X1, LINE_STYLE_DOTTED);
    Paint_DrawLine(150, 40, 150, 70, CYAN, DOT_PIXEL_1X1, LINE_STYLE_DOTTED);

    Paint_DrawCircle(150, 55, 15, GREEN, DOT_PIXEL_1X1, DRAW_FILL_EMPTY);
    Paint_DrawCircle(185, 55, 15, GREEN, DOT_PIXEL_1X1, DRAW_FILL_FULL);

    Paint_DrawNum(50, 80, 9.87654321, &Font20, 3, WHITE, BLACK);
    Paint_DrawString_EN(50, 100, "ABC", &Font20, 0x000f, 0xfff0);
    Paint_DrawString_CN(50, 120, "΢ѩ����", &Font24CN, WHITE, BLUE);
    Paint_DrawString_EN(50, 161, "WaveShare", &Font16, RED, WHITE);

    // /*3.Refresh the picture in RAM to LCD*/
    LCD_1IN28_Display(BlackImage);
    DEV_Delay_ms(1000);

#endif

#if 1
    Paint_DrawImage(gImage_1inch3_1, 0, 0, 240, 240);
    LCD_1IN28_Display(BlackImage);
    DEV_Delay_ms(1000);
#endif

#if 1

    float acc[3], gyro[3];
    unsigned int tim_count = 0;
    const float conversion_factor = 3.3f / (1 << 12) * 2;

    CST816S_init(CST816S_Gesture_Mode);
    DEV_KEY_Config(Touch_INT_PIN);
    DEV_IRQ_SET(Touch_INT_PIN, GPIO_IRQ_EDGE_RISE, &Touch_INT_callback);
    QMI8658_init();
    
    Paint_Clear(WHITE);
    Paint_DrawRectangle(0, 00, 240, 49, 0XF410, DOT_PIXEL_2X2, DRAW_FILL_FULL);
    Paint_DrawRectangle(0, 49, 240, 120, 0X4F30, DOT_PIXEL_2X2, DRAW_FILL_FULL);
    Paint_DrawRectangle(0, 120, 240, 195, 0XAD55, DOT_PIXEL_2X2, DRAW_FILL_FULL);
    Paint_DrawRectangle(0, 195, 240, 240, 0X2595, DOT_PIXEL_2X2, DRAW_FILL_FULL);

    Paint_DrawString_EN(45, 30, "LongPress Quit", &Font16, BLACK, 0XF410);
    Paint_DrawString_EN(45, 50, "ACC_X = " , &Font16, BLACK, 0X4F30);
    Paint_DrawString_EN(45, 75, "ACC_Y = " , &Font16, BLACK, 0X4F30);
    Paint_DrawString_EN(45, 100, "ACC_Z = ", &Font16, BLACK, 0X4F30);
    Paint_DrawString_EN(45, 125, "GYR_X = ", &Font16, BLACK, 0XAD55);
    Paint_DrawString_EN(45, 150, "GYR_Y = ", &Font16, BLACK, 0XAD55);
    Paint_DrawString_EN(45, 175, "GYR_Z = ", &Font16, BLACK, 0XAD55);
    Paint_DrawString_EN(45, 200, "BAT(V)=" , &Font16, BLACK, 0X2595);
    LCD_1IN28_Display(BlackImage);
    while (true)
    {
        uint16_t result = adc_read();
        printf("Raw value: 0x%03x, voltage: %f V\n", result, result * conversion_factor);
        Paint_Clear(WHITE);
        QMI8658_read_xyz(acc, gyro, &tim_count);
        printf("acc_x   = %4.3fmg , acc_y  = %4.3fmg , acc_z  = %4.3fmg\r\n", acc[0], acc[1], acc[2]);
        printf("gyro_x  = %4.3fdps, gyro_y = %4.3fdps, gyro_z = %4.3fdps\r\n", gyro[0], gyro[1], gyro[2]);

        printf("tim_count = %d\r\n", tim_count);
        Paint_DrawRectangle(120, 49,  220, 120, 0X4F30, DOT_PIXEL_2X2, DRAW_FILL_FULL);
        Paint_DrawRectangle(120, 120, 220, 195, 0XAD55, DOT_PIXEL_2X2, DRAW_FILL_FULL);
        Paint_DrawRectangle(120, 195, 220, 240, 0X2595, DOT_PIXEL_2X2, DRAW_FILL_FULL);
        Paint_DrawNum(120, 50, acc[0], &Font16, 2, BLACK , 0X4F30);
        Paint_DrawNum(120, 75, acc[1], &Font16, 2, BLACK , 0X4F30);
        Paint_DrawNum(120, 100, acc[2], &Font16, 2, BLACK, 0X4F30);
        Paint_DrawNum(120, 125, gyro[0], &Font16, 2, BLACK, 0XAD55);
        Paint_DrawNum(120, 150, gyro[1], &Font16, 2, BLACK, 0XAD55);
        Paint_DrawNum(120, 175, gyro[2], &Font16, 2, BLACK, 0XAD55);
        Paint_DrawNum(130, 200, result * conversion_factor, &Font16, 2, BLACK, 0X2595);
        LCD_1IN28_DisplayWindows(120, 50, 210, 200, BlackImage);
        LCD_1IN28_DisplayWindows(130, 200, 220, 220, BlackImage);
        DEV_Delay_ms(100);
        if (flag == 1)
        {
            flag = 0;
            break;
        }

    }

#endif
#if 1
    CST816S_init(CST816S_Point_Mode);
    Paint_Clear(WHITE);
    Paint_DrawRectangle(0, 00, 240, 47, 0X2595, DOT_PIXEL_2X2, DRAW_FILL_FULL);
    Paint_DrawString_EN(60, 30, "Touch test", &Font16, BLACK, 0X2595);
    LCD_1IN28_Display(BlackImage);
    while (true)
    {
        if (flag)
        {
            CST816S_Get_Point();
            // Paint_DrawPoint(Touch_CTS816.x_point, Touch_CTS816.y_point, WHITE, DOT_PIXEL_4X4, DOT_FILL_RIGHTUP);
            Paint_DrawPoint(Touch_CTS816.x_point, Touch_CTS816.y_point, BLACK, DOT_PIXEL_3X3, DOT_FILL_RIGHTUP);
            LCD_1IN28_DisplayWindows(Touch_CTS816.x_point - 1, Touch_CTS816.y_point - 1, Touch_CTS816.x_point + 5, Touch_CTS816.y_point + 5, BlackImage);
            printf("X:%d Y:%d\r\n", Touch_CTS816.x_point, Touch_CTS816.y_point);
            flag = 0;
        }
    }
#endif

    /* Module Exit */
    free(BlackImage);
    BlackImage = NULL;

    DEV_Module_Exit();
    return 0;
}

void Touch_INT_callback(uint gpio, uint32_t events)
{
    if (gpio == Touch_INT_PIN)
    {
        if (Touch_CTS816.mode == CST816S_Gesture_Mode)
        {
            uint8_t gesture = CST816S_Get_Gesture();
            if (gesture == CST816S_Gesture_Long_Press)
            {
                flag = 1;
            }
        }
        else
        {
            flag = 1;
        }
    }
}