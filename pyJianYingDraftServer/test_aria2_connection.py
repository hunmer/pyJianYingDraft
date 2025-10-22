"""测试aria2 RPC连接"""
import aria2p

# 创建客户端(不使用secret)
# 注意: aria2p的host参数应该只包含协议和地址端口,不包含/jsonrpc路径
client = aria2p.Client(
    host="http://localhost",
    port=6800,
    secret=""  # 空字符串表示不使用secret
)

# 创建API实例
api = aria2p.API(client)

# 测试连接
try:
    version = client.get_version()
    print("[OK] RPC连接成功!")
    print(f"  Aria2 版本: {version['version']}")
    print(f"  已启用的功能: {', '.join(version.get('enabledFeatures', []))}")

    # 获取全局状态
    stats = api.get_stats()
    print(f"\n全局状态:")
    print(f"  下载速度: {stats.download_speed} B/s")
    print(f"  上传速度: {stats.upload_speed} B/s")
    print(f"  活动任务: {stats.num_active}")
    print(f"  等待任务: {stats.num_waiting}")
    print(f"  已停止: {stats.num_stopped}")

except Exception as e:
    print(f"[FAIL] RPC连接失败: {e}")
    import traceback
    traceback.print_exc()
