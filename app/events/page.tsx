import Navigation from "@/components/navigation"

export default function EventsPage() {
  return (
    <div className="min-h-screen bg-white">
      <Navigation />
      <main className="max-w-7xl mx-auto px-4 py-16">
        <h1 className="text-4xl font-bold mb-8">Events</h1>
        <p className="text-lg text-gray-600">Upcoming events and activities.</p>
      </main>
    </div>
  )
}