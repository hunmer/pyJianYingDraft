// 代码执行纯逻辑：编译 TypeScript / 执行 JavaScript / 执行 Python
// 提取自原组件 handleExecute 的核心执行分支，行为与错误文案逐字保留

/**
 * 编译 TypeScript 代码为 JavaScript
 * 提取自原 handleExecute 的 TypeScript 编译分支（含全部 compilerOptions）
 */
export function compileTypeScript(code: string): string {
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

    const finalCode = transpileResult.outputText;

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

    return finalCode;
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

/**
 * 执行 JavaScript（或编译后的）代码
 * 提取自原 handleExecute 的默认执行分支，保留原 try/catch 嵌套结构
 */
export async function runJavaScript(code: string, params: any): Promise<any> {
  try {
    // 默认执行逻辑：动态创建函数并执行
    try {
      console.log('[CodeTestEditor] 开始执行代码...');
      console.log('[CodeTestEditor] 即将执行的代码:', code);

      // 使用Function构造器执行编译后的代码（比eval更安全）
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
      const result = await executeCode(code, params);

      console.log('[CodeTestEditor] 代码执行成功，结果类型:', typeof result);
      return result;

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

/**
 * 执行 Python 代码（基于 Pyodide）
 * 提取自原 handleExecute 的 Python 分支
 */
export async function runPython(pyodide: any, code: string, params: any): Promise<any> {
  try {
    console.log('[CodeTestEditor] 执行Python代码...');
    // console.log('[CodeTestEditor] 原始代码:', code);

    // 将JavaScript对象转换为Python字典
    // 使用pyodide.toPy来确保正确转换
    const pythonParams = pyodide.toPy(params);
    pyodide.globals.set('params', pythonParams);

    console.log('[CodeTestEditor] 参数已设置:', params);

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

    return finalResult;
  } catch (pyError: any) {
    const errorMsg = `Python执行失败: ${pyError.message}

请检查以下可能的问题：
1. 语法错误（如缩进、括号不匹配等）
2. 确保定义了 def main(params) 函数
3. 确保代码最后返回了结果

提示：查看浏览器控制台获取更详细的错误信息`;
    throw new Error(errorMsg);
  }
}
