import path from 'node:path';
import { type NextRequest, NextResponse } from 'next/server';

/**
 * react-dev-inspector 服务端入口。
 * 接收 /__open-stack-frame-in-editor 请求（经 next.config rewrites 转发至此），
 * 调用 react-dev-utils/launchEditor 在本地 IDE 打开源码。
 *
 * 必须运行在 Node.js runtime（launchEditor 依赖 child_process）。
 */
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type LaunchEditor = (
  fileName: string,
  lineNumber?: number,
  colNumber?: number,
) => void;

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const fileName = searchParams.get('fileName');
  const lineNumber = Number(searchParams.get('lineNumber') ?? 1);
  const colNumber = Number(searchParams.get('colNumber') ?? 1);

  if (!fileName) {
    return new NextResponse('missing fileName', { status: 400 });
  }

  // babel-plugin 注入的是相对路径（相对项目根），launchEditor 需要绝对路径，故解析。
  const resolved = path.isAbsolute(fileName)
    ? fileName
    : path.resolve(process.cwd(), fileName);

  // launchEditor 会自动检测当前正在运行的编辑器（VSCode/WebStorm 等）；
  // 也可通过 REACT_EDITOR 环境变量强制指定，如 code / webstorm。
  const launchEditor = (
    (await import('react-dev-utils/launchEditor')) as { default: LaunchEditor }
  ).default;
  launchEditor(resolved, lineNumber, colNumber);

  return new NextResponse('ok', { status: 200 });
}
