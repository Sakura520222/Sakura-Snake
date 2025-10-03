#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Sakura-tcs 贪吃蛇游戏一键打包脚本
自动完成依赖安装、图标生成、EXE打包全过程
"""

import os
import sys
import subprocess
import time
from pathlib import Path

def print_step(step_num, total_steps, message):
    """打印步骤信息"""
    print(f"\n[{step_num}/{total_steps}] {message}")
    print("-" * 50)

def check_python():
    """检查Python环境"""
    print_step(1, 5, "检查Python环境")
    
    try:
        result = subprocess.run([sys.executable, "--version"], 
                              capture_output=True, text=True, check=True)
        version = result.stdout.strip()
        print(f"✓ {version}")
        return True
    except subprocess.CalledProcessError:
        print("✗ 未找到Python或版本检查失败")
        print("请先安装Python 3.6+ 版本")
        print("下载地址: https://www.python.org/downloads/")
        return False

def check_required_files():
    """检查必要的游戏文件"""
    print_step(2, 5, "检查游戏文件")
    
    required_files = ["index.html", "styles.css", "game.js", "main.py"]
    missing_files = []
    
    for file in required_files:
        if os.path.exists(file):
            print(f"✓ {file}")
        else:
            print(f"✗ {file}")
            missing_files.append(file)
    
    if missing_files:
        print(f"\n错误: 缺少必要的文件: {', '.join(missing_files)}")
        print("请确保所有游戏文件都在当前目录中")
        return False
    
    print("✓ 所有游戏文件都存在")
    return True

def install_dependencies():
    """安装必要的Python包"""
    print_step(3, 5, "安装依赖包")
    
    dependencies = ["pywebview", "pyinstaller", "Pillow"]
    
    for package in dependencies:
        print(f"正在检查 {package}...")
        
        # 使用pip show检查是否已安装
        result = subprocess.run([sys.executable, "-m", "pip", "show", package], 
                              capture_output=True, text=True)
        if result.returncode == 0:
            print(f"✓ {package} 已安装")
            continue
            
        print(f"正在安装 {package}...")
        
        # 尝试使用国内镜像
        mirrors = [
            "",  # 默认源
            "-i https://pypi.tuna.tsinghua.edu.cn/simple",
            "-i https://pypi.douban.com/simple",
            "-i https://mirrors.aliyun.com/pypi/simple/"
        ]
        
        installed = False
        for mirror in mirrors:
            try:
                cmd = f"{sys.executable} -m pip install {mirror} {package}".strip()
                subprocess.run(cmd, shell=True, check=True, capture_output=True)
                print(f"✓ {package} 安装成功")
                installed = True
                break
            except subprocess.CalledProcessError:
                continue
        
        if not installed:
            if package == "Pillow":
                print(f"⚠ {package} 安装失败，将跳过图标生成")
                global skip_icon_generation
                skip_icon_generation = True
            else:
                print(f"✗ {package} 安装失败")
                return False
    
    print("✓ 所有依赖包检查/安装完成")
    return True

def generate_icon():
    """生成游戏图标"""
    print_step(4, 5, "生成游戏图标")
    
    if skip_icon_generation:
        print("⚠ 跳过图标生成（Pillow安装失败）")
        return None
    
    try:
        # 运行图标生成脚本
        result = subprocess.run([sys.executable, "create_icon.py"], 
                              capture_output=True, text=True, check=True)
        
        if os.path.exists("game_icon.ico"):
            print("✓ 游戏图标生成成功")
            return "--icon game_icon.ico"
        else:
            print("⚠ 图标文件未生成")
            return None
    except (subprocess.CalledProcessError, FileNotFoundError):
        print("⚠ 图标生成失败")
        return None

def build_exe(icon_option):
    """打包为EXE文件"""
    print_step(5, 5, "打包为EXE文件")
    
    print("正在打包，这可能需要几分钟...")
    
    # 构建PyInstaller命令
    cmd = [
        sys.executable, "-m", "PyInstaller",
        "--onefile",
        "--windowed",
        "--name", "Sakura-tcs-game",
        "--add-data", "index.html;.",
        "--add-data", "styles.css;.",
        "--add-data", "game.js;.",
        "main.py"
    ]
    
    if icon_option:
        cmd.extend(["--icon", "game_icon.ico"])
    
    try:
        subprocess.run(cmd, check=True)
        print("✓ 打包成功完成！")
        return True
    except subprocess.CalledProcessError as e:
        print(f"✗ 打包失败: {e}")
        return False

def show_final_info():
    """显示最终信息"""
    exe_path = Path("dist") / "Sakura-tcs-game.exe"
    
    if exe_path.exists():
        file_size = exe_path.stat().st_size
        size_mb = file_size / (1024 * 1024)
        
        print("\n" + "="*60)
        print("           打包成功完成！ 🎉")
        print("="*60)
        print(f"\n📁 EXE文件位置: {exe_path}")
        print(f"📋 文件大小: {size_mb:.1f} MB")
        print("📦 包含内容: 游戏主程序 + 所有资源文件")
        
        if not skip_icon_generation and os.path.exists("game_icon.ico"):
            print("🎨 图标状态: 自定义贪吃蛇图标")
        else:
            print("🎨 图标状态: 默认图标")
        
        print("""
🚀 使用方法：
  1. 双击 dist\\Sakura-tcs-game.exe 即可运行游戏
  2. 无需安装Python或其他依赖
  3. 可在任何Windows电脑上运行

💡 提示：
  - 您可以将EXE文件复制到任何位置使用
  - 游戏资源已内嵌，无需额外文件
  - 支持窗口模式，无控制台显示
""")
    else:
        print("\n❌ 打包失败，请检查错误信息")

def main():
    """主函数"""
    print("="*60)
    print("      Sakura-tcs 贪吃蛇游戏一键打包工具")
    print("="*60)
    
    global skip_icon_generation
    skip_icon_generation = False
    
    # 执行打包步骤
    steps = [
        check_python,
        check_required_files,
        install_dependencies,
        lambda: generate_icon(),
        lambda icon_opt=None: build_exe(icon_opt)
    ]
    
    # 执行前4步
    for i, step in enumerate(steps[:4], 1):
        if not step():
            if i == 4:  # 图标生成步骤
                continue  # 图标生成失败不影响后续打包
            else:
                print("\n❌ 打包过程失败，请解决上述问题后重试")
                input("按回车键退出...")
                return
    
    # 获取图标选项
    icon_option = None
    if not skip_icon_generation and os.path.exists("game_icon.ico"):
        icon_option = "game_icon.ico"
    
    # 执行最后一步
    if steps[4](icon_option):
        show_final_info()
    else:
        print("\n❌ 打包失败，请检查错误信息")
    
    input("\n按回车键退出...")

if __name__ == "__main__":
    main()