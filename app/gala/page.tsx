"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Calendar, MapPin, DollarSign, Users, Star } from "lucide-react"

export default function GalaPage() {
  const galaEvent = {
    name: 'Founders Day Gala 2025',
    date: '2025-06-15',
    category: 'Gala',
    status: 'Upcoming',
    price: 150,
    priceRange: '$100-$200',
    description: 'Join us for an elegant evening celebrating our founders with dinner, dancing, and entertainment. This premier event brings together our community to honor the legacy of our founders while creating new memories.',
    location: 'Grand Ballroom, Minneapolis Convention Center',
    ticketAvailability: true,
    image: '/images/gala-2025.jpg',
    tags: ['formal', 'dinner', 'dancing', 'celebration', 'founders']
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Hero Section */}
        <div className="bg-gradient-to-r from-primary to-primary/80 text-white rounded-lg p-8 mb-8">
          <div className="max-w-3xl">
            <div className="flex items-center space-x-2 mb-4">
              <Star className="h-6 w-6" />
              <Badge variant="secondary" className="text-primary">
                Premier Event
              </Badge>
            </div>
            <h1 className="text-4xl font-bold mb-4">
              {galaEvent.name}
            </h1>
            <p className="text-xl opacity-90 mb-6">
              An elegant evening celebrating our founders with dinner, dancing, and entertainment
            </p>
            <div className="flex items-center space-x-6 text-lg">
              <div className="flex items-center space-x-2">
                <Calendar className="h-5 w-5" />
                <span>June 15, 2025</span>
              </div>
              <div className="flex items-center space-x-2">
                <MapPin className="h-5 w-5" />
                <span>Minneapolis Convention Center</span>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-2xl">About the Gala</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-gray-700 leading-relaxed">
                  {galaEvent.description}
                </p>
                <p className="text-gray-700 leading-relaxed">
                  This year's gala promises to be our most spectacular yet, featuring a gourmet dinner, 
                  live entertainment, and special presentations honoring our founding members. Dress code 
                  is formal attire.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Event Highlights</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="flex items-center space-x-3">
                    <div className="w-2 h-2 bg-primary rounded-full"></div>
                    <span>Cocktail Reception</span>
                  </div>
                  <div className="flex items-center space-x-3">
                    <div className="w-2 h-2 bg-primary rounded-full"></div>
                    <span>Gourmet Dinner</span>
                  </div>
                  <div className="flex items-center space-x-3">
                    <div className="w-2 h-2 bg-primary rounded-full"></div>
                    <span>Live Entertainment</span>
                  </div>
                  <div className="flex items-center space-x-3">
                    <div className="w-2 h-2 bg-primary rounded-full"></div>
                    <span>Dancing</span>
                  </div>
                  <div className="flex items-center space-x-3">
                    <div className="w-2 h-2 bg-primary rounded-full"></div>
                    <span>Awards Ceremony</span>
                  </div>
                  <div className="flex items-center space-x-3">
                    <div className="w-2 h-2 bg-primary rounded-full"></div>
                    <span>Silent Auction</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Event Tags</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {galaEvent.tags.map((tag, index) => (
                    <Badge key={index} variant="outline" className="capitalize">
                      {tag}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="lg:col-span-1 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Event Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center space-x-3">
                  <Calendar className="h-5 w-5 text-gray-400" />
                  <div>
                    <div className="font-medium">Date & Time</div>
                    <div className="text-sm text-gray-600">
                      Sunday, June 15, 2025
                    </div>
                    <div className="text-sm text-gray-600">
                      6:00 PM - 11:00 PM
                    </div>
                  </div>
                </div>

                <div className="flex items-center space-x-3">
                  <MapPin className="h-5 w-5 text-gray-400" />
                  <div>
                    <div className="font-medium">Location</div>
                    <div className="text-sm text-gray-600">
                      Grand Ballroom<br />
                      Minneapolis Convention Center
                    </div>
                  </div>
                </div>

                <div className="flex items-center space-x-3">
                  <DollarSign className="h-5 w-5 text-gray-400" />
                  <div>
                    <div className="font-medium">Ticket Price</div>
                    <div className="text-sm text-gray-600">
                      {galaEvent.priceRange}
                    </div>
                  </div>
                </div>

                <div className="flex items-center space-x-3">
                  <Users className="h-5 w-5 text-gray-400" />
                  <div>
                    <div className="font-medium">Availability</div>
                    <div className="text-sm text-gray-600">
                      <Badge variant="default" className="text-xs">
                        Tickets Available
                      </Badge>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Get Your Tickets</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-primary mb-2">
                    ${galaEvent.price}
                  </div>
                  <div className="text-sm text-gray-600 mb-4">
                    per person
                  </div>
                </div>
                <Button className="w-full bg-primary hover:bg-primary/90 text-lg py-3">
                  Reserve Your Seats
                </Button>
                <p className="text-xs text-gray-600 text-center">
                  Includes dinner, entertainment, and dancing
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Dress Code</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-center">
                  <div className="text-lg font-semibold mb-2">Formal Attire</div>
                  <div className="text-sm text-gray-600">
                    Cocktail dresses, evening gowns, suits, and tuxedos welcome
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}