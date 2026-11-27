"use client";

import type { ReactNode } from "react";
import { cn } from "../tokens.js";
import { Button } from "./Button.js";
import { ChevronLeftIcon, ChevronRightIcon } from "./Icons.js";

export interface TableColumn<T> {
  key: string;
  header: string;
  align?: "left" | "right" | "center" | undefined;
  className?: string | undefined;
  render: (row: T) => ReactNode;
}

export interface DataTableProps<T> {
  columns: TableColumn<T>[];
  data: T[];
  rowKey: (row: T) => string;
  onRowClick?: ((row: T) => void) | undefined;
  emptyTitle?: string | undefined;
  emptyDescription?: string | undefined;
  className?: string | undefined;
}

export function DataTable<T>({
  columns,
  data,
  rowKey,
  onRowClick,
  emptyTitle = "No records found",
  emptyDescription = "Try adjusting your search or filter criteria.",
  className,
}: DataTableProps<T>) {
  if (data.length === 0) {
    return (
      <div className="rounded-2xl border border-[#E2EBE6] bg-white px-6 py-12 text-center">
        <p className="text-sm font-semibold text-[#0D2621]">{emptyTitle}</p>
        <p className="mt-1 text-xs text-[#64786E]">{emptyDescription}</p>
      </div>
    );
  }

  return (
    <div className={cn("overflow-hidden rounded-2xl border border-[#E2EBE6] bg-white", className)}>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-[#E2EBE6] text-left text-sm">
          <thead className="bg-[#F5F7F6]">
            <tr>
              {columns.map((col) => (
                <th
                  key={col.key}
                  scope="col"
                  className={cn(
                    "px-4 py-3 text-xs font-semibold uppercase tracking-wider text-[#52665F] whitespace-nowrap",
                    col.align === "right" && "text-right",
                    col.align === "center" && "text-center",
                    col.className
                  )}
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[#E2EBE6] bg-white">
            {data.map((row) => (
              <tr
                key={rowKey(row)}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                className={cn(
                  "transition-colors",
                  onRowClick && "cursor-pointer hover:bg-[#F5F7F6]/70"
                )}
              >
                {columns.map((col) => (
                  <td
                    key={col.key}
                    className={cn(
                      "px-4 py-3.5 text-sm text-[#0D2621] align-middle",
                      col.align === "right" && "text-right",
                      col.align === "center" && "text-center",
                      col.className
                    )}
                  >
                    {col.render(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export interface PaginationProps {
  page: number;
  totalPages: number;
  total: number;
  limit: number;
  onPageChange: (nextPage: number) => void;
  className?: string | undefined;
}

export function Pagination({
  page,
  totalPages,
  total,
  limit,
  onPageChange,
  className,
}: PaginationProps) {
  const safeTotalPages = Math.max(1, totalPages);
  const start = total === 0 ? 0 : (page - 1) * limit + 1;
  const end = Math.min(total, page * limit);

  return (
    <div
      className={cn(
        "flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#E2EBE6] bg-white px-4 py-3 text-xs text-[#52665F]",
        className
      )}
    >
      <span>
        Showing <strong className="font-semibold text-[#0D2621]">{start}</strong>–
        <strong className="font-semibold text-[#0D2621]">{end}</strong> of{" "}
        <strong className="font-semibold text-[#0D2621]">{total}</strong>
      </span>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
          leftIcon={<ChevronLeftIcon size={14} />}
        >
          Prev
        </Button>
        <span className="px-2 font-medium text-[#0D2621]">
          Page {page} of {safeTotalPages}
        </span>
        <Button
          variant="outline"
          size="sm"
          disabled={page >= safeTotalPages}
          onClick={() => onPageChange(page + 1)}
          rightIcon={<ChevronRightIcon size={14} />}
        >
          Next
        </Button>
      </div>
    </div>
  );
}

export function FilterBar({ children, className }: { children: ReactNode; className?: string | undefined }) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-3 rounded-2xl border border-[#E2EBE6] bg-white p-3.5",
        className
      )}
    >
      {children}
    </div>
  );
}

export interface TabItem {
  id: string;
  label: string;
  count?: number | undefined;
}

export interface TabsProps {
  items: TabItem[];
  activeId: string;
  onChange: (id: string) => void;
  className?: string | undefined;
}

export function Tabs({ items, activeId, onChange, className }: TabsProps) {
  return (
    <div
      className={cn(
        "inline-flex flex-wrap items-center gap-1 rounded-xl border border-[#E2EBE6] bg-white p-1",
        className
      )}
      role="tablist"
    >
      {items.map((tab) => {
        const active = tab.id === activeId;
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(tab.id)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors cursor-pointer",
              active
                ? "bg-[#235347] text-white"
                : "text-[#52665F] hover:bg-[#F5F7F6] hover:text-[#0D2621]"
            )}
          >
            <span>{tab.label}</span>
            {tab.count !== undefined && (
              <span
                className={cn(
                  "rounded-full px-1.5 py-0.5 text-[10px] font-bold leading-none",
                  active ? "bg-white/20 text-white" : "bg-[#F5F7F6] text-[#0D2621]"
                )}
              >
                {tab.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
