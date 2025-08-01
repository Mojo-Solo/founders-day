import Link from 'next/link'

export default function Navigation() {
  return (
    <nav className="flex items-center justify-between p-4 border-b">
      <Link href="/" className="text-xl font-bold">
        Founders Day
      </Link>
      <div className="flex gap-4">
        <Link href="/events" className="hover:underline">
          Events
        </Link>
        <Link href="/gala" className="hover:underline">
          Gala
        </Link>
        <Link href="/contact" className="hover:underline">
          Contact
        </Link>
      </div>
    </nav>
  )
}