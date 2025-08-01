"use client"

import { useState, useEffect, useRef } from "react"
import { Search, Clock } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { searchEvents, type MockEvent } from "@/lib/mock-data/events"

interface SearchAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  onSelect?: (event: MockEvent) => void;
  placeholder?: string;
  className?: string;
}

export default function SearchAutocomplete({
  value,
  onChange,
  onSelect,
  placeholder = "Search events, activities, and more...",
  className = ""
}: SearchAutocompleteProps) {
  const [suggestions, setSuggestions] = useState<MockEvent[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [activeSuggestion, setActiveSuggestion] = useState(-1)
  const [recentSearches, setRecentSearches] = useState<string[]>([])
  const inputRef = useRef<HTMLInputElement>(null)
  const suggestionsRef = useRef<HTMLDivElement>(null)

  // Load recent searches on mount
  useEffect(() => {
    const saved = localStorage.getItem('recentSearches')
    if (saved) {
      setRecentSearches(JSON.parse(saved))
    }
  }, [])

  // Generate suggestions based on input
  useEffect(() => {
    if (value.trim().length >= 2) {
      const results = searchEvents(value).slice(0, 5) // Limit to 5 suggestions
      setSuggestions(results)
      setShowSuggestions(true)
      setActiveSuggestion(-1)
    } else {
      setSuggestions([])
      setShowSuggestions(false)
    }
  }, [value])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!showSuggestions) return

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setActiveSuggestion(prev => 
          prev < suggestions.length - 1 ? prev + 1 : prev
        )
        break
      case 'ArrowUp':
        e.preventDefault()
        setActiveSuggestion(prev => prev > 0 ? prev - 1 : -1)
        break
      case 'Enter':
        e.preventDefault()
        if (activeSuggestion >= 0 && suggestions[activeSuggestion]) {
          handleSuggestionSelect(suggestions[activeSuggestion])
        }
        break
      case 'Escape':
        setShowSuggestions(false)
        setActiveSuggestion(-1)
        break
    }
  }

  const handleSuggestionSelect = (event: MockEvent) => {
    onChange(event.name)
    setShowSuggestions(false)
    setActiveSuggestion(-1)
    
    // Save to recent searches
    const updated = [event.name, ...recentSearches.filter(s => s !== event.name)].slice(0, 5)
    setRecentSearches(updated)
    localStorage.setItem('recentSearches', JSON.stringify(updated))
    
    if (onSelect) {
      onSelect(event)
    }
  }

  const handleRecentSearchSelect = (search: string) => {
    onChange(search)
    setShowSuggestions(false)
  }

  const handleInputFocus = () => {
    if (value.trim().length >= 2) {
      setShowSuggestions(true)
    } else if (recentSearches.length > 0) {
      setShowSuggestions(true)
    }
  }

  const handleInputBlur = () => {
    // Delay hiding suggestions to allow for clicks
    setTimeout(() => {
      setShowSuggestions(false)
      setActiveSuggestion(-1)
    }, 200)
  }

  const highlightText = (text: string, query: string) => {
    if (!query.trim()) return text
    
    const regex = new RegExp(`(${query})`, 'gi')
    const parts = text.split(regex)
    
    return parts.map((part, index) => 
      regex.test(part) ? (
        <mark key={index} className="bg-yellow-200 text-yellow-900 px-1 rounded">
          {part}
        </mark>
      ) : part
    )
  }

  return (
    <div className={`relative ${className}`}>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
        <Input
          ref={inputRef}
          type="search"
          placeholder={placeholder}
          className="pl-12 pr-4"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={handleInputFocus}
          onBlur={handleInputBlur}
          data-testid="search-input"
          autoComplete="off"
        />
      </div>

      {/* Autocomplete Dropdown */}
      {showSuggestions && (
        <div 
          ref={suggestionsRef}
          className="absolute top-full left-0 right-0 z-50 bg-white border border-gray-200 rounded-md shadow-lg mt-1 max-h-96 overflow-y-auto"
          data-testid="autocomplete"
        >
          {/* Recent Searches */}
          {!value.trim() && recentSearches.length > 0 && (
            <div className="p-3 border-b border-gray-100">
              <div className="flex items-center text-sm text-gray-600 mb-2">
                <Clock className="h-4 w-4 mr-2" />
                Recent Searches
              </div>
              <div className="space-y-1">
                {recentSearches.map((search, index) => (
                  <button
                    key={index}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 rounded transition-colors"
                    onClick={() => handleRecentSearchSelect(search)}
                  >
                    {search}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Search Suggestions */}
          {suggestions.length > 0 && (
            <div className="p-2">
              {value.trim() && (
                <div className="px-3 py-2 text-xs text-gray-500 font-medium">
                  Suggestions
                </div>
              )}
              {suggestions.map((event, index) => (
                <button
                  key={event.id}
                  className={`w-full text-left px-3 py-3 rounded transition-colors ${
                    index === activeSuggestion 
                      ? 'bg-primary text-white' 
                      : 'hover:bg-gray-50'
                  }`}
                  onClick={() => handleSuggestionSelect(event)}
                >
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className={`font-medium ${
                        index === activeSuggestion ? 'text-white' : 'text-gray-900'
                      }`}>
                        {highlightText(event.name, value)}
                      </div>
                      <div className={`text-sm ${
                        index === activeSuggestion ? 'text-gray-200' : 'text-gray-600'
                      } mt-1`}>
                        {highlightText(event.description.slice(0, 80) + '...', value)}
                      </div>
                      <div className="flex items-center mt-2 space-x-2">
                        <Badge 
                          variant={index === activeSuggestion ? "secondary" : "outline"}
                          className="text-xs"
                        >
                          {event.category}
                        </Badge>
                        <span className={`text-xs ${
                          index === activeSuggestion ? 'text-gray-200' : 'text-gray-500'
                        }`}>
                          {new Date(event.date).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* No Results */}
          {value.trim() && suggestions.length === 0 && (
            <div className="p-4 text-center text-gray-500">
              <Search className="h-8 w-8 mx-auto mb-2 text-gray-300" />
              <div className="text-sm">No results found for "{value}"</div>
              <div className="text-xs text-gray-400 mt-1">
                Try different keywords or check your spelling
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}