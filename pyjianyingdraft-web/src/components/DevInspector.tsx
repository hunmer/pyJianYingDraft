'use client';

import { useEffect, useState } from "react";
import { MousePointer2 } from "lucide-react";

type ReactFiber = {
  return?: ReactFiber | null;
  _debugSource?: {
    fileName?: string;
    lineNumber?: number;
    columnNumber?: number;
  };
  _debugOwner?: ReactFiber | null;
};

type FiberElement = HTMLElement & {
  [key: string]: ReactFiber | undefined;
};

function getFiber(element: HTMLElement | null): ReactFiber | undefined {
  if (!element) return undefined;

  const fiberKey = Object.keys(element).find(
    (key) =>
      key.startsWith("__reactFiber$") ||
      key.startsWith("__reactInternalInstance$")
  );

  if (fiberKey) return (element as FiberElement)[fiberKey];
  return getFiber(element.parentElement);
}

/**
 * 读取源码位置：优先 DOM data 属性（需 loader），回退 React Fiber _debugSource（Next dev 默认注入）。
 */
function getCodeInfo(element: HTMLElement) {
  const sourceElement = element.closest<HTMLElement>(
    "[data-inspector-relative-path]"
  );

  if (sourceElement?.dataset.inspectorRelativePath) {
    return {
      relativePath: sourceElement.dataset.inspectorRelativePath,
      lineNumber: sourceElement.dataset.inspectorLine ?? "1",
      columnNumber: sourceElement.dataset.inspectorColumn ?? "1",
    };
  }

  let fiber = getFiber(element);

  while (fiber) {
    const source = fiber._debugSource ?? fiber._debugOwner?._debugSource;

    if (source?.fileName && source.lineNumber) {
      return {
        absolutePath: source.fileName,
        lineNumber: String(source.lineNumber),
        columnNumber: String(source.columnNumber ?? 1),
      };
    }

    fiber = fiber.return ?? undefined;
  }

  return undefined;
}

export default function DevInspector() {
  const [active, setActive] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!active) return;

    const handleClick = (event: MouseEvent) => {
      event.preventDefault();
      event.stopPropagation();

      const target = event.target;
      console.log("[DevInspector] click captured on:", target);

      if (!(target instanceof HTMLElement)) {
        console.warn("[DevInspector] target 不是 HTMLElement");
        setActive(false);
        return;
      }

      const codeInfo = getCodeInfo(target);
      console.log("[DevInspector] codeInfo:", codeInfo);

      setActive(false);

      if (!codeInfo) {
        console.warn("[DevInspector] 未找到源码信息，可能 _debugSource 未注入");
        return;
      }

      // 直接请求 route handler，绕开 gotoServerEditor / rewrite，链路最短。
      // babel-plugin 注入的是相对路径，_debugSource 是绝对路径，两者都接受；
      // route handler 会把相对路径 resolve 为绝对路径。
      const fileName =
        "absolutePath" in codeInfo ? codeInfo.absolutePath : codeInfo.relativePath;
      if (!fileName) {
        console.warn("[DevInspector] 缺少文件路径");
        return;
      }

      const params = new URLSearchParams({
        fileName,
        lineNumber: codeInfo.lineNumber,
        colNumber: codeInfo.columnNumber,
      });
      console.log("[DevInspector] fetching /api/open-in-editor", params.toString());
      fetch(`/api/open-in-editor?${params}`);
    };

    window.addEventListener("click", handleClick, true);
    return () => window.removeEventListener("click", handleClick, true);
  }, [active]);

  if (process.env.NODE_ENV !== "development") return null;
  if (!mounted) return null;

  return (
    <button
      type="button"
      onClick={() => setActive((value) => !value)}
      aria-pressed={active}
      title="Inspect React component source"
      className="fixed bottom-3 right-3 z-[2147483647] flex h-8 w-8 items-center justify-center rounded border border-border bg-background shadow hover:bg-muted"
    >
      <MousePointer2 className={active ? "text-primary" : "text-muted-foreground"} size={16} />
    </button>
  );
}
