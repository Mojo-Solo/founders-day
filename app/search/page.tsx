"use client"

import { useState, useEffect, useCallback, Suspense } from "react"
import { useSearchParams } from "next/navigation"
import { Search, Filter, X, Clock } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { searchEvents, filterEvents, getEventCategories, getEventStatuses, type MockEvent } from "@/lib/mock-data/events"

function SearchPageContent() {
  const searchParams = useSearchParams()
  const [searchQuery, setSearchQuery] = useState(searchParams.get('q') || "")
  const [searchResults, setSearchResults] = useState<MockEvent[]>([])
  const [recentSearches, setRecentSearches] = useState<string[]>([])
  const [showFilters, setShowFilters] = useState(false)
  const [filters, setFilters] = useState({
    category: searchParams.get('category') || "",
    status: searchParams.get('status') || "",
    dateRange: searchParams.get('dateRange') || "",
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
        saveRecentSearch(searchQuery)
      } else {
        setSearchResults([])
      }
    }, 300)

    return () => clearTimeout(timeoutId)
  }, [searchQuery, filters, saveRecentSearch])

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
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Search Header */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <div className="flex items-center space-x-4 mb-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
              <Input
                type="search"
                placeholder="Search events, activities, and more..."
                className="pl-12 pr-4 py-3 w-full text-lg"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                data-testid="search-input"
              />
            </div>
            <Button
              variant="outline"
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
            <div className="p-4 bg-gray-50 rounded-lg" data-testid="search-filters">
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
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Sidebar */}
          <div className="lg:col-span-1">
            {/* Recent Searches */}
            {recentSearches.length > 0 && (
              <Card className="mb-6" data-testid="recent-searches">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium flex items-center">
                    <Clock className="h-4 w-4 mr-2" />
                    Recent Searches
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {recentSearches.map((search, index) => (
                      <Button
                        key={index}
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRecentSearchClick(search)}
                        className="w-full justify-start text-sm"
                      >
                        {search}
                      </Button>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Search Scope Indicator */}
            <Card data-testid="search-scope">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">
                  Search Scope
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-600">
                  Searching in: All Events
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Main Content */}
          <div className="lg:col-span-3">
            {searchQuery ? (
              <div data-testid="search-results" className="search-results">
                <div className="mb-6 flex justify-between items-center">
                  <h1 className="text-2xl font-bold text-gray-900">
                    {searchResults.length === 1 ? "1 result found" : `${searchResults.length} results found`}
                  </h1>
                </div>

                {searchResults.length === 0 ? (
                  <Card>
                    <CardContent className="text-center py-12" data-testid="search-suggestions">
                      <Search className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                      <h3 className="text-lg font-medium text-gray-900 mb-2">
                        No results found for '{searchQuery}'
                      </h3>
                      <div className="text-sm text-gray-600 space-y-1">
                        <p>Try different keywords</p>
                        <p>Remove some filters</p>
                        <p>Browse all events</p>
                      </div>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="space-y-6 search-result-list">
                    {searchResults.map((event) => (
                      <Card
                        key={event.id}
                        className="hover:shadow-md transition-shadow cursor-pointer search-result-item"
                        onClick={() => {
                          // Navigate to event page or gala page for "gala" events
                          if (event.name.toLowerCase().includes('gala')) {
                            window.location.href = '/gala'
                          } else {
                            window.location.href = `/events/${event.id}`
                          }
                        }}
                      >
                        <CardContent className="p-6">
                          <div className="flex justify-between items-start mb-3">
                            <h2 className="text-xl font-semibold text-gray-900">
                              {highlightText(event.name, searchQuery)}
                            </h2>
                            <div className="flex items-center space-x-2">
                              <Badge variant={event.status === 'Upcoming' ? 'default' : 'secondary'}>
                                {event.status}
                              </Badge>
                              <Badge variant="outline">
                                {event.category}
                              </Badge>
                            </div>
                          </div>
                          
                          <p className="text-gray-600 mb-4 leading-relaxed">
                            {highlightText(event.description, searchQuery)}
                          </p>
                          
                          <div className="flex justify-between items-center text-sm text-gray-500 mb-3">
                            <span className="flex items-center">
                              📅 {new Date(event.date).toLocaleDateString('en-US', { 
                                weekday: 'long', 
                                year: 'numeric', 
                                month: 'long', 
                                day: 'numeric' 
                              })}
                            </span>
                            <span className="font-semibold text-primary text-lg">
                              {event.priceRange}
                            </span>
                          </div>
                          
                          {event.location && (
                            <div className="text-sm text-gray-500 mb-3">
                              📍 {highlightText(event.location, searchQuery)}
                            </div>
                          )}

                          {event.tags && event.tags.length > 0 && (
                            <div className="flex flex-wrap gap-2">
                              {event.tags.slice(0, 4).map((tag, index) => (
                                <Badge key={index} variant="outline" className="text-xs">
                                  {tag}
                                </Badge>
                              ))}
                              {event.tags.length > 4 && (
                                <Badge variant="outline" className="text-xs">
                                  +{event.tags.length - 4} more
                                </Badge>
                              )}
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <Card>
                <CardContent className="text-center py-12">
                  <Search className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <h1 className="text-2xl font-bold text-gray-900 mb-2">
                    Search Events & Activities
                  </h1>
                  <p className="text-gray-600 mb-6">
                    Find events, activities, and more using our powerful search
                  </p>
                  <div className="max-w-md mx-auto">
                    <Input
                      type="search"
                      placeholder="Start typing to search..."
                      className="w-full"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default function SearchPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Search className="h-8 w-8 text-gray-400 mx-auto mb-4 animate-pulse" />
          <p className="text-gray-600">Loading search...</p>
        </div>
      </div>
    }>
      <SearchPageContent />
    </Suspense>
  )
}