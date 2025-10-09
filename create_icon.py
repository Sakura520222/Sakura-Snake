"""
创建贪吃蛇游戏图标的Python脚本
使用PIL库创建美观的像素风格图标
"""

from PIL import Image, ImageDraw
import os
import math

def create_snake_icon():
    """创建贪吃蛇游戏图标"""
    # 创建不同尺寸的图标（ICO文件需要多个尺寸）
    sizes = [16, 32, 48, 64, 128, 256]
    
    # 创建图像列表
    images = []
    
    for size in sizes:
        # 创建新图像（RGBA模式支持透明度）
        img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
        draw = ImageDraw.Draw(img)
        
        # 根据尺寸调整绘制参数
        if size >= 48:
            # 大尺寸图标：绘制详细的蛇和苹果
            draw_detailed_snake_icon(draw, size)
        elif size >= 32:
            # 中等尺寸图标：简化版本
            draw_medium_snake_icon(draw, size)
        else:
            # 小尺寸图标：极简版本
            draw_minimal_snake_icon(draw, size)
        
        images.append(img)
    
    # 保存为ICO文件
    images[0].save('game_icon.ico', format='ICO', sizes=[(img.width, img.height) for img in images])
    print(f"图标已创建: game_icon.ico")

def draw_detailed_snake_icon(draw, size):
    """绘制详细的蛇和苹果图标"""
    # 渐变背景 - 从深绿到浅绿的径向渐变
    center_x, center_y = size // 2, size // 2
    max_radius = size // 2
    
    # 创建渐变背景
    for r in range(max_radius, 0, -1):
        # 计算渐变颜色
        ratio = r / max_radius
        bg_color = (
            int(20 + 50 * (1 - ratio)),  # R: 20-70
            int(80 + 100 * (1 - ratio)), # G: 80-180
            int(20 + 50 * (1 - ratio)),  # B: 20-70
            255
        )
        draw.ellipse([
            center_x - r, center_y - r,
            center_x + r, center_y + r
        ], fill=bg_color)
    
    # 外边框 - 深绿色
    border_color = (0, 100, 0, 255)
    draw.ellipse([2, 2, size-2, size-2], outline=border_color, width=2)
    
    # 蛇的颜色 - 渐变绿色
    snake_head_color = (100, 255, 100, 255)  # 亮绿色头部
    snake_body_color = (50, 200, 50, 255)    # 中等绿色身体
    
    # 苹果的颜色 - 渐变红色
    apple_color = (255, 50, 50, 255)
    apple_highlight = (255, 150, 150, 255)
    
    # 绘制动态的蛇形
    draw_animated_snake(draw, size, snake_head_color, snake_body_color)
    
    # 绘制精美的苹果
    draw_beautiful_apple(draw, size, apple_color, apple_highlight)

def draw_animated_snake(draw, size, head_color, body_color):
    """绘制动态的蛇形"""
    center_x, center_y = size // 2, size // 2
    
    # 蛇的路径 - 正弦波形状
    points = []
    segments = 8
    amplitude = size // 6
    
    for i in range(segments + 1):
        t = i / segments
        x = center_x + (t - 0.5) * size * 0.6
        y = center_y + math.sin(t * math.pi * 2) * amplitude
        points.append((x, y))
    
    # 绘制蛇身（渐变粗细）
    for i in range(len(points) - 1):
        x1, y1 = points[i]
        x2, y2 = points[i + 1]
        
        # 计算线宽（头部粗，尾部细）
        width = max(2, int(size * 0.08 * (1 - i / segments)))
        
        # 绘制线段
        draw.line([x1, y1, x2, y2], fill=body_color, width=width)
    
    # 绘制蛇头
    head_x, head_y = points[0]
    head_radius = size // 10
    
    # 蛇头（圆形带高光）
    draw.ellipse([
        head_x - head_radius, head_y - head_radius,
        head_x + head_radius, head_y + head_radius
    ], fill=head_color)
    
    # 蛇头高光
    highlight_radius = head_radius // 3
    draw.ellipse([
        head_x - highlight_radius + head_radius//3, 
        head_y - highlight_radius + head_radius//3,
        head_x + highlight_radius + head_radius//3, 
        head_y + highlight_radius + head_radius//3
    ], fill=(255, 255, 255, 200))
    
    # 蛇眼睛
    eye_radius = head_radius // 4
    draw.ellipse([
        head_x - eye_radius, head_y - eye_radius,
        head_x + eye_radius, head_y + eye_radius
    ], fill=(0, 0, 0, 255))

