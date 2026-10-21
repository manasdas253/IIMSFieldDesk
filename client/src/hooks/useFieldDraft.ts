import { useCallback, useRef, useState } from "react";

type Updater<T> = T | ((previous: T) => T);
type EmployeeDraft = { employeeName: string; empCode?: string };

function normalizeIdentity(employeeName: string, empCode?: string) { return (empCode?.trim() || employeeName.trim()).toLocaleLowerCase(); }
function keyFor(namespace: string, identity: string) {
  const scoped = normalizeIdentity(identity) || "unassigned";
  return `${namespace}:${encodeURIComponent(scoped)}`;
}
function loadDraft<T extends EmployeeDraft>(namespace: string, employeeName: string, empCode: string, fallback: T): T {
  try {
    const stored = localStorage.getItem(keyFor(namespace, empCode || employeeName));
    if (stored) return { ...fallback, ...JSON.parse(stored), employeeName, empCode } as T;
    const legacy = localStorage.getItem(namespace);
    if (legacy) {
      const parsed = JSON.parse(legacy) as T;
      if (normalizeIdentity(parsed.employeeName, parsed.empCode) === normalizeIdentity(employeeName, empCode)) return { ...fallback, ...parsed, employeeName, empCode } as T;
    }
  } catch {
    // Keep the form available if browser storage is unavailable or malformed.
  }
  return fallback;
}

/** Browser-only draft persistence scoped by Emp Code, falling back to legacy employee name. */
export function useFieldDraft<T extends EmployeeDraft>(namespace: string, initialValue: T) {
  const [value, setState] = useState<T>(() => loadDraft(namespace, initialValue.employeeName, initialValue.empCode ?? "", initialValue));
  const valueRef = useRef(value);
  const scopeRef = useRef(normalizeIdentity(value.employeeName, value.empCode));

  const setValue = useCallback((updater: Updater<T>) => {
    const next = typeof updater === "function" ? (updater as (previous: T) => T)(valueRef.current) : updater;
    valueRef.current = next;
    setState(next);
  }, []);

  const saveDraft = useCallback(() => {
    try {
      localStorage.setItem(keyFor(namespace, scopeRef.current), JSON.stringify(valueRef.current));
    } catch {
      // The form stays usable when browser storage is unavailable.
    }
  }, [namespace]);

  const switchEmployee = useCallback((employeeName: string, fallback: T, empCode = ""): T => {
    const displayName = employeeName.trim();
    const code = empCode.trim().toUpperCase();
    const scope = normalizeIdentity(displayName, code);
    if (scope === scopeRef.current) {
      const next = { ...valueRef.current, employeeName: displayName, empCode: code } as T;
      valueRef.current = next;
      setState(next);
      return next;
    }
    const next = loadDraft(namespace, displayName, code, { ...fallback, employeeName: displayName, empCode: code } as T);
    scopeRef.current = scope;
    valueRef.current = next;
    setState(next);
    return next;
  }, [namespace]);

  const clearDraft = useCallback(() => {
    try {
      localStorage.removeItem(keyFor(namespace, scopeRef.current));
      const legacy = localStorage.getItem(namespace);
      if (legacy && normalizeIdentity((JSON.parse(legacy) as T).employeeName, (JSON.parse(legacy) as T).empCode) === scopeRef.current) localStorage.removeItem(namespace);
    } catch { /* storage is optional */ }
  }, [namespace]);

  return { value, setValue, saveDraft, clearDraft, switchEmployee };
}
