import webview
import os
import sys

class WebViewApp:
    def __init__(self):
        self.html_content = None
        self.css_content = None
        self.js_content = None
        
        # 尝试从内嵌资源加载文件内容
        self.load_embedded_resources()
    
    def load_embedded_resources(self):
        """加载内嵌的游戏资源文件"""
        try:
            # 如果是打包后的EXE文件，从临时目录加载资源
            if getattr(sys, 'frozen', False):
                # 打包后的EXE运行模式
                base_path = sys._MEIPASS
            else:
                # 开发模式，从当前目录加载
                base_path = os.path.dirname(os.path.abspath(__file__))
            
            # 读取HTML文件
            html_path = os.path.join(base_path, 'index.html')
            with open(html_path, 'r', encoding='utf-8') as f:
                self.html_content = f.read()
            
            # 读取CSS文件
            css_path = os.path.join(base_path, 'styles.css')
            with open(css_path, 'r', encoding='utf-8') as f:
                self.css_content = f.read()
            
            # 读取JS文件
            js_path = os.path.join(base_path, 'game.js')
            with open(js_path, 'r', encoding='utf-8') as f:
                self.js_content = f.read()
                
        except Exception as e:
            print(f"加载资源文件失败: {e}")
            raise
    
    def create_window(self):
        """创建webview窗口"""
        # 创建完整的HTML内容，包含内嵌的CSS和JS
        full_html = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <title>Sakura-tcs 游戏</title>
            <style>
                {self.css_content}
            </style>
        </head>
        <body>
            {self.html_content}
            <script>
                {self.js_content}
            </script>
        </body>
        </html>
        """
        
        # 创建窗口并加载HTML内容
        window = webview.create_window(
            'Sakura-贪吃蛇',  # 窗口标题
            html=full_html,     # 直接加载HTML内容
            width=800,          # 窗口宽度
            height=600,         # 窗口高度
            resizable=True,     # 允许调整大小
            text_select=False   # 禁止文本选择（游戏体验更好）
        )
        
        return window

def main():
    """主函数"""
    try:
        app = WebViewApp()
        window = app.create_window()
        
        # 启动webview
        webview.start()
        
    except Exception as e:
        print(f"启动应用时出错: {e}")
        input("按回车键退出...")

if __name__ == "__main__":
    main()