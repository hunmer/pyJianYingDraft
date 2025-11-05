'use client';

import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  Button,
  Alert,
  IconButton,
  Tooltip,
  Divider,
  Tabs,
  Tab,
  Radio,
  RadioGroup,
  FormControlLabel,
  FormControl,
  FormLabel,
} from '@mui/material';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import RefreshIcon from '@mui/icons-material/Refresh';
import CodeIcon from '@mui/icons-material/Code';
import SendIcon from '@mui/icons-material/Send';
import CodeMirrorEditor from '@/components/CodeMirrorEditor';
import { useSnapshots } from '@/hooks/useSnapshots';
import { useDebounce } from '@/hooks/useDebounce';
import SnapshotManager from './SnapshotManager';

// JavaScript默认代码模板
const JS_DEFAULT_CODE_TEMPLATE = `
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
const TS_EXAMPLE_CODE_TEMPLATE = `

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
const PYTHON_DEFAULT_CODE_TEMPLATE = `
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

interface CodeTestEditorProps {
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

/**
 * 代码测试编辑器组件
 */
export default function CodeTestEditor({
  initialCode = JS_DEFAULT_CODE_TEMPLATE,
  onExecute,
  testDataId,
  getJsonData,
  onSendTest,
}: CodeTestEditorProps) {
  const [code, setCode] = useState(() => {
    // 尝试从localStorage恢复上次编辑的快照
    const snapshotKey = `code-test-last-snapshot-${testDataId}`;
    const stored = localStorage.getItem(snapshotKey);
    return stored || initialCode;
  });
  const [jsonData, setJsonData] = useState(() => {
    // 尝试从localStorage恢复上次编辑的JSON快照
    const snapshotKey = `code-test-json-last-snapshot-${testDataId}`;
    const stored = localStorage.getItem(snapshotKey);
    return stored || '{}';
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [executing, setExecuting] = useState(false);
  const [executionResult, setExecutionResult] = useState<any>(null);
  const [rightTabValue, setRightTabValue] = useState(0); // 右侧tab状态：0=输入数据，1=输出数据
  const [language, setLanguage] = useState<'javascript' | 'typescript' | 'python'>('typescript'); // 当前语言选择
  const [tsLoaded, setTsLoaded] = useState(false); // TypeScript编译器是否已加载
  const [pyodideLoaded, setPyodideLoaded] = useState(false); // Pyodide是否已加载
  const [pyodide, setPyodide] = useState<any>(null); // Pyodide实例
  const codeEditorRef = useRef<any>(null);
  const jsonEditorRef = useRef<any>(null);
  const previousLanguageRef = useRef(language); // 追踪上次的语言选择

  // 使用节流（1秒延迟）来保存编辑内容到"上次编辑快照"
  const debouncedCode = useDebounce(code, 1000);
  const debouncedJsonData = useDebounce(jsonData, 1000);

  // 快照管理 - 代码快照
  const {
    snapshots: codeSnapshots,
    createSnapshot: createCodeSnapshot,
    restoreSnapshot: restoreCodeSnapshot,
    deleteSnapshot: deleteCodeSnapshot,
    renameSnapshot: renameCodeSnapshot,
  } = useSnapshots({
    storageKey: `code-test-code-${testDataId}`,
    maxSnapshots: 20,
    autoSaveCurrent: false,
  });

  // 快照管理 - JSON数据快照
  const {
    snapshots: jsonSnapshots,
    createSnapshot: createJsonSnapshot,
    restoreSnapshot: restoreJsonSnapshot,
    deleteSnapshot: deleteJsonSnapshot,
    renameSnapshot: renameJsonSnapshot,
  } = useSnapshots({
    storageKey: `code-test-json-${testDataId}`,
    maxSnapshots: 20,
    autoSaveCurrent: false,
  });

  // 当testDataId变化时，恢复对应的代码和JSON数据（从上次编辑快照恢复）
  useEffect(() => {
    const codeSnapshotKey = `code-test-last-snapshot-${testDataId}`;
    const jsonSnapshotKey = `code-test-json-last-snapshot-${testDataId}`;

    const storedCode = localStorage.getItem(codeSnapshotKey);
    const storedJson = localStorage.getItem(jsonSnapshotKey);
    const newCode = storedCode || initialCode;
    const newJsonData = storedJson || '{}';

    setCode(newCode);
    setJsonData(newJsonData);
    setError('');
    setSuccess('');
    setExecutionResult(null);
    console.log('[CodeTestEditor] 从上次编辑快照恢复数据:', {
      testDataId,
      hasStoredCode: !!storedCode,
      hasStoredJson: !!storedJson,
      codeLength: newCode.length,
      jsonLength: newJsonData.length
    });
  }, [testDataId, initialCode]);

  // 节流保存代码到localStorage（上次编辑快照）
  useEffect(() => {
    if (debouncedCode) {
      const snapshotKey = `code-test-last-snapshot-${testDataId}`;
      localStorage.setItem(snapshotKey, debouncedCode);
      console.log('[CodeTestEditor] 代码快照已保存 (节流)');
    }
  }, [debouncedCode, testDataId]);

  // 节流保存JSON数据到localStorage（上次编辑快照）
  useEffect(() => {
    if (debouncedJsonData) {
      const snapshotKey = `code-test-json-last-snapshot-${testDataId}`;
      localStorage.setItem(snapshotKey, debouncedJsonData);
      console.log('[CodeTestEditor] JSON快照已保存 (节流)');
    }
  }, [debouncedJsonData, testDataId]);

  // 动态加载TypeScript编译器
  useEffect(() => {
    const loadTypeScript = async () => {
      if (language === 'typescript' && !tsLoaded && (window as any).ts === undefined) {
        try {
          console.log('[CodeTestEditor] 开始加载TypeScript编译器...');
          const script = document.createElement('script');
          script.src = '/js/typescript.js';
          script.async = true;

          script.onload = () => {
            // 等待一小段时间确保编译器完全初始化
            setTimeout(() => {
              if ((window as any).ts) {
                setTsLoaded(true);
                console.log('[CodeTestEditor] TypeScript编译器已加载完成');
              } else {
                setError('TypeScript编译器初始化失败');
              }
            }, 100);
          };

          script.onerror = (error) => {
            console.error('[CodeTestEditor] TypeScript编译器加载失败:', error);
            setError('TypeScript编译器加载失败，请检查网络连接');
          };

          document.head.appendChild(script);
        } catch (err: any) {
          console.error('[CodeTestEditor] TypeScript编译器加载异常:', err);
          setError(`TypeScript编译器加载失败: ${err.message}`);
        }
      } else if (language === 'typescript' && (window as any).ts !== undefined) {
        setTsLoaded(true);
        console.log('[CodeTestEditor] TypeScript编译器已就绪');
      }
    };

    loadTypeScript();
  }, [language, tsLoaded]);

  // 动态加载Pyodide
  useEffect(() => {
    const loadPyodide = async () => {
      if (language === 'python' && !pyodideLoaded && !(window as any).loadPyodide) {
        try {
          console.log('[CodeTestEditor] 开始加载Pyodide...');
          setSuccess('正在加载Python运行环境，请稍候...');

          const script = document.createElement('script');
          script.src = 'https://cdn.jsdelivr.net/pyodide/v0.26.1/full/pyodide.js';
          script.async = true;

          script.onload = async () => {
            try {
              console.log('[CodeTestEditor] Pyodide脚本已加载，正在初始化...');
              const loadPyodide = (window as any).loadPyodide;
              const pyodideInstance = await loadPyodide();
              setPyodide(pyodideInstance);
              setPyodideLoaded(true);
              setSuccess('Python运行环境已就绪');
              console.log('[CodeTestEditor] Pyodide已加载完成');
              setTimeout(() => setSuccess(''), 3000);
            } catch (initErr: any) {
              console.error('[CodeTestEditor] Pyodide初始化失败:', initErr);
              setError(`Python运行环境初始化失败: ${initErr.message}`);
            }
          };

          script.onerror = (error) => {
            console.error('[CodeTestEditor] Pyodide加载失败:', error);
            setError('Python运行环境加载失败，请检查网络连接');
          };

          document.head.appendChild(script);
        } catch (err: any) {
          console.error('[CodeTestEditor] Pyodide加载异常:', err);
          setError(`Python运行环境加载失败: ${err.message}`);
        }
      } else if (language === 'python' && pyodide) {
        setPyodideLoaded(true);
        console.log('[CodeTestEditor] Pyodide已就绪');
      }
    };

    loadPyodide();
  }, [language, pyodideLoaded, pyodide]);

  // 当切换语言时，更新代码模板（仅在语言真正变化时触发）
  useEffect(() => {
    // 只在语言真正变化时才考虑替换模板
    if (previousLanguageRef.current === language) {
      return;
    }

    console.log('[CodeTestEditor] 语言已切换:', {
      from: previousLanguageRef.current,
      to: language
    });

    const currentCode = code.trim();

    // 更精确的默认代码检测：检查是否完全匹配某个模板的关键部分
    const isJsTemplate = currentCode.includes('// 构建输出对象') &&
                         currentCode.includes('"input_value": params.input');
    const isTsTemplate = currentCode.includes('const ret: TestResult = {') &&
                         currentCode.includes('"input_value": params.input');
    const isPyTemplate = currentCode.includes('"""') &&
                         currentCode.includes('Python代码测试环境') &&
                         currentCode.includes('def main(params)');

    const isDefaultCode = isJsTemplate || isTsTemplate || isPyTemplate;

    console.log('[CodeTestEditor] 代码检测结果:', {
      isJsTemplate,
      isTsTemplate,
      isPyTemplate,
      isDefaultCode
    });

    if (isDefaultCode) {
      let newCode = '';
      switch (language) {
        case 'javascript':
          newCode = JS_DEFAULT_CODE_TEMPLATE;
          break;
        case 'typescript':
          newCode = TS_EXAMPLE_CODE_TEMPLATE;
          break;
        case 'python':
          newCode = PYTHON_DEFAULT_CODE_TEMPLATE;
          break;
      }

      if (newCode && newCode !== code) {
        console.log('[CodeTestEditor] 正在加载新的语言模板...');
        setCode(newCode);
        setSuccess(`已切换到 ${language.toUpperCase()} 模式并加载示例代码`);
        setTimeout(() => setSuccess(''), 3000);
      }
    } else {
      console.log('[CodeTestEditor] 检测到用户自定义代码，保留当前代码');
    }

    // 更新上次的语言
    previousLanguageRef.current = language;
  }, [language, code]);

  // 验证编译器状态
  useEffect(() => {
    if (language === 'typescript' && tsLoaded) {
      // 定期检查编译器是否仍然可用
      const checkInterval = setInterval(() => {
        if ((window as any).ts === undefined) {
          console.warn('[CodeTestEditor] TypeScript编译器丢失，重新加载...');
          setTsLoaded(false);
        }
      }, 5000);

      return () => clearInterval(checkInterval);
    }
  }, [language, tsLoaded]);

  // 重置为默认代码和JSON
  const handleReset = () => {
    let defaultCode = '';
    switch (language) {
      case 'javascript':
        defaultCode = JS_DEFAULT_CODE_TEMPLATE;
        break;
      case 'typescript':
        defaultCode = TS_EXAMPLE_CODE_TEMPLATE;
        break;
      case 'python':
        defaultCode = PYTHON_DEFAULT_CODE_TEMPLATE;
        break;
    }
    setCode(defaultCode);
    setJsonData('{}');
    setError('');
    setSuccess('');
    setExecutionResult(null);

    // 清除上次编辑快照
    const codeSnapshotKey = `code-test-last-snapshot-${testDataId}`;
    const jsonSnapshotKey = `code-test-json-last-snapshot-${testDataId}`;
    localStorage.removeItem(codeSnapshotKey);
    localStorage.removeItem(jsonSnapshotKey);

    console.log('[CodeTestEditor] 已重置并清除上次编辑快照');
  };

  // 执行代码
  const handleExecute = async () => {
    setError('');
    setSuccess('');
    setExecutionResult(null);

    try {
      setExecuting(true);

      // 构造params对象：先合并默认参数和JSON编辑器数据，再与testData合并
      let jsonParams = {};
      try {
        const parsedJson = JSON.parse(jsonData);
        jsonParams = parsedJson;
      } catch (jsonErr) {
        console.warn('[CodeTestEditor] JSON解析失败，使用空对象:', jsonErr);
      }

      // 获取testData数据（如果存在）
      let testDataParams = {};
      // if (getJsonData) {
      //   try {
      //     const testData = getJsonData();
      //     if (testData && typeof testData === 'object') {
      //       testDataParams = testData;
      //     }
      //   } catch (testDataErr) {
      //     console.warn('[CodeTestEditor] 获取testData失败:', testDataErr);
      //   }
      // }

      // 合并顺序：默认参数 -> JSON编辑器数据 -> testData数据（testData优先级最高）
      const mergedParams = {
        input: 'test_input',
        message: 'hello world',
        number: 42,
        ...jsonParams,
        ...testDataParams,
      };

      console.log('[CodeTestEditor] 合并后的参数:', mergedParams);

      // Python 执行逻辑
      if (language === 'python') {
        if (!pyodideLoaded || !pyodide) {
          throw new Error('Python运行环境未加载完成，请稍后再试');
        }

        try {
          console.log('[CodeTestEditor] 执行Python代码...');
          // console.log('[CodeTestEditor] 原始代码:', code);

          // 将JavaScript对象转换为Python字典
          // 使用pyodide.toPy来确保正确转换
          const pythonParams = pyodide.toPy(mergedParams);
          pyodide.globals.set('params', pythonParams);

          console.log('[CodeTestEditor] 参数已设置:', mergedParams);

          // 执行Python代码
          const result = await pyodide.runPythonAsync(code);

          console.log('[CodeTestEditor] Python代码执行成功');
          console.log('[CodeTestEditor] 执行结果:', result);

          // 转换结果为JavaScript对象
          let finalResult;
          if (result && typeof result.toJs === 'function') {
            finalResult = result.toJs({ dict_converter: Object.fromEntries });
          } else {
            finalResult = result;
          }

          setExecutionResult(finalResult);
          setSuccess('Python代码执行成功');
          setRightTabValue(1);
        } catch (pyError: any) {
          const errorMsg = `Python执行失败: ${pyError.message}

