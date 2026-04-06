#!/usr/bin/env python3
"""
图标转换脚本
根据 icon.png 文件生成各个平台所需的图标格式
"""

import os
import sys
import subprocess
from PIL import Image

# 添加项目根目录到 Python 路径
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
from app.utils.logger_util import logger

# 输入和输出路径
INPUT_PATH = os.path.join(os.path.dirname(__file__), "icon.png")
OUTPUT_DIR = os.path.dirname(__file__)

# 确保输入文件存在
if not os.path.exists(INPUT_PATH):
    logger.error(f"错误: 找不到输入文件 {INPUT_PATH}")
    sys.exit(1)

# 打开基础图像
logger.info(f"正在读取基础图像: {INPUT_PATH}")
img = Image.open(INPUT_PATH)

# 生成 256x256 PNG 图标（Linux）
png_output = os.path.join(OUTPUT_DIR, "icon_256x256.png")
img_256 = img.resize((256, 256), Image.LANCZOS)
img_256.save(png_output, format="PNG")
logger.info(f"生成 Linux 图标: {png_output}")

# 生成 ICO 图标（Windows）
ico_output = os.path.join(OUTPUT_DIR, "icon.ico")

logger.info("正在生成 Windows ICO 图标...")

try:
    # 使用 256x256 尺寸生成 ICO，这是最常用的尺寸
    logger.debug("  使用 256x256 尺寸生成 ICO")
    
    # 从基础图像调整大小
    logger.debug("  从基础图像调整到 256x256")
    img_256 = img.resize((256, 256), Image.LANCZOS)
    
    # 确保图像模式为 RGBA
    if img_256.mode != 'RGBA':
        img_256 = img_256.convert('RGBA')
    
    # 保存为 ICO
    img_256.save(ico_output, format="ICO")
    logger.info(f"生成 Windows 图标: {ico_output}")
    
    # 检查生成的文件大小
    import os
    file_size = os.path.getsize(ico_output)
    logger.debug(f"  ICO 文件大小: {file_size} 字节")
    
    if file_size < 1000:
        logger.warning("  警告: ICO 文件大小较小，可能存在问题")
    else:
        logger.debug("  ICO 文件大小正常")
        
except Exception as e:
    logger.error(f"错误: 生成 ICO 文件失败: {e}")

# 生成 ICNS 图标（macOS）
icns_output = os.path.join(OUTPUT_DIR, "icon.icns")
try:
    # 先创建临时的 icon.iconset 目录
    temp_iconset = os.path.join(OUTPUT_DIR, "temp_icon.iconset")
    os.makedirs(temp_iconset, exist_ok=True)
    
    # 为 icon.iconset 生成所需的不同尺寸
    iconset_sizes = [
        (16, 16),
        (16, 16, 2),  # @2x
        (32, 32),
        (32, 32, 2),  # @2x
        (128, 128),
        (128, 128, 2),  # @2x
        (256, 256),
        (256, 256, 2),  # @2x
        (512, 512),
        (512, 512, 2),  # @2x
    ]
    
    logger.debug("  创建临时 icon.iconset 目录...")
    for size in iconset_sizes:
        if len(size) == 3:
            width, height, scale = size
            filename = f"icon_{width}x{height}@2x.png"
            resize_size = (width * 2, height * 2)
        else:
            width, height = size
            scale = 1
            filename = f"icon_{width}x{height}.png"
            resize_size = (width, height)
        
        # 调整大小
        resized = img.resize(resize_size, Image.LANCZOS)
        # 确保图像模式为 RGBA
        if resized.mode != 'RGBA':
            resized = resized.convert('RGBA')
        # 保存到临时目录
        output_path = os.path.join(temp_iconset, filename)
        resized.save(output_path, format="PNG")
        logger.debug(f"  生成: {filename}")
    
    # 使用 macOS 系统命令生成 icns
    logger.debug("  使用 iconutil 生成 ICNS 文件...")
    subprocess.run(
        ["iconutil", "-c", "icns", "temp_icon.iconset"],
        cwd=OUTPUT_DIR,
        check=True,
        capture_output=True,
        text=True
    )
    
    # 重命名生成的文件
    temp_icns = os.path.join(OUTPUT_DIR, "temp_icon.icns")
    if os.path.exists(temp_icns):
        os.rename(temp_icns, icns_output)
        logger.info(f"生成 macOS 图标: {icns_output}")
    
    # 清理临时目录
    import shutil
    shutil.rmtree(temp_iconset)
    logger.debug("  清理临时文件...")
    
except subprocess.CalledProcessError as e:
    logger.warning(f"警告: 生成 macOS 图标失败: {e.stderr}")
except FileNotFoundError:
    logger.warning("警告: iconutil 命令不可用，跳过生成 macOS 图标")
except Exception as e:
    logger.error(f"错误: 生成 macOS 图标失败: {e}")
    # 清理临时目录
    try:
        import shutil
        if os.path.exists(temp_iconset):
            shutil.rmtree(temp_iconset)
    except:
        pass

logger.info("图标转换完成!")