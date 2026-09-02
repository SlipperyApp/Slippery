'use client';

import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import type { SlipRead } from '@/lib/data/read';

/** The one slip being worked on, held across the four screens of the import.
 *
 *  IN MEMORY, and deliberately. iOS Safari is the primary target and this
 *  product uses neither localStorage nor sessionStorage; a slip image is also
 *  the most personal thing anybody sends here, so it living only as long as
 *  the tab is a feature rather than a limitation.
 *
 *  The cost is that a refresh loses it. Every screen in the flow checks for
 *  that and says so, rather than rendering an empty cropper over nothing,
 *  which is what the old crop step did on every visit. */

export type PendingSlip = {
  file: File;
  /** An object URL for showing it. Revoked when it is replaced. */
  url: string;
  /** The media type the reader will be given, already normalised. */
  type: string;
  name: string;
  size: number;
};

type Flow = {
  pending: PendingSlip | null;
  /** What the crop step produced. Null until the crop step has run. */
  cropped: File | null;
  read: SlipRead | null;
  sha256: string | null;
  setPending: (file: File, type: string) => void;
  setCropped: (file: File | null) => void;
  setRead: (read: SlipRead | null, sha256: string | null) => void;
  reset: () => void;
};

const Ctx = createContext<Flow | null>(null);

export function SlipFlowProvider({ children }: { children: React.ReactNode }) {
  const [pending, setPendingState] = useState<PendingSlip | null>(null);
  const [cropped, setCropped] = useState<File | null>(null);
  const [read, setReadState] = useState<SlipRead | null>(null);
  const [sha256, setSha] = useState<string | null>(null);
  const url = useRef<string | null>(null);

  const release = useCallback(() => {
    if (url.current) URL.revokeObjectURL(url.current);
    url.current = null;
  }, []);

  const setPending = useCallback((file: File, type: string) => {
    release();
    const next = URL.createObjectURL(file);
    url.current = next;
    setPendingState({ file, url: next, type, name: file.name, size: file.size });
    setCropped(null);
    setReadState(null);
    setSha(null);
  }, [release]);

  const setRead = useCallback((next: SlipRead | null, hash: string | null) => {
    setReadState(next);
    setSha(hash);
  }, []);

  const reset = useCallback(() => {
    release();
    setPendingState(null);
    setCropped(null);
    setReadState(null);
    setSha(null);
  }, [release]);

  const value = useMemo<Flow>(
    () => ({ pending, cropped, read, sha256, setPending, setCropped, setRead, reset }),
    [pending, cropped, read, sha256, setPending, setRead, reset],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSlipFlow(): Flow {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useSlipFlow outside the import flow');
  return ctx;
}
