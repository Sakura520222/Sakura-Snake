@echo off
chcp 65001 >nul
echo.
echo ================================================
echo            Sakura-tcs 贪吃蛇游戏一键打包工具
echo ================================================
echo.

REM 设置颜色
color 0A

REM 检查Python是否安装
echo [1/5] 检查Python环境...
python --version >nul 2>&1
if errorlevel 1 (
    echo   错误: 未找到Python！
    echo   请先安装Python 3.6+ 版本
    echo   下载地址: https://www.python.org/downloads/
    echo.
    pause
    exit /b 1
)

echo    Python版本: 
python --version
echo.

REM 检查必要文件
echo [2/5] 检查游戏文件...
set "missing_files="

if not exist "index.html" (
    set "missing_files=index.html"
)

if not exist "styles.css" (
    if defined missing_files (
        set "missing_files=%missing_files%, styles.css"
    ) else (
        set "missing_files=styles.css"
    )
)

if not exist "game.js" (
    if defined missing_files (
        set "missing_files=%missing_files%, game.js"
    ) else (
        set "missing_files=game.js"
    )
)

if not exist "main.py" (
    if defined missing_files (
        set "missing_files=%missing_files%, main.py"
    ) else (
        set "missing_files=main.py"
    )
)

if defined missing_files (
    echo   错误: 缺少必要的文件: %missing_files%
    echo   请确保所有游戏文件都在当前目录中
    echo.
    pause
    exit /b 1
)

echo   所有游戏文件都存在 ✓
echo.

REM 安装依赖包
echo [3/5] 安装必要的Python包...
echo   正在安装pywebview...
pip install pywebview >nul 2>&1
if errorlevel 1 (
    echo   安装pywebview失败，尝试使用国内镜像...
    pip install -i https://pypi.tuna.tsinghua.edu.cn/simple pywebview >nul 2>&1
    if errorlevel 1 (
        echo   错误: 安装pywebview失败！
        echo   请检查网络连接或手动运行: pip install pywebview
        echo.
        pause
        exit /b 1
    )
)

echo   正在安装pyinstaller...
pip install pyinstaller >nul 2>&1
if errorlevel 1 (
    echo   安装pyinstaller失败，尝试使用国内镜像...
    pip install -i https://pypi.tuna.tsinghua.edu.cn/simple pyinstaller >nul 2>&1
    if errorlevel 1 (
        echo   错误: 安装pyinstaller失败！
        echo   请检查网络连接或手动运行: pip install pyinstaller
        echo.
        pause
        exit /b 1
    )
)

echo   正在安装Pillow（用于图标生成）...
pip install Pillow >nul 2>&1
if errorlevel 1 (
    echo   安装Pillow失败，尝试使用国内镜像...
    pip install -i https://pypi.tuna.tsinghua.edu.cn/simple Pillow >nul 2>&1
    if errorlevel 1 (
        echo   警告: 安装Pillow失败，将使用默认图标
        set "skip_icon=1"
    )
)

echo   所有依赖包安装完成 ✓
echo.

REM 生成图标
echo [4/5] 生成游戏图标...
if not defined skip_icon (
    python create_icon.py >nul 2>&1
    if errorlevel 1 (
        echo   图标生成失败，使用默认图标
        set "icon_option="
    ) else (
        if exist "game_icon.ico" (
            echo   游戏图标生成成功 ✓
            set "icon_option=--icon game_icon.ico"
        ) else (
            echo   图标文件未生成，使用默认图标
            set "icon_option="
        )
    )
) else (
    echo   跳过图标生成（Pillow安装失败）
    set "icon_option="
)

echo.

REM 打包为EXE
echo [5/5] 打包为EXE文件...
echo   正在打包，这可能需要几分钟...

python -m PyInstaller --onefile --windowed --name "Sakura-tcs-game" %icon_option% --add-data "index.html;." --add-data "styles.css;." --add-data "game.js;." main.py >nul 2>&1

if errorlevel 1 (
    echo   打包失败！错误信息：
    echo   请检查以上错误信息并重试
    echo.
    pause
    exit /b 1
)

echo.
echo ================================================
echo           打包成功完成！ 🎉
echo ================================================
echo.
echo 📁 EXE文件位置: dist\\Sakura-tcs-game.exe
echo.
echo 📋 文件信息：
echo   - 文件大小: 
for /f "tokens=3" %%a in ('dir "dist\Sakura-tcs-game.exe" ^| find "Sakura-tcs-game.exe"') do echo     %%a
echo   - 包含内容: 游戏主程序 + 所有资源文件
echo   - 图标状态: %icon_option:--icon game_icon.ico=自定义图标%
if "%icon_option%"=="" echo     （默认图标）
echo.
echo 🚀 使用方法：
echo   1. 双击 dist\\Sakura-tcs-game.exe 即可运行游戏
echo   2. 无需安装Python或其他依赖
echo   3. 可在任何Windows电脑上运行
echo.
echo 💡 提示：
echo   - 您可以将EXE文件复制到任何位置使用
echo   - 游戏资源已内嵌，无需额外文件
echo   - 支持窗口模式，无控制台显示
echo.

REM 显示文件大小
for /f "tokens=3" %%a in ('dir "dist\Sakura-tcs-game.exe" ^| find "Sakura-tcs-game.exe"') do (
    set "filesize=%%a"
)
echo   最终文件大小: %filesize%

pause