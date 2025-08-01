"use client"

import { useState, useEffect, useCallback } from "react"
import { Search, X, Filter, Clock } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import SearchAutocomplete from "@/components/search-autocomplete"
import { searchEvents, filterEvents, getEventCategories, getEventStatuses, type MockEvent } from "@/lib/mock-data/events"

interface SearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  children?: React.ReactNode;
}

export default function SearchModal({ isOpen, onClose, children }: SearchModalProps) {
  const [searchQuery, setSearchQuery] = useState("")
  const [searchResults, setSearchResults] = useState<MockEvent[]>([])
  const [recentSearches, setRecentSearches] = useState<string[]>([])
  const [showFilters, setShowFilters] = useState(false)
  const [filters, setFilters] = useState({
    category: "",
    status: "",
    dateRange: "",
  })

  // Load recent searches from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem('recentSearches')
    if (saved) {
      setRecentSearches(JSON.parse(saved))
    }
  }, [])

  // Save search to recent searches
  const saveRecentSearch = useCallback((query: string) => {
    if (!query.trim()) return
    
    const updated = [query, ...recentSearches.filter(s => s !== query)].slice(0, 5)
    setRecentSearches(updated)
    localStorage.setItem('recentSearches', JSON.stringify(updated))
  }, [recentSearches])

  // Perform search with debouncing
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (searchQuery.trim()) {
        let results = searchEvents(searchQuery)
        
        // Apply filters if any are set
        if (filters.category || filters.status || filters.dateRange) {
          results = filterEvents({
            ...filters,
            category: filters.category || undefined,
            status: filters.status || undefined,
            dateRange: filters.dateRange || undefined,
          }).filter(event => 
            searchEvents(searchQuery).some(searchResult => searchResult.id === event.id)
          )
        }
        
        setSearchResults(results)
      } else {
        setSearchResults([])
      }
    }, 300)

    return () => clearTimeout(timeoutId)
  }, [searchQuery, filters])

  const handleSearch = (query: string) => {
    setSearchQuery(query)
    if (query.trim()) {
      saveRecentSearch(query)
    }
  }

  const handleRecentSearchClick = (query: string) => {
    setSearchQuery(query)
    saveRecentSearch(query)
  }

  const highlightText = (text: string, query: string) => {
    if (!query.trim()) return text
    
    const regex = new RegExp(`(${query})`, 'gi')
    const parts = text.split(regex)
    
    return parts.map((part, index) => 
      regex.test(part) ? (
        <mark key={index} className="bg-yellow-200 text-yellow-900 px-1 rounded" data-testid="search-highlight">
          {part}
        </mark>
      ) : part
    )
  }

  const clearFilters = () => {
    setFilters({
      category: "",
      status: "",
      dateRange: "",
    })
  }

  const hasActiveFilters = filters.category || filters.status || filters.dateRange

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetTrigger asChild>
        {children}
      </SheetTrigger>
      <SheetContent side="top" className="h-full search-overlay" data-testid="search-overlay">
        <SheetHeader className="border-b pb-4">
          <div className="flex items-center space-x-4">
            <div className="flex-1">
              <SearchAutocomplete
                value={searchQuery}
                onChange={handleSearch}
                onSelect={(event) => {
                  // Navigate to event page or gala page for "gala" events
                  if (event.name.toLowerCase().includes('gala')) {
                    window.location.href = '/gala'
                  } else {
                    window.location.href = `/events/${event.id}`
                  }
                }}
                className="w-full"
              />
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowFilters(!showFilters)}
              className={`${hasActiveFilters ? 'border-primary text-primary' : ''}`}
            >
              <Filter className="h-4 w-4 mr-2" />
              Filters
              {hasActiveFilters && (
                <Badge variant="secondary" className="ml-2 px-1.5 py-0.5 text-xs">
                  {Object.values(filters).filter(Boolean).length}
                </Badge>
              )}
            </Button>
          </div>
          
          {/* Filters Panel */}
          {showFilters && (
            <div className="mt-4 p-4 bg-gray-50 rounded-lg" data-testid="search-filters">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Category</label>
                  <select
                    className="w-full p-2 border rounded-md"
                    value={filters.category}
                    onChange={(e) => setFilters(prev => ({ ...prev, category: e.target.value }))}
                    data-testid="filter-category"
                  >
                    <option value="">All Categories</option>
                    {getEventCategories().map(category => (
                      <option key={category} value={category}>{category}</option>
                    ))}
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium mb-2">Status</label>
                  <select
                    className="w-full p-2 border rounded-md"
                    value={filters.status}
                    onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value }))}
                    data-testid="filter-status"
                  >
                    <option value="">All Statuses</option>
                    {getEventStatuses().map(status => (
                      <option key={status} value={status}>{status}</option>
                    ))}
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium mb-2">Date Range</label>
                  <select
                    className="w-full p-2 border rounded-md"
                    value={filters.dateRange}
                    onChange={(e) => setFilters(prev => ({ ...prev, dateRange: e.target.value }))}
                    data-testid="filter-date-range"
                  >
                    <option value="">All Dates</option>
                    <option value="Next 6 months">Next 6 months</option>
                    <option value="This year">This year</option>
                  </select>
                </div>
              </div>
              
              {hasActiveFilters && (
                <div className="mt-4 flex justify-between items-center">
                  <div className="flex flex-wrap gap-2">
                    {filters.category && (
                      <Badge variant="outline">
                        Category: {filters.category}
                        <button
                          onClick={() => setFilters(prev => ({ ...prev, category: "" }))}
                          className="ml-1 hover:text-red-500"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    )}
                    {filters.status && (
                      <Badge variant="outline">
                        Status: {filters.status}
                        <button
                          onClick={() => setFilters(prev => ({ ...prev, status: "" }))}
                          className="ml-1 hover:text-red-500"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    )}
                    {filters.dateRange && (
                      <Badge variant="outline">
                        Date: {filters.dateRange}
                        <button
                          onClick={() => setFilters(prev => ({ ...prev, dateRange: "" }))}
                          className="ml-1 hover:text-red-500"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    )}
                  </div>
                  <Button variant="ghost" size="sm" onClick={clearFilters}>
                    Clear All
                  </Button>
                </div>
              )}
            </div>
          )}
        </SheetHeader>

        <div className="mt-6 flex-1 overflow-y-auto">
          {/* Recent Searches */}
          {!searchQuery && recentSearches.length > 0 && (
            <div className="mb-6" data-testid="recent-searches">
              <h3 className="text-sm font-medium text-gray-700 mb-3 flex items-center">
                <Clock className="h-4 w-4 mr-2" />
                Recent Searches
              </h3>
              <div className="flex flex-wrap gap-2">
                {recentSearches.map((search, index) => (
                  <Button
                    key={index}
                    variant="outline"
                    size="sm"
                    onClick={() => handleRecentSearchClick(search)}
                    className="text-sm"
                  >
                    {search}
                  </Button>
                ))}
              </div>
            </div>
          )}

          {/* Search Results */}
          {searchQuery && (
            <div data-testid="search-results" className="search-results">
              <div className="mb-4 flex justify-between items-center">
                <h3 className="text-lg font-semibold">
                  {searchResults.length === 1 ? "1 result found" : `${searchResults.length} results found`}
                </h3>
              </div>

              {searchResults.length === 0 ? (
                <div className="text-center py-12" data-testid="search-suggestions">
                  <Search className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">
                    No results found for '{searchQuery}'
                  </h3>
                  <div className="text-sm text-gray-600 space-y-1">
                    <p>Try different keywords</p>
                    <p>Remove some filters</p>
                    <p>Browse all events</p>
                  </div>
                </div>
              ) : (
                <div className="space-y-4 search-result-list">
                  {searchResults.map((event) => (
                    <div
                      key={event.id}
                      className="p-4 border border-gray-200 rounded-lg hover:shadow-md transition-shadow cursor-pointer search-result-item"
                      onClick={() => {
                        // Navigate to event page
                        window.location.href = `/events/${event.id}`
                      }}
                    >
                      <div className="flex justify-between items-start mb-2">
                        <h4 className="text-lg font-semibold text-gray-900">
                          {highlightText(event.name, searchQuery)}
                        </h4>
                        <div className="flex items-center space-x-2">
                          <Badge variant={event.status === 'Upcoming' ? 'default' : 'secondary'}>
                            {event.status}
                          </Badge>
                          <Badge variant="outline">
                            {event.category}
                          </Badge>
                        </div>
                      </div>
                      
                      <p className="text-gray-600 mb-3">
                        {highlightText(event.description, searchQuery)}
                      </p>
                      
                      <div className="flex justify-between items-center text-sm text-gray-500">
                        <span>{new Date(event.date).toLocaleDateString()}</span>
                        <span className="font-semibold text-primary">
                          {event.priceRange}
                        </span>
                      </div>
                      
                      {event.location && (
                        <div className="mt-2 text-sm text-gray-500">
                          📍 {highlightText(event.location, searchQuery)}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Empty State */}
          {!searchQuery && recentSearches.length === 0 && (
            <div className="text-center py-12">
              <Search className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                Search for events and activities
              </h3>
              <p className="text-sm text-gray-600">
                Find what you're looking for with our powerful search
              </p>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}