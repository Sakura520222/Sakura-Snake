"""
创建贪吃蛇游戏图标的Python脚本
使用PIL库创建像素风格的图标
"""

from PIL import Image, ImageDraw
import os

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
        if size >= 32:
            # 大尺寸图标：绘制详细的蛇和苹果
            draw_detailed_snake_icon(draw, size)
        else:
            # 小尺寸图标：简化版本
            draw_simple_snake_icon(draw, size)
        
        images.append(img)
    
    # 保存为ICO文件
    images[0].save('game_icon.ico', format='ICO', sizes=[(img.width, img.height) for img in images])
    print(f"图标已创建: game_icon.ico")

def draw_detailed_snake_icon(draw, size):
    """绘制详细的蛇和苹果图标"""
    # 背景颜色 - 深绿色
    bg_color = (34, 139, 34, 255)  # 森林绿
    
    # 绘制圆形背景
    margin = size // 10
    draw.ellipse([margin, margin, size - margin, size - margin], fill=bg_color)
    
    # 蛇的颜色 - 亮绿色
    snake_color = (50, 205, 50, 255)  # 酸橙绿
    
    # 苹果的颜色 - 红色
    apple_color = (255, 0, 0, 255)
    
    # 根据尺寸调整元素大小
    if size >= 128:
        # 大图标：绘制完整的蛇
        draw_snake(draw, size, snake_color)
        draw_apple(draw, size, apple_color)
    else:
        # 中等图标：简化版本
        draw_simple_snake(draw, size, snake_color)
        draw_simple_apple(draw, size, apple_color)

def draw_snake(draw, size, color):
    """绘制蛇"""
    # 蛇的身体位置（简化版本）
    center_x, center_y = size // 2, size // 2
    
    # 蛇头（圆形）
    head_radius = size // 8
    draw.ellipse([
        center_x - head_radius, 
        center_y - head_radius - size//10,
        center_x + head_radius, 
        center_y + head_radius - size//10
    ], fill=color)
    
    # 蛇身（几个连接的圆形）
    body_radius = head_radius - 1
    for i in range(3):
        draw.ellipse([
            center_x - body_radius, 
            center_y - body_radius + i * body_radius,
            center_x + body_radius, 
            center_y + body_radius + i * body_radius
        ], fill=color)

def draw_apple(draw, size, color):
    """绘制苹果"""
    center_x, center_y = size // 2, size // 2
    
    # 苹果主体（圆形）
    apple_radius = size // 6
    draw.ellipse([
        center_x - apple_radius + size//4, 
        center_y - apple_radius + size//4,
        center_x + apple_radius + size//4, 
        center_y + apple_radius + size//4
    ], fill=color)
    
    # 苹果梗（小矩形）
    stem_color = (139, 69, 19, 255)  #  saddle brown
    stem_width = size // 20
    stem_height = size // 10
    draw.rectangle([
        center_x + size//4 - stem_width//2, 
        center_y + size//4 - apple_radius - stem_height,
        center_x + size//4 + stem_width//2, 
        center_y + size//4 - apple_radius
    ], fill=stem_color)

def draw_simple_snake_icon(draw, size):
    """绘制简化版本的蛇图标"""
    # 背景颜色
    bg_color = (34, 139, 34, 255)
    
    # 绘制圆形背景
    margin = size // 6
    draw.ellipse([margin, margin, size - margin, size - margin], fill=bg_color)
    
    # 蛇的颜色
    snake_color = (50, 205, 50, 255)
    
    # 绘制简单的蛇（S形）
    center_x, center_y = size // 2, size // 2
    
    # 蛇身（几个点组成的S形）
    points = []
    for i in range(5):
        x = center_x + (i - 2) * (size // 8)
        if i % 2 == 0:
            y = center_y - size // 8
        else:
            y = center_y + size // 8
        points.append((x, y))
    
    # 绘制蛇身（圆形点）
    point_radius = size // 10
    for x, y in points:
        draw.ellipse([x - point_radius, y - point_radius, x + point_radius, y + point_radius], fill=snake_color)

def draw_simple_snake(draw, size, color):
    """绘制简化版本的蛇"""
    center_x, center_y = size // 2, size // 2
    
    # 简单的蛇形（几个圆形）
    radius = size // 8
    for i in range(3):
        offset = (i - 1) * radius
        draw.ellipse([
            center_x - radius + offset, 
            center_y - radius,
            center_x + radius + offset, 
            center_y + radius
        ], fill=color)

def draw_simple_apple(draw, size, color):
    """绘制简化版本的苹果"""
    center_x, center_y = size // 2, size // 2
    
    # 简单的苹果（圆形）
    radius = size // 6
    draw.ellipse([
        center_x - radius + size//4, 
        center_y - radius + size//4,
        center_x + radius + size//4, 
        center_y + radius + size//4
    ], fill=color)

if __name__ == "__main__":
    try:
        create_snake_icon()
        print("贪吃蛇游戏图标创建成功！")
    except ImportError:
        print("需要安装PIL库: pip install Pillow")
    except Exception as e:
        print(f"创建图标时出错: {e}")