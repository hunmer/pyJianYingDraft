// 支持的代码语言类型
export type Language = 'javascript' | 'typescript' | 'python';

export interface CodeTestEditorProps {
  /** 初始代码内容 */
  initialCode?: string;
  /** 代码执行回调 */
  onExecute?: (code: string, params?: any) => Promise<any>;
  /** 测试数据ID，用于localStorage存储 */
  testDataId: string;
  /** 获取JSON编辑器数据的回调 */
  getJsonData?: () => any;
  /** 发送测试数据回调 */
  onSendTest?: (data: any) => void;
}
