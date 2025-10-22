"""
后端服务打包脚本
使用 PyInstaller 将 FastAPI 服务打包为单个可执行文件
"""

import os
import sys
import subprocess
from pathlib import Path
import shutil

def check_pyinstaller():
    """检查 PyInstaller 是否安装"""
    try:
        import PyInstaller
        print(f"✓ PyInstaller 已安装 (版本: {PyInstaller.__version__})")
        return True
    except ImportError:
        print("✗ PyInstaller 未安装")
        print("正在安装 PyInstaller...")
        try:
            subprocess.check_call([sys.executable, "-m", "pip", "install", "pyinstaller"])
            print("✓ PyInstaller 安装成功")
            return True
        except subprocess.CalledProcessError:
            print("✗ PyInstaller 安装失败")
            return False

def clean_build():
    """清理之前的构建文件"""
    dirs_to_clean = ['build', 'dist']
    for dir_name in dirs_to_clean:
        dir_path = Path(dir_name)
        if dir_path.exists():
            print(f"清理目录: {dir_path}")
            shutil.rmtree(dir_path)

    # 清理 .spec 生成的临时文件
    for file_pattern in ['*.pyc', '__pycache__']:
        for file_path in Path('.').rglob(file_pattern):
            try:
                if file_path.is_file():
                    file_path.unlink()
                elif file_path.is_dir():
                    shutil.rmtree(file_path)
            except Exception as e:
                print(f"警告: 无法删除 {file_path}: {e}")

def build_executable():
    """构建可执行文件"""
    spec_file = Path("server.spec")

    if not spec_file.exists():
        print(f"✗ 找不到 {spec_file}")
        print("请确保 server.spec 文件存在")
        return False

    print(f"\n开始构建可执行文件...")
    print(f"使用配置文件: {spec_file}")

    try:
        # 使用 PyInstaller 构建
        cmd = [sys.executable, "-m", "PyInstaller", str(spec_file), "--clean"]
        print(f"执行命令: {' '.join(cmd)}")

        result = subprocess.run(cmd, check=True, capture_output=True, text=True)

        print("\n" + "="*50)
        print("构建成功!")
        print("="*50)

        # 检查输出文件
        exe_path = Path("dist") / "pyJianYingDraftServer.exe"
        if exe_path.exists():
            size_mb = exe_path.stat().st_size / (1024 * 1024)
            print(f"\n可执行文件位置: {exe_path.absolute()}")
            print(f"文件大小: {size_mb:.2f} MB")

            # 复制到项目根目录方便 Electron 使用
            dest_path = Path("../pyjianyingdraft-web/resources/pyJianYingDraftServer.exe")
            dest_path.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(exe_path, dest_path)
            print(f"\n已复制到 Electron 资源目录: {dest_path.absolute()}")

            return True
        else:
            print(f"✗ 找不到生成的可执行文件: {exe_path}")
            return False

    except subprocess.CalledProcessError as e:
        print("\n" + "="*50)
        print("构建失败!")
        print("="*50)
        print(f"\n错误信息:\n{e.stderr}")
        return False

def main():
    """主函数"""
    print("="*50)
    print("pyJianYingDraft 后端服务打包工具")
    print("="*50)

    # 切换到脚本所在目录
    script_dir = Path(__file__).parent
    os.chdir(script_dir)
    print(f"\n工作目录: {script_dir.absolute()}")

    # 检查依赖
    if not check_pyinstaller():
        print("\n✗ 缺少必要依赖,构建中止")
        return 1

    # 清理旧文件
    print("\n正在清理旧的构建文件...")
    clean_build()

    # 构建可执行文件
    if build_executable():
        print("\n" + "="*50)
        print("所有步骤完成!")
        print("="*50)
        print("\n提示:")
        print("1. 可执行文件已生成到 dist/ 目录")
        print("2. 已自动复制到 Electron 资源目录")
        print("3. 运行 dist/pyJianYingDraftServer.exe 启动服务")
        print("4. 服务将在 http://0.0.0.0:8000 启动")
        return 0
    else:
        print("\n✗ 构建过程中出现错误")
        return 1

if __name__ == "__main__":
    sys.exit(main())
