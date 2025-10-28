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
  Switch,
  FormControlLabel,
} from '@mui/material';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import RefreshIcon from '@mui/icons-material/Refresh';
import CodeIcon from '@mui/icons-material/Code';
import SendIcon from '@mui/icons-material/Send';
import CodeMirrorEditor from '@/components/CodeMirrorEditor';

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
    // 尝试从localStorage恢复上次的代码
    const stored = localStorage.getItem(`code-test-${testDataId}`);
    return stored || initialCode;
  });
  const [jsonData, setJsonData] = useState('{}');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [executing, setExecuting] = useState(false);
  const [executionResult, setExecutionResult] = useState<any>(null);
  const [rightTabValue, setRightTabValue] = useState(0); // 右侧tab状态：0=输入数据，1=输出数据
  const [useTypeScript, setUseTypeScript] = useState(true); // 是否使用TypeScript
  const [tsLoaded, setTsLoaded] = useState(false); // TypeScript编译器是否已加载
  const codeEditorRef = useRef<any>(null);
  const jsonEditorRef = useRef<any>(null);

  // 当testDataId变化时，恢复对应的代码和JSON数据
  useEffect(() => {
    const storedCode = localStorage.getItem(`code-test-${testDataId}`);
    const storedJson = localStorage.getItem(`code-test-json-${testDataId}`);
    const newCode = storedCode || initialCode;
    const newJsonData = storedJson || '{}';

    setCode(newCode);
    setJsonData(newJsonData);
    setError('');
    setSuccess('');
    setExecutionResult(null);
    console.log('[CodeTestEditor] 加载数据:', {
      testDataId,
      hasStoredCode: !!storedCode,
      hasStoredJson: !!storedJson,
      codeLength: newCode.length,
      jsonLength: newJsonData.length
    });
  }, [testDataId, initialCode]);

  // 保存代码到localStorage
  useEffect(() => {
    if (code) {
      localStorage.setItem(`code-test-${testDataId}`, code);
    }
  }, [code, testDataId]);

  // 保存JSON数据到localStorage
  useEffect(() => {
    if (jsonData) {
      localStorage.setItem(`code-test-json-${testDataId}`, jsonData);
    }
  }, [jsonData, testDataId]);

  // 动态加载TypeScript编译器
  useEffect(() => {
    const loadTypeScript = async () => {
      if (useTypeScript && !tsLoaded && (window as any).ts === undefined) {
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
                setUseTypeScript(false);
              }
            }, 100);
          };

          script.onerror = (error) => {
            console.error('[CodeTestEditor] TypeScript编译器加载失败:', error);
            setError('TypeScript编译器加载失败，请检查网络连接');
            setUseTypeScript(false);
          };

          document.head.appendChild(script);
        } catch (err: any) {
          console.error('[CodeTestEditor] TypeScript编译器加载异常:', err);
          setError(`TypeScript编译器加载失败: ${err.message}`);
          setUseTypeScript(false);
        }
      } else if (useTypeScript && (window as any).ts !== undefined) {
        setTsLoaded(true);
        console.log('[CodeTestEditor] TypeScript编译器已就绪');
      }
    };

    loadTypeScript();
  }, [useTypeScript, tsLoaded]);

  // 当切换到TypeScript模式时，提供TypeScript示例代码
  useEffect(() => {
    if (useTypeScript && tsLoaded) {
      const currentCode = code.trim();
      // 如果当前是JavaScript默认代码，自动切换到TypeScript示例
      if (currentCode.includes('// 代码测试环境 (JavaScript)') &&
          !currentCode.includes('interface TestParams')) {
        setCode(TS_EXAMPLE_CODE_TEMPLATE);
        setSuccess('已切换到TypeScript模式并加载示例代码');
        setTimeout(() => setSuccess(''), 3000);
      }
    }
  }, [useTypeScript, tsLoaded, code]);

  // 验证TypeScript编译器状态
  useEffect(() => {
    if (useTypeScript && tsLoaded) {
      // 定期检查编译器是否仍然可用
      const checkInterval = setInterval(() => {
        if ((window as any).ts === undefined) {
          console.warn('[CodeTestEditor] TypeScript编译器丢失，重新加载...');
          setTsLoaded(false);
          // 可以在这里添加重新加载逻辑
        }
      }, 5000);

      return () => clearInterval(checkInterval);
    }
  }, [useTypeScript, tsLoaded]);

  // 重置为默认代码和JSON
  const handleReset = () => {
    const defaultCode = useTypeScript ? TS_EXAMPLE_CODE_TEMPLATE : JS_DEFAULT_CODE_TEMPLATE;
    setCode(defaultCode);
    setJsonData('{}');
    setError('');
    setSuccess('');
    setExecutionResult(null);
    localStorage.removeItem(`code-test-${testDataId}`);
    localStorage.removeItem(`code-test-json-${testDataId}`);
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

      // 统一的编译逻辑
      let finalCode = code;

      // 如果使用TypeScript，先编译成JavaScript
      if (useTypeScript) {
        if (!tsLoaded || (window as any).ts === undefined) {
          throw new Error('TypeScript编译器未加载完成，请稍后再试');
        }

        try {
          console.log('[CodeTestEditor] 编译TypeScript代码...');
          console.log('[CodeTestEditor] 原始代码:', code);
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
          console.log('[CodeTestEditor] 编译后代码:', finalCode);
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
            setSuccess(useTypeScript ? 'TypeScript代码执行成功' : 'JavaScript代码执行成功');
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

  // 加载TypeScript示例代码
  const handleLoadTSExample = () => {
    setCode(TS_EXAMPLE_CODE_TEMPLATE);
    setSuccess('已加载TypeScript示例代码');
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
            <FormControlLabel
              control={
                <Switch
                  checked={useTypeScript}
                  onChange={(e) => setUseTypeScript(e.target.checked)}
                  size="small"
                />
              }
              label={
                <Typography variant="body2" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  TypeScript
                  {useTypeScript && !tsLoaded && (
                    <Typography variant="caption" color="warning.main">
                      (加载中...)
                    </Typography>
                  )}
                </Typography>
              }
            />
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
                代码编辑器 ({useTypeScript ? 'TypeScript' : 'JavaScript'})
              </Typography>
              <Box sx={{ display: 'flex', gap: 1 }}>
                {useTypeScript && (
                  <Tooltip title="加载TypeScript示例代码">
                    <IconButton
                      size="small"
                      onClick={handleLoadTSExample}
                      color="primary"
                    >
                      <CodeIcon />
                    </IconButton>
                  </Tooltip>
                )}
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
                language={useTypeScript ? "typescript" : "javascript"}
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