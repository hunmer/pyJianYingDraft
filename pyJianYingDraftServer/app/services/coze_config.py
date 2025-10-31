"""
Coze API 配置管理模块
用于管理 Coze API 的认证和基础配置
"""

import os
import json
from typing import Optional, Dict, Any
from pydantic import BaseModel, Field
from cozepy import COZE_CN_BASE_URL, COZE_COM_BASE_URL


class CozeApiConfig(BaseModel):
    """Coze API 配置"""
    api_token: str = Field(description="API 访问令牌（Personal Access Token）")
    base_url: str = Field(default=COZE_CN_BASE_URL, description="API 基础 URL")
    timeout: int = Field(default=600, description="请求超时时间（秒）")
    max_retries: int = Field(default=3, description="最大重试次数")


class CozeConfigManager:
    """Coze 配置管理器"""

    def __init__(self, config_file: str = "config.json"):
        """
        初始化配置管理器

        Args:
            config_file: 配置文件路径
        """
        self.config_file = config_file
        self._config: Optional[Dict[str, Any]] = None
        self._coze_configs: Dict[str, CozeApiConfig] = {}

    def load_config(self) -> Dict[str, Any]:
        """加载配置文件"""
        if self._config is None:
            try:
                with open(self.config_file, 'r', encoding='utf-8') as f:
                    self._config = json.load(f)
            except FileNotFoundError:
                print(f"⚠️ 配置文件 {self.config_file} 不存在，使用默认配置")
                self._config = {}
            except json.JSONDecodeError as e:
                print(f"⚠️ 配置文件解析失败: {e}，使用默认配置")
                self._config = {}

        return self._config

    def get_coze_config(self, account_id: str = "default") -> Optional[CozeApiConfig]:
        """
        获取 Coze API 配置

        Args:
            account_id: 账号 ID，默认为 "default"

        Returns:
            CozeApiConfig 或 None
        """
        # 如果已缓存，直接返回
        if account_id in self._coze_configs:
            return self._coze_configs[account_id]

        # 加载配置文件
        config = self.load_config()

        # 获取 Coze 配置段
        coze_section = config.get("COZE_API", {})

        # 如果是默认账号，尝试从环境变量或配置文件读取
        if account_id == "default":
            api_token = os.getenv("COZE_API_TOKEN") or coze_section.get("api_token")
            base_url = os.getenv("COZE_API_BASE") or coze_section.get("base_url", COZE_CN_BASE_URL)

            if not api_token:
                print("⚠️ 未配置 Coze API Token（环境变量 COZE_API_TOKEN 或 config.json 中的 COZE_API.api_token）")
                return None

            try:
                coze_config = CozeApiConfig(
                    api_token=api_token,
                    base_url=base_url,
                    timeout=coze_section.get("timeout", 600),
                    max_retries=coze_section.get("max_retries", 3)
                )
                self._coze_configs[account_id] = coze_config
                return coze_config
            except Exception as e:
                print(f"⚠️ Coze API 配置加载失败: {e}")
                return None

        # 多账号配置（从 accounts 中读取）
        accounts = coze_section.get("accounts", {})
        account_config = accounts.get(account_id)

        if not account_config:
            print(f"⚠️ 未找到账号 {account_id} 的 Coze API 配置")
            return None

        try:
            coze_config = CozeApiConfig(
                api_token=account_config["api_token"],
                base_url=account_config.get("base_url", COZE_CN_BASE_URL),
                timeout=account_config.get("timeout", 600),
                max_retries=account_config.get("max_retries", 3)
            )
            self._coze_configs[account_id] = coze_config
            return coze_config
        except Exception as e:
            print(f"⚠️ 账号 {account_id} 的 Coze API 配置加载失败: {e}")
            return None

    def set_coze_config(self, config: CozeApiConfig, account_id: str = "default"):
        """
        设置 Coze API 配置

        Args:
            config: Coze API 配置
            account_id: 账号 ID
        """
        self._coze_configs[account_id] = config

    def save_coze_config(self, account_id: str = "default"):
        """
        保存 Coze API 配置到文件

        Args:
            account_id: 账号 ID
        """
        if account_id not in self._coze_configs:
            print(f"⚠️ 账号 {account_id} 的配置未加载，无法保存")
            return

        config = self.load_config()

        # 确保 COZE_API 段存在
        if "COZE_API" not in config:
            config["COZE_API"] = {}

        coze_config = self._coze_configs[account_id]

        if account_id == "default":
            # 默认账号直接保存到 COZE_API 下
            config["COZE_API"]["api_token"] = coze_config.api_token
            config["COZE_API"]["base_url"] = coze_config.base_url
            config["COZE_API"]["timeout"] = coze_config.timeout
            config["COZE_API"]["max_retries"] = coze_config.max_retries
        else:
            # 多账号保存到 accounts 下
            if "accounts" not in config["COZE_API"]:
                config["COZE_API"]["accounts"] = {}

            config["COZE_API"]["accounts"][account_id] = {
                "api_token": coze_config.api_token,
                "base_url": coze_config.base_url,
                "timeout": coze_config.timeout,
                "max_retries": coze_config.max_retries
            }

        # 写回文件
        try:
            with open(self.config_file, 'w', encoding='utf-8') as f:
                json.dump(config, f, indent=2, ensure_ascii=False)
            print(f"✅ Coze API 配置已保存到 {self.config_file}")
        except Exception as e:
            print(f"⚠️ 保存配置文件失败: {e}")


# 全局配置管理器实例
_config_manager: Optional[CozeConfigManager] = None


def get_config_manager() -> CozeConfigManager:
    """获取全局配置管理器实例"""
    global _config_manager
    if _config_manager is None:
        _config_manager = CozeConfigManager()
    return _config_manager