请检查以下可能的问题：
1. 语法错误（如缩进、括号不匹配等）
2. 确保定义了 def main(params) 函数
3. 确保代码最后返回了结果

提示：查看浏览器控制台获取更详细的错误信息`;
          throw new Error(errorMsg);
        }

        // 早期返回，不执行后续的 JS/TS 逻辑
        setTimeout(() => setSuccess(''), 3000);
        return;
      }

      // 统一的编译逻辑（JavaScript/TypeScript）
      let finalCode = code;

      // 如果使用TypeScript，先编译成JavaScript
      if (language === 'typescript') {
        if (!tsLoaded || (window as any).ts === undefined) {
          throw new Error('TypeScript编译器未加载完成，请稍后再试');
        }

        try {
          console.log('[CodeTestEditor] 编译TypeScript代码...');
          // console.log('[CodeTestEditor] 原始代码:', code);
          const ts = (window as any).ts;

          // 更激进的编译选项，确保async/await被正确转换，完全禁用类型检查
          const compilerOptions = {
            target: ts.ScriptTarget.ES2017, // 降低目标版本以确保async/await兼容性
            module: ts.ModuleKind.None, // 不使用模块系统，直接输出可执行代码
            strict: false,
            esModuleInterop: true,
            skipLibCheck: true,
            noLib: true, // 不引用标准库
            // 优化编译选项
            removeComments: false,
            sourceMap: false,
            allowJs: true,
            noImplicitAny: false,
            strictNullChecks: false,
            strictFunctionTypes: false,
            strictBindCallApply: false,
            strictPropertyInitialization: false,
            noImplicitReturns: false,
            noImplicitThis: false,
            noFallthroughCasesInSwitch: false,
            noUncheckedIndexedAccess: false,
            suppressImplicitAnyIndexErrors: true,
            noEmitOnError: false,
            experimentalDecorators: true,
            emitDecoratorMetadata: true,
            // 确保async/await被正确处理
            async: true,
            // 关键：确保async/await被转换为ES5兼容代码
            downlevelIteration: true,
            // 不进行类型检查，只做编译转换
            noResolve: true,
            isolatedModules: true,
            // 完全禁用所有类型检查
            checkJs: false,
            // 确保编译成功，即使有类型错误
            noEmit: false,
            // 保持原有的变量声明方式
            preserveConstEnums: false,
            // 不强制类型注解
            noImplicitUseStrict: false,
          };

          console.log('[CodeTestEditor] 编译选项:', compilerOptions);

          // 直接编译，忽略所有诊断信息，只转换语法
          const transpileResult = ts.transpileModule(code, {
            compilerOptions: compilerOptions,
            reportDiagnostics: false // 不报告诊断信息，只进行语法转换
          });

          finalCode = transpileResult.outputText;

          console.log('[CodeTestEditor] TypeScript编译成功');
          // console.log('[CodeTestEditor] 编译后代码:', finalCode);
          console.log('[CodeTestEditor] 编译后代码长度:', finalCode.length);

          // 如果编译后的代码为空，说明编译有问题
          if (!finalCode || finalCode.trim() === '') {
            throw new Error('TypeScript编译后代码为空，请检查代码语法');
          }

          // 验证编译后的代码是否包含main函数（支持多种声明方式）
          const hasMainFunction = finalCode.includes('function main') ||
                                 finalCode.includes('const main') ||
                                 finalCode.includes('let main') ||
                                 finalCode.includes('var main');

          if (!hasMainFunction) {
            console.warn('[CodeTestEditor] 警告：编译后的代码中未找到main函数定义，但仍尝试执行');
          }
        } catch (tsError: any) {
          const errorMsg = `TypeScript编译失败: ${tsError.message}

