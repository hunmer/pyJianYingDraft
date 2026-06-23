// 全局tooltip管理器 - 确保同时只显示一个tooltip
export class TooltipManager {
  private static instance: TooltipManager;
  private currentTooltipId: string | null = null;
  private hideTimeout: NodeJS.Timeout | null = null;

  static getInstance(): TooltipManager {
    if (!TooltipManager.instance) {
      TooltipManager.instance = new TooltipManager();
    }
    return TooltipManager.instance;
  }

  // 注册新的tooltip
  registerTooltip(id: string) {
    // 如果已有tooltip显示，先关闭它
    if (this.currentTooltipId && this.currentTooltipId !== id) {
      this.clearTimeout();
      // 通知前一个tooltip关闭
      this.notifyTooltipHide(this.currentTooltipId);
    }
    this.currentTooltipId = id;
    this.clearTimeout();
  }

  // 设置隐藏超时
  setHideTimeout(id: string, callback: () => void, delay: number) {
    // 只有当前活跃的tooltip才能设置超时
    if (this.currentTooltipId === id) {
      this.clearTimeout();
      this.hideTimeout = setTimeout(() => {
        if (this.currentTooltipId === id) {
          this.currentTooltipId = null;
          callback();
        }
      }, delay);
    }
  }

  // 取消隐藏超时
  clearTimeout() {
    if (this.hideTimeout) {
      clearTimeout(this.hideTimeout);
      this.hideTimeout = null;
    }
  }

  // 主动关闭tooltip
  closeTooltip(id: string) {
    if (this.currentTooltipId === id) {
      this.clearTimeout();
      this.currentTooltipId = null;
    }
  }

  // 通知特定tooltip关闭（用于被新tooltip替换时）
  private notifyTooltipHide(id: string) {
    // 这里可以通过事件或回调机制通知对应的组件
    // 为简化实现，我们将在组件内部检查id是否匹配
  }

  // 检查是否是当前活跃的tooltip
  isActive(id: string): boolean {
    return this.currentTooltipId === id;
  }
}
