"use client"

import { Search } from "lucide-react"
import { Button } from "@/components/ui/button"

interface SearchIconProps {
  onClick: () => void;
  className?: string;
}

export default function SearchIcon({ onClick, className = "" }: SearchIconProps) {
  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={onClick}
      className={`p-2 hover:bg-gray-100 rounded-full ${className}`}
      aria-label="Open search"
      data-testid="search-icon"
    >
      <Search className="h-5 w-5 text-gray-600 hover:text-primary" />
    </Button>
  )
}