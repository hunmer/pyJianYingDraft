"""重新生成aria2配置文件"""
from app.services.aria2_manager import get_aria2_manager

# 获取管理器实例
manager = get_aria2_manager()

# 重新生成配置文件
print(f"生成配置文件: {manager.config_path}")
print(f"RPC Secret: {manager.rpc_secret}")
print(f"RPC Port: {manager.rpc_port}")
print(f"下载目录: {manager.download_dir}")

manager.generate_config()

print("\n配置文件已生成!")
print(f"可以使用以下命令启动aria2:")
print(f'  {manager.aria2c_path} --conf-path={manager.config_path}')