def draw_beautiful_apple(draw, size, apple_color, highlight_color):
    """绘制精美的苹果"""
    center_x, center_y = size // 2, size // 2
    
    # 苹果位置（右上角）
    apple_x = center_x + size // 3
    apple_y = center_y - size // 4
    apple_radius = size // 7
    
    # 苹果主体（带渐变）
    for r in range(apple_radius, 0, -1):
        ratio = r / apple_radius
        color = (
            int(apple_color[0] * ratio),
            int(apple_color[1] * ratio * 0.3),
            int(apple_color[2] * ratio * 0.3),
            255
        )
        draw.ellipse([
            apple_x - r, apple_y - r,
            apple_x + r, apple_y + r
        ], fill=color)
    
    # 苹果高光
    highlight_radius = apple_radius // 2
    draw.ellipse([
        apple_x - highlight_radius + apple_radius//3, 
        apple_y - highlight_radius - apple_radius//3,
        apple_x + highlight_radius + apple_radius//3, 
        apple_y + highlight_radius - apple_radius//3
    ], fill=highlight_color)
    
    # 苹果梗
    stem_color = (120, 80, 40, 255)
    stem_width = size // 25
    stem_height = size // 12
    draw.rectangle([
        apple_x - stem_width//2, 
        apple_y - apple_radius - stem_height,
        apple_x + stem_width//2, 
        apple_y - apple_radius
    ], fill=stem_color)
    
    # 苹果叶子
    leaf_color = (100, 200, 100, 255)
    leaf_size = size // 15
    draw.ellipse([
        apple_x + stem_width, 
        apple_y - apple_radius - stem_height//2,
        apple_x + stem_width + leaf_size, 
        apple_y - apple_radius - stem_height//2 + leaf_size
    ], fill=leaf_color)

def draw_medium_snake_icon(draw, size):
    """绘制中等尺寸的蛇图标"""
    # 背景 - 单色深绿
    bg_color = (30, 120, 30, 255)
    draw.rectangle([0, 0, size, size], fill=bg_color)
    
    # 边框
    border_color = (0, 80, 0, 255)
    draw.rectangle([1, 1, size-1, size-1], outline=border_color, width=1)
    
    # 蛇的颜色
    snake_color = (80, 220, 80, 255)
    apple_color = (220, 50, 50, 255)
    
    # 绘制简化的蛇形（S形）
    center_x, center_y = size // 2, size // 2
    
    # S形路径
    points = [
        (center_x - size//3, center_y - size//6),
        (center_x - size//6, center_y + size//6),
        (center_x + size//6, center_y - size//6),
        (center_x + size//3, center_y + size//6)
    ]
    
    # 绘制蛇身
    for i in range(len(points) - 1):
        x1, y1 = points[i]
        x2, y2 = points[i + 1]
        draw.line([x1, y1, x2, y2], fill=snake_color, width=size//10)
    
    # 蛇头
    head_x, head_y = points[0]
    head_radius = size // 8
    draw.ellipse([
        head_x - head_radius, head_y - head_radius,
        head_x + head_radius, head_y + head_radius
    ], fill=snake_color)
    
    # 苹果
    apple_x, apple_y = points[-1]
    apple_radius = size // 9
    draw.ellipse([
        apple_x - apple_radius, apple_y - apple_radius,
        apple_x + apple_radius, apple_y + apple_radius
    ], fill=apple_color)

def draw_minimal_snake_icon(draw, size):
    """绘制极简版本的蛇图标"""
    # 背景
    bg_color = (40, 100, 40, 255)
    draw.rectangle([0, 0, size, size], fill=bg_color)
    
    # 简单的S形蛇
    snake_color = (100, 255, 100, 255)
    center_x, center_y = size // 2, size // 2
    
    # 三个点组成简单蛇形
    points = [
        (center_x - size//4, center_y),
        (center_x, center_y),
        (center_x + size//4, center_y)
    ]
    
    # 绘制点
    point_radius = size // 6
    for x, y in points:
        draw.ellipse([
            x - point_radius, y - point_radius,
            x + point_radius, y + point_radius
        ], fill=snake_color)
    
    # 苹果（右下角小点）
    apple_color = (255, 50, 50, 255)
    apple_radius = size // 8
    draw.ellipse([
        size - apple_radius*2, size - apple_radius*2,
        size - apple_radius, size - apple_radius
    ], fill=apple_color)

if __name__ == "__main__":
    try:
        create_snake_icon()
        print("贪吃蛇游戏图标创建成功！")
    except ImportError:
        print("需要安装PIL库: pip install Pillow")
    except Exception as e:
        print(f"创建图标时出错: {e}")