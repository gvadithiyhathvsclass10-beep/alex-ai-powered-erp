"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

export interface NumberInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type' | 'value' | 'onChange' | 'defaultValue'> {
  defaultValue?: string | number
  onChange: (value: string) => void
}

export function NumberInput({
  defaultValue,
  onChange,
  className,
  disabled,
  placeholder,
  ...props
}: NumberInputProps) {
  const ref = React.useRef<HTMLInputElement>(null)
  
  return (
    <input
      ref={ref}
      type="number"
      defaultValue={defaultValue}
      onChange={(e: React.ChangeEvent<HTMLInputElement>) => onChange(e.target.value)}
      disabled={disabled}
      placeholder={placeholder}
      className={cn(
        "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      {...props}
    />
  )
}