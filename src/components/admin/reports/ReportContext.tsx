"use client";
import { createContext, useContext } from "react";
import type { StoreInfo } from "@/lib/invoice";

export type ReportCtx = {
  store: StoreInfo;
  /** e.g. "01/11/2026 – 16/11/2026" */
  periodLabel: string;
  /** e.g. "Channel: POS · Salesperson: Sara" — empty when unfiltered */
  filtersLabel: string;
  /** File-name friendly period, e.g. "2026-11-01_2026-11-16" */
  fileSuffix: string;
};

export const ReportContext = createContext<ReportCtx>({ store: {}, periodLabel: "", filtersLabel: "", fileSuffix: "" });
export const useReport = () => useContext(ReportContext);
