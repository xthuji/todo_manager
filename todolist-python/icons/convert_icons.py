#!/usr/bin/env python3
"""
图标转换脚本
将 favicon.png 转换为各个平台所需的图标格式
"""

import os
import sys
from PIL import Image

# 输入和输出路径
INPUT_PATH = os.path.join(os.path.dirname(__file__), "icon.png")
OUTPUT_DIR = os.path.dirname(__file__)

# 确保输入文件存在
if not os.path.exists(INPUT_PATH):
    print(f"错误: 找不到输入文件 {INPUT_PATH}")
    sys.exit(1)

# 打开输入图像
print(f"正在读取输入图像: {INPUT_PATH}")
img = Image.open(INPUT_PATH)

# 生成 256x256 PNG 图标（Linux）
png_output = os.path.join(OUTPUT_DIR, "icon_256x256.png")
img_256 = img.resize((256, 256), Image.LANCZOS)
img_256.save(png_output, format="PNG")
print(f"生成 Linux 图标: {png_output}")

# 生成 ICO 图标（Windows）
ico_output = os.path.join(OUTPUT_DIR, "icon.ico")
# 为 ICO 准备不同尺寸
icon_sizes = [(16, 16), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)]
icon_images = []
for size in icon_sizes:
    icon_img = img.resize(size, Image.LANCZOS)
    icon_images.append(icon_img)
# 保存为 ICO
icon_images[0].save(
    ico_output,
    format="ICO",
    sizes=icon_sizes,
    append_images=icon_images[1:]
)
print(f"生成 Windows 图标: {ico_output}")

print("图标转换完成!")