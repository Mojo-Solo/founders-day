"use client"

import { notFound } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Calendar, MapPin, DollarSign, Users } from "lucide-react"
import { getEventById, type MockEvent } from "@/lib/mock-data/events"

interface EventPageProps {
  params: Promise<{
    id: string
  }>
}

export default async function EventPage({ params }: EventPageProps) {
  const resolvedParams = await params
  const event = getEventById(resolvedParams.id)

  if (!event) {
    notFound()
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex justify-between items-start mb-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">
                {event.name}
              </h1>
              <div className="flex items-center space-x-3">
                <Badge variant={event.status === 'Upcoming' ? 'default' : 'secondary'}>
                  {event.status}
                </Badge>
                <Badge variant="outline">
                  {event.category}
                </Badge>
              </div>
            </div>
            {event.status === 'Upcoming' && event.ticketAvailability && (
              <Button size="lg" className="bg-primary hover:bg-primary/90">
                Register Now
              </Button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2">
            <Card className="mb-6">
              <CardHeader>
                <CardTitle>About This Event</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-700 leading-relaxed">
                  {event.description}
                </p>
              </CardContent>
            </Card>

            {event.tags && event.tags.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Event Tags</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    {event.tags.map((tag, index) => (
                      <Badge key={index} variant="outline">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Sidebar */}
          <div className="lg:col-span-1">
            <Card className="mb-6">
              <CardHeader>
                <CardTitle>Event Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center space-x-3">
                  <Calendar className="h-5 w-5 text-gray-400" />
                  <div>
                    <div className="font-medium">
                      {new Date(event.date).toLocaleDateString('en-US', {
                        weekday: 'long',
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric'
                      })}
                    </div>
                    <div className="text-sm text-gray-600">
                      {new Date(event.date).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: '2-digit',
                        day: '2-digit'
                      })}
                    </div>
                  </div>
                </div>

                {event.location && (
                  <div className="flex items-center space-x-3">
                    <MapPin className="h-5 w-5 text-gray-400" />
                    <div>
                      <div className="font-medium">Location</div>
                      <div className="text-sm text-gray-600">
                        {event.location}
                      </div>
                    </div>
                  </div>
                )}

                <div className="flex items-center space-x-3">
                  <DollarSign className="h-5 w-5 text-gray-400" />
                  <div>
                    <div className="font-medium">Price</div>
                    <div className="text-sm text-gray-600">
                      {event.priceRange}
                    </div>
                  </div>
                </div>

                <div className="flex items-center space-x-3">
                  <Users className="h-5 w-5 text-gray-400" />
                  <div>
                    <div className="font-medium">Availability</div>
                    <div className="text-sm text-gray-600">
                      {event.ticketAvailability ? 'Tickets Available' : 'Sold Out'}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {event.status === 'Upcoming' && event.ticketAvailability && (
              <Card>
                <CardHeader>
                  <CardTitle>Register for Event</CardTitle>
                </CardHeader>
                <CardContent>
                  <Button className="w-full bg-primary hover:bg-primary/90">
                    Get Tickets
                  </Button>
                  <p className="text-xs text-gray-600 mt-2 text-center">
                    Secure checkout powered by our registration system
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}