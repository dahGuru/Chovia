"use client";

import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";
import { cn } from "../tokens.js";
import { CloseIcon, SearchIcon } from "./Icons.js";

export interface FormFieldProps {
  label?: string | undefined;
  htmlFor?: string | undefined;
  error?: string | undefined;
  hint?: string | undefined;
  required?: boolean | undefined;
  children: ReactNode;
  className?: string | undefined;
}

export function FormField({
  label,
  htmlFor,
  error,
  hint,
  required,
  children,
  className,
}: FormFieldProps) {
  return (
    <div className={cn("space-y-1.5", className)}>
      {label && (
        <label htmlFor={htmlFor} className="block text-xs font-semibold text-[#0D2621]">
          {label}
          {required && <span className="ml-0.5 text-[#EF4444]">*</span>}
        </label>
      )}
      {children}
      {error ? (
        <p className="text-xs font-medium text-[#EF4444]" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p className="text-xs text-[#64786E]">{hint}</p>
      ) : null}
    </div>
  );
}

const INPUT_BASE =
  "w-full rounded-xl border border-[#E2EBE6] bg-white px-3.5 py-2.5 text-sm text-[#0D2621] placeholder:text-[#64786E]/70 transition-colors focus:border-[#235347] focus:outline-none focus:ring-2 focus:ring-[#235347]/20 disabled:cursor-not-allowed disabled:bg-[#F5F7F6] disabled:text-[#64786E]";

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  hasError?: boolean | undefined;
}

export function Input({ hasError, className, ...rest }: InputProps) {
  return (
    <input
      className={cn(
        INPUT_BASE,
        hasError && "border-[#EF4444] focus:border-[#EF4444] focus:ring-[#EF4444]/20",
        className
      )}
      {...rest}
    />
  );
}

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  hasError?: boolean | undefined;
}

export function Textarea({ hasError, className, rows = 3, ...rest }: TextareaProps) {
  return (
    <textarea
      rows={rows}
      className={cn(
        INPUT_BASE,
        "min-h-[84px] resize-y",
        hasError && "border-[#EF4444] focus:border-[#EF4444] focus:ring-[#EF4444]/20",
        className
      )}
      {...rest}
    />
  );
}

export interface SelectOption {
  label: string;
  value: string;
}

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  hasError?: boolean | undefined;
  options?: SelectOption[] | undefined;
  placeholder?: string | undefined;
}

export function Select({
  hasError,
  options,
  placeholder,
  className,
  children,
  ...rest
}: SelectProps) {
  return (
    <select
      className={cn(
        INPUT_BASE,
        "pr-8",
        hasError && "border-[#EF4444] focus:border-[#EF4444] focus:ring-[#EF4444]/20",
        className
      )}
      {...rest}
    >
      {placeholder && <option value="">{placeholder}</option>}
      {options
        ? options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))
        : children}
    </select>
  );
}

export interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string | undefined;
  className?: string | undefined;
  ariaLabel?: string | undefined;
}

export function SearchInput({
  value,
  onChange,
  placeholder = "Search...",
  className,
  ariaLabel = "Search",
}: SearchInputProps) {
  return (
    <div className={cn("relative flex items-center", className)}>
      <SearchIcon size={16} className="pointer-events-none absolute left-3.5 text-[#64786E]" />
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={ariaLabel}
        className={cn(INPUT_BASE, "pl-9 pr-9")}
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange("")}
          aria-label="Clear search"
          className="absolute right-2.5 rounded-md p-1 text-[#64786E] hover:bg-[#F5F7F6] hover:text-[#0D2621] cursor-pointer"
        >
          <CloseIcon size={14} />
        </button>
      )}
    </div>
  );
}

export interface DateInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "type"> {
  hasError?: boolean | undefined;
}

export function DateInput({ hasError, className, ...rest }: DateInputProps) {
  return <Input type="date" hasError={hasError} className={className} {...rest} />;
}

export interface DateRangePickerProps {
  from: string;
  to: string;
  onFromChange: (val: string) => void;
  onToChange: (val: string) => void;
  className?: string | undefined;
}

export function DateRangePicker({
  from,
  to,
  onFromChange,
  onToChange,
  className,
}: DateRangePickerProps) {
  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      <DateInput value={from} onChange={(e) => onFromChange(e.target.value)} aria-label="From date" className="w-40" />
      <span className="text-xs font-medium text-[#64786E]">to</span>
      <DateInput value={to} onChange={(e) => onToChange(e.target.value)} aria-label="To date" className="w-40" />
    </div>
  );
}

export interface SwitchProps {
  checked: boolean;
  onCheckedChange: (next: boolean) => void;
  disabled?: boolean | undefined;
  label?: string | undefined;
  description?: string | undefined;
}

export function Switch({ checked, onCheckedChange, disabled, label, description }: SwitchProps) {
  return (
    <label className={cn("inline-flex items-center gap-3", disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer")}>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onCheckedChange(!checked)}
        className={cn(
          "relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#235347]/40",
          checked ? "bg-[#235347]" : "bg-[#D2DDD8]"
        )}
      >
        <span
          className={cn(
            "pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow transition-transform",
            checked ? "translate-x-5" : "translate-x-0"
          )}
        />
      </button>
      {(label || description) && (
        <span className="flex flex-col">
          {label && <span className="text-sm font-semibold text-[#0D2621]">{label}</span>}
          {description && <span className="text-xs text-[#64786E]">{description}</span>}
        </span>
      )}
    </label>
  );
}
