import { Language } from './types';

// JavaScript默认代码模板
export const JS_DEFAULT_CODE_TEMPLATE = `
async function main({ params }) {
    // 构建输出对象
    const ret = {
        "input_value": params.input, // 使用传入的input参数
        "message": params.message,   // 使用传入的message参数
        "number_doubled": params.number * 2, // 将number参数翻倍
        "key1": ["hello", "world"], // 输出一个数组
        "key2": { // 输出一个Object
            "key21": "hi"
        },
        "all_params": params
    };

    return ret;
}`;

// TypeScript示例代码模板
export const TS_EXAMPLE_CODE_TEMPLATE = `

async function main({ params }) {
    const ret: TestResult = {
        "input_value": params.input,
        "message": params.message,
        "number_doubled": params.number * 2,
        "key1": ["hello", "world"],
        "key2": { "key21": "hi" },
        "all_params": params
    };

    return ret;
}`;

// Python默认代码模板
export const PYTHON_DEFAULT_CODE_TEMPLATE = `
import json

def main(params):
    """
    Python代码测试环境
    params: 输入参数字典
    返回: 字典对象
    """
    ret = {
        "input_value": params.get("input", ""),
        "message": params.get("message", ""),
        "number_doubled": params.get("number", 0) * 2,
        "key1": ["hello", "world"],
        "key2": {
            "key21": "hi"
        },
        "all_params": params
    }

    return ret

# 执行main函数
result = main(params)
result
`;

/**
 * 根据语言获取对应的默认代码模板
 * 归并原 handleReset / handleLoadExample / 语言切换useEffect 中的重复 switch
 */
export function getDefaultCodeTemplate(language: Language): string {
  switch (language) {
    case 'javascript':
      return JS_DEFAULT_CODE_TEMPLATE;
    case 'typescript':
      return TS_EXAMPLE_CODE_TEMPLATE;
    case 'python':
      return PYTHON_DEFAULT_CODE_TEMPLATE;
    default:
      return JS_DEFAULT_CODE_TEMPLATE;
  }
}

/**
 * 检测当前代码是否为某个默认模板
 * 提取自原语言切换 useEffect 中的默认代码检测逻辑
 */
export function isDefaultCode(code: string): boolean {
  const currentCode = code.trim();

  // 更精确的默认代码检测：检查是否完全匹配某个模板的关键部分
  const isJsTemplate = currentCode.includes('// 构建输出对象') &&
                       currentCode.includes('"input_value": params.input');
  const isTsTemplate = currentCode.includes('const ret: TestResult = {') &&
                       currentCode.includes('"input_value": params.input');
  const isPyTemplate = currentCode.includes('"""') &&
                       currentCode.includes('Python代码测试环境') &&
                       currentCode.includes('def main(params)');

  return isJsTemplate || isTsTemplate || isPyTemplate;
}