请检查以下可能的问题：
1. 语法错误（如缺少分号、括号不匹配等）
2. TypeScript语法结构是否正确（如函数声明、变量声明等）
3. 确保定义了async function main函数
4. 确保启用了TypeScript开关

注意：编译器已禁用所有类型检查，只进行语法转换
提示：如果只想运行JavaScript代码，请关闭TypeScript开关`;
          throw new Error(errorMsg);
        }
      }

      // 执行逻辑：使用编译后的代码
      if (onExecute) {
        // 如果提供了执行回调，使用编译后的代码
        const result = await onExecute(finalCode, mergedParams);
        setExecutionResult(result);
        setSuccess('代码执行成功');
        setRightTabValue(1); // 自动切换到输出数据tab
      } else {
        // 默认执行逻辑：动态创建函数并执行
        try {
          // 使用Function构造器执行编译后的代码（比eval更安全）
          try {
            console.log('[CodeTestEditor] 开始执行代码...');
            console.log('[CodeTestEditor] 即将执行的代码:', finalCode);

            // 使用Function构造器创建可执行函数
            const executeCode = async (code: string, params: any) => {
              try {
                // 使用Function构造器而不是eval，更安全且避免语法问题
                const AsyncFunction = Object.getPrototypeOf(async function(){}).constructor;

                // 将编译后的代码和执行逻辑分开
                const wrappedCode = `
                  ${code}

                  // 执行main函数
                  if (typeof main === 'function') {
                    return await main({ params: params });
                  } else {
                    throw new Error('未找到main函数定义');
                  }
                `;

                console.log('[CodeTestEditor] 包装后的执行代码:', wrappedCode);

                // 创建async函数并执行
                const fn = new AsyncFunction('params', wrappedCode);
                return await fn(params);
              } catch (error) {
                console.error('[CodeTestEditor] 函数构造/执行错误:', error);
                throw error;
              }
            };

            // 执行代码并等待结果
            const result = await executeCode(finalCode, mergedParams);

            console.log('[CodeTestEditor] 代码执行成功，结果类型:', typeof result);
            setExecutionResult(result);
            setSuccess(language === 'typescript' ? 'TypeScript代码执行成功' : 'JavaScript代码执行成功');
            setRightTabValue(1); // 自动切换到输出数据tab

          } catch (execError: any) {
            // 提供更详细的错误信息
            let errorMessage = execError.message;
            console.error('[CodeTestEditor] 执行错误详情:', execError);

            if (errorMessage.includes('main') || errorMessage.includes('未找到')) {
              errorMessage += '\n\n请确保您的代码中定义了: async function main({ params }) { ... }';
            }

            if (errorMessage.includes('async')) {
              errorMessage += '\n\n请确保main函数声明为async函数';
            }

            if (errorMessage.includes('Unexpected token')) {
              errorMessage += '\n\n这可能是因为TypeScript语法错误或编译器未正确加载';
              errorMessage += '\n请检查浏览器控制台查看详细的编译日志';
            }

            if (errorMessage.includes('Unexpected identifier')) {
              errorMessage += '\n\n编译后的代码可能存在语法问题，请检查TypeScript代码';
            }

            throw new Error(`代码执行失败: ${errorMessage}`);
          }
        } catch (execError: any) {
          throw new Error(`代码执行失败: ${execError.message}`);
        }
      }

      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(`执行错误: ${err.message}`);
      console.error(err)
      setTimeout(() => setError(''), 5000);
    } finally {
      setExecuting(false);
    }
  };

  // 格式化代码
  const handleFormatCode = () => {
    if (codeEditorRef.current) {
      try {
        // 使用CodeMirror的格式化功能（如果有）
        // 目前CodeMirror没有内置的格式化功能，这里可以手动实现或跳过
        setSuccess('代码已刷新');
        setTimeout(() => setSuccess(''), 2000);
      } catch (err: any) {
        setError(`刷新失败: ${err.message}`);
        setTimeout(() => setError(''), 3000);
      }
    }
  };

  // 加载示例代码
  const handleLoadExample = () => {
    let exampleCode = '';
    let langName = '';
    switch (language) {
      case 'javascript':
        exampleCode = JS_DEFAULT_CODE_TEMPLATE;
        langName = 'JavaScript';
        break;
      case 'typescript':
        exampleCode = TS_EXAMPLE_CODE_TEMPLATE;
        langName = 'TypeScript';
        break;
      case 'python':
        exampleCode = PYTHON_DEFAULT_CODE_TEMPLATE;
        langName = 'Python';
        break;
    }
    setCode(exampleCode);
    setSuccess(`已加载${langName}示例代码`);
    setTimeout(() => setSuccess(''), 2000);
  };

  // 格式化JSON
  const handleFormatJson = () => {
    try {
      const parsedJson = JSON.parse(jsonData);
      const formattedJson = JSON.stringify(parsedJson, null, 2);
      setJsonData(formattedJson);
      setSuccess('JSON格式化成功');
      setTimeout(() => setSuccess(''), 2000);
    } catch (err: any) {
      setError(`JSON格式错误: ${err.message}`);
      setTimeout(() => setError(''), 3000);
    }
  };

  // 创建代码快照
  const handleCreateCodeSnapshot = (name: string, description?: string) => {
    try {
      createCodeSnapshot(name, code, description);
      setSuccess(`代码快照"${name}"已创建`);
      setTimeout(() => setSuccess(''), 2000);
    } catch (err: any) {
      setError(`创建快照失败: ${err.message}`);
      setTimeout(() => setError(''), 3000);
    }
  };

  // 恢复代码快照
  const handleRestoreCodeSnapshot = (snapshotId: string) => {
    try {
      const restoredCode = restoreCodeSnapshot(snapshotId);
      setCode(restoredCode);

      const snapshot = codeSnapshots.find(s => s.id === snapshotId);
      setSuccess(`已恢复代码到快照: ${snapshot?.name}`);
      setTimeout(() => setSuccess(''), 2000);
    } catch (err: any) {
      setError(`恢复快照失败: ${err.message}`);
      setTimeout(() => setError(''), 3000);
    }
  };

  // 创建JSON快照
  const handleCreateJsonSnapshot = (name: string, description?: string) => {
    try {
      createJsonSnapshot(name, jsonData, description);
      setSuccess(`JSON快照"${name}"已创建`);
      setTimeout(() => setSuccess(''), 2000);
    } catch (err: any) {
      setError(`创建快照失败: ${err.message}`);
      setTimeout(() => setError(''), 3000);
    }
  };

  // 恢复JSON快照
  const handleRestoreJsonSnapshot = (snapshotId: string) => {
    try {
      const restoredJson = restoreJsonSnapshot(snapshotId);
      setJsonData(restoredJson);

      const snapshot = jsonSnapshots.find(s => s.id === snapshotId);
      setSuccess(`已恢复JSON到快照: ${snapshot?.name}`);
      setTimeout(() => setSuccess(''), 2000);
    } catch (err: any) {
      setError(`恢复快照失败: ${err.message}`);
      setTimeout(() => setError(''), 3000);
    }
  };

  // 发送测试数据
  const handleSendTest = () => {
    console.log('[CodeTestEditor] handleSendTest 开始执行');
    console.log('[CodeTestEditor] 当前状态:', {
      hasOnSendTest: !!onSendTest,
      hasExecutionResult: !!executionResult,
      hasJsonData: !!jsonData,
      executionResult,
      jsonData
    });

    if (!onSendTest) {
      console.error('[CodeTestEditor] onSendTest 回调函数未定义');
      setError('发送测试功能未实现');
      setTimeout(() => setError(''), 3000);
      return;
    }

    try {
      // 获取执行结果作为发送数据
      const dataToSend = executionResult || {
        input: jsonData,
        result: null,
        message: '暂无执行结果'
      };

      console.log('[CodeTestEditor] 准备发送的数据:', {
        dataToSend,
        dataType: typeof dataToSend,
        dataKeys: Object.keys(dataToSend),
        isExecutionResult: !!executionResult
      });

      // 智能选择发送的数据
      let finalDataToSend = dataToSend;

      // 如果有执行结果，优先使用执行结果
      if (executionResult) {
        console.log('[CodeTestEditor] 使用执行结果作为发送数据');
        finalDataToSend = executionResult;
      } else {
        console.log('[CodeTestEditor] 使用备用数据作为发送数据');
      }

      // 如果数据包含 all_params，提取出来
      if (finalDataToSend.all_params) {
        console.log('[CodeTestEditor] 发现 all_params 字段，提取为测试数据');
        finalDataToSend = finalDataToSend.all_params;
      }

      console.log('[CodeTestEditor] 最终发送的数据:', {
        finalDataToSend,
        hasTracks: !!finalDataToSend.tracks,
        hasItems: !!finalDataToSend.items,
        tracks: finalDataToSend.tracks,
        items: finalDataToSend.items
      });

      console.log('[CodeTestEditor] 调用 onSendTest 回调函数...');
      onSendTest(finalDataToSend);
      console.log('[CodeTestEditor] onSendTest 回调函数调用完成');

      setSuccess('✅ 测试数据已发送并应用到JSON数据Tab！请查看左侧编辑器中的数据。');
      setTimeout(() => setSuccess(''), 5000);
    } catch (err: any) {
      console.error('[CodeTestEditor] 发送过程中发生错误:', err);
      setError(`发送失败: ${err.message}`);
      setTimeout(() => setError(''), 3000);
    }
  };

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* 顶部工具栏 */}
      <Paper elevation={0} sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="h6">代码测试</Typography>
          <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
            <FormControl>
              <RadioGroup
                row
                value={language}
                onChange={(e) => setLanguage(e.target.value as 'javascript' | 'typescript' | 'python')}
              >
                <FormControlLabel
                  value="javascript"
                  control={<Radio size="small" />}
                  label={<Typography variant="body2">JavaScript</Typography>}
                />
                <FormControlLabel
                  value="typescript"
                  control={<Radio size="small" />}
                  label={
                    <Typography variant="body2" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      TypeScript
                      {language === 'typescript' && !tsLoaded && (
                        <Typography variant="caption" color="warning.main">
                          (加载中...)
                        </Typography>
                      )}
                    </Typography>
                  }
                />
                <FormControlLabel
                  value="python"
                  control={<Radio size="small" />}
                  label={
                    <Typography variant="body2" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      Python
                      {language === 'python' && !pyodideLoaded && (
                        <Typography variant="caption" color="warning.main">
                          (加载中...)
                        </Typography>
                      )}
                    </Typography>
                  }
                />
              </RadioGroup>
            </FormControl>
            <Button size="small" onClick={handleReset} variant="outlined">
              重置全部
            </Button>
          </Box>
        </Box>
      </Paper>

      {/* 消息提示 */}
      {(error || success) && (
        <Box sx={{ p: 2, pt: 0, pb: 0 }}>
          {error && (
            <Alert severity="error" onClose={() => setError('')}>
              {error}
            </Alert>
          )}
          {success && (
            <Alert severity="success" onClose={() => setSuccess('')}>
              {success}
            </Alert>
          )}
        </Box>
      )}

      {/* 左右分栏编辑器 */}
      <Box sx={{ flex: 1, display: 'flex', overflow: 'hidden', gap: 2 }}>
        {/* 左侧：代码编辑器 */}
        <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <Paper
            elevation={0}
            sx={{
              p: 2,
              border: 1,
              borderColor: 'divider',
              borderRadius: 1,
              height: '100%',
              display: 'flex',
              flexDirection: 'column'
            }}
          >
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                代码编辑器 ({language === 'typescript' ? 'TypeScript' : language === 'python' ? 'Python' : 'JavaScript'})
              </Typography>
              <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                <SnapshotManager
                  snapshots={codeSnapshots}
                  onCreateSnapshot={handleCreateCodeSnapshot}
                  onRestoreSnapshot={handleRestoreCodeSnapshot}
                  onDeleteSnapshot={deleteCodeSnapshot}
                  onRenameSnapshot={renameCodeSnapshot}
                />
                <Divider orientation="vertical" flexItem sx={{ mx: 1 }} />
                <Tooltip title={`加载${language === 'typescript' ? 'TypeScript' : language === 'python' ? 'Python' : 'JavaScript'}示例代码`}>
                  <IconButton
                    size="small"
                    onClick={handleLoadExample}
                    color="primary"
                  >
                    <CodeIcon />
                  </IconButton>
                </Tooltip>
                <Tooltip title="刷新代码">
                  <IconButton
                    size="small"
                    onClick={handleFormatCode}
                    color="primary"
                  >
                    <RefreshIcon />
                  </IconButton>
                </Tooltip>
              </Box>
            </Box>

            <Box sx={{ flex: 1, border: 1, borderColor: 'divider', borderRadius: 1, overflow: 'hidden' }}>
              <CodeMirrorEditor
                height="100%"
                language={language}
                value={code}
                onChange={(value) => setCode(value || '')}
                theme="light"
                onMount={(view) => {
                  codeEditorRef.current = view;
                  console.log('[CodeTestEditor] 代码编辑器已挂载');
                }}
                options={{
                  lineNumbers: true,
                  lineWrapping: true,
                  tabSize: 2,
                }}
              />
            </Box>
          </Paper>
        </Box>

        {/* 右侧：数据面板 */}
        <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <Paper
            elevation={0}
            sx={{
              p: 2,
              border: 1,
              borderColor: 'divider',
              borderRadius: 1,
              height: '100%',
              display: 'flex',
              flexDirection: 'column'
            }}
          >
            {/* Tab切换器 */}
            <Tabs
              value={rightTabValue}
              onChange={(_, newValue) => setRightTabValue(newValue)}
              sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}
            >
              <Tab label="输入数据" />
              <Tab label="输出数据" />
            </Tabs>

            {/* Tab内容 */}
            <Box sx={{ flex: 1, overflow: 'hidden' }}>
              {/* 输入数据Tab */}
              {rightTabValue === 0 && (
                <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                    <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                      JSON参数编辑器
                    </Typography>
                    <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                      <SnapshotManager
                        snapshots={jsonSnapshots}
                        onCreateSnapshot={handleCreateJsonSnapshot}
                        onRestoreSnapshot={handleRestoreJsonSnapshot}
                        onDeleteSnapshot={deleteJsonSnapshot}
                        onRenameSnapshot={renameJsonSnapshot}
                      />
                      <Divider orientation="vertical" flexItem sx={{ mx: 1 }} />
                      <Tooltip title="格式化JSON">
                        <IconButton
                          size="small"
                          onClick={handleFormatJson}
                          color="primary"
                        >
                          <RefreshIcon />
                        </IconButton>
                      </Tooltip>
                    </Box>
                  </Box>

                  <Box sx={{ flex: 1, border: 1, borderColor: 'divider', borderRadius: 1, overflow: 'hidden' }}>
                    <CodeMirrorEditor
                      height="100%"
                      language="json"
                      value={jsonData}
                      onChange={(value) => setJsonData(value || '')}
                      theme="light"
                      onMount={(view) => {
                        jsonEditorRef.current = view;
                        console.log('[CodeTestEditor] JSON编辑器已挂载');
                      }}
                      options={{
                        lineNumbers: true,
                        lineWrapping: true,
                        tabSize: 2,
                      }}
                    />
                  </Box>
                </Box>
              )}

              {/* 输出数据Tab */}
              {rightTabValue === 1 && (
                <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                  <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1 }}>
                    执行结果
                  </Typography>

                  <Box sx={{ flex: 1, border: 1, borderColor: 'divider', borderRadius: 1, overflow: 'hidden' }}>
                    {executionResult ? (
                      <CodeMirrorEditor
                        height="100%"
                        language="json"
                        value={JSON.stringify(executionResult, null, 2)}
                        onChange={() => {}} // 输出结果只读
                        theme="light"
                        readOnly={true}
                        options={{
                          lineNumbers: true,
                          lineWrapping: true,
                          tabSize: 2,
                        }}
                      />
                    ) : (
                      <Box
                        sx={{
                          height: '100%',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: 'text.secondary'
                        }}
                      >
                        <Typography variant="body2">
                          暂无执行结果，请先执行代码
                        </Typography>
                      </Box>
                    )}
                  </Box>
                </Box>
              )}
            </Box>
          </Paper>
        </Box>
      </Box>

  
      {/* 底部执行按钮 */}
      <Box sx={{ p: 2, borderTop: 1, borderColor: 'divider' }}>
        <Box sx={{ display: 'flex', gap: 2 }}>
          <Button
            onClick={handleExecute}
            variant="contained"
            startIcon={<PlayArrowIcon />}
            disabled={executing}
            fullWidth
            size="large"
          >
            {executing ? '执行中...' : '执行代码'}
          </Button>
          <Button
            onClick={handleSendTest}
            variant="outlined"
            startIcon={<SendIcon />}
            disabled={!executionResult && !jsonData}
            size="large"
            sx={{ minWidth: '120px' }}
          >
            发送测试
          </Button>
        </Box>
      </Box>
    </Box>
  );
}