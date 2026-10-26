"use client";

import { useCallback, useMemo, useSyncExternalStore } from "react";

/*
 * 頁面設定（篩選、分頁、檢視方式…）記在瀏覽器 localStorage，按 F5 重新整理也不會還原。
 * 用法同 AppShell 的選單收合：useSyncExternalStore 讀取，伺服器端與第一次 hydrate 用預設值，避免畫面不一致。
 */

const memory = new Map<string, string>();
const listeners = new Map<string, Set<() => void>>();

function read(key: string): string | null {
  if (memory.has(key)) return memory.get(key)!;
  try {
    const v = localStorage.getItem(key);
    if (v !== null) memory.set(key, v);
    return v;
  } catch {
    return null;
  }
}

function write(key: string, value: string) {
  memory.set(key, value);
  try {
    localStorage.setItem(key, value);
  } catch {
    // 無法儲存（例如無痕模式）時，只在這次瀏覽有效
  }
  listeners.get(key)?.forEach((l) => l());
}

/** 記在瀏覽器的一組設定；defaults 請傳模組層級的常數（每次 render 同一個物件） */
export function usePersistentState<T extends object>(key: string, defaults: T): [T, (patch: Partial<T>) => void] {
  const subscribe = useCallback(
    (l: () => void) => {
      const set = listeners.get(key) ?? new Set();
      set.add(l);
      listeners.set(key, set);
      return () => set.delete(l);
    },
    [key],
  );
  const raw = useSyncExternalStore(subscribe, () => read(key), () => null);
  const value = useMemo<T>(() => {
    if (!raw) return defaults;
    try {
      return { ...defaults, ...JSON.parse(raw) };
    } catch {
      return defaults;
    }
  }, [raw, defaults]);
  const update = useCallback(
    (patch: Partial<T>) => {
      const current = read(key);
      let base = defaults;
      try {
        if (current) base = { ...defaults, ...JSON.parse(current) };
      } catch {
        // 壞掉的資料就用預設值覆蓋
      }
      write(key, JSON.stringify({ ...base, ...patch }));
    },
    [key, defaults],
  );
  return [value, update];
}
