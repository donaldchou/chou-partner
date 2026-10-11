"use client";

import { useEffect, useState } from "react";

/**
 * 依 key 讀取資料（key 改變就重新讀取）；reload() 強制重讀。
 * 舊的請求回來時若 key 已經變了就丟掉，避免畫面閃回舊資料。
 */
export function useFetch<T>(key: string, fetcher: () => Promise<T>) {
  const [nonce, setNonce] = useState(0);
  const fullKey = `${key}#${nonce}`;
  const [state, setState] = useState<{ key: string; data?: T; error?: string }>({ key: "" });

  useEffect(() => {
    let alive = true;
    fetcher().then(
      (data) => alive && setState({ key: fullKey, data }),
      (e) => alive && setState({ key: fullKey, error: e instanceof Error ? e.message : String(e) }),
    );
    return () => {
      alive = false;
    };
    // fetcher 每次 render 都是新的函式，只依 key 決定是否重讀
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fullKey]);

  const loading = state.key !== fullKey;
  return {
    // 重新讀取時保留上一次的資料，畫面不會整個清空
    data: state.data,
    error: loading ? undefined : state.error,
    loading,
    reload: () => setNonce((n) => n + 1),
    /** 直接改本地資料（例如存檔後用後端回傳的結果更新畫面） */
    set: (data: T) => setState({ key: fullKey, data }),
  };
}
