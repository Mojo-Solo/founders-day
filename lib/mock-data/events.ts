export interface MockEvent {
  id: string;
  name: string;
  date: string;
  category: string;
  status: 'Upcoming' | 'Past' | 'Ongoing';
  price?: number;
  priceRange?: string;
  description: string;
  location?: string;
  ticketAvailability?: boolean;
  image?: string;
  tags?: string[];
}

export const mockEvents: MockEvent[] = [
  {
    id: 'founders-day-gala-2025',
    name: 'Founders Day Gala 2025',
    date: '2025-06-15',
    category: 'Gala',
    status: 'Upcoming',
    price: 150,
    priceRange: '$100-$200',
    description: 'Join us for an elegant evening celebrating our founders with dinner, dancing, and entertainment.',
    location: 'Grand Ballroom, Minneapolis Convention Center',
    ticketAvailability: true,
    image: '/images/gala-2025.jpg',
    tags: ['formal', 'dinner', 'dancing', 'celebration', 'founders']
  },
  {
    id: 'summer-golf-tournament',
    name: 'Summer Golf Tournament',
    date: '2025-07-20',
    category: 'Sports',
    status: 'Upcoming',
    price: 125,
    priceRange: '$50-$200',
    description: 'Annual golf tournament featuring 18 holes, lunch, and prizes for winners.',
    location: 'Hazeltine National Golf Club',
    ticketAvailability: true,
    image: '/images/golf-tournament.jpg',
    tags: ['golf', 'tournament', 'sports', 'outdoor', 'prizes', 'lunch']
  },
  {
    id: 'winter-charity-auction',
    name: 'Winter Charity Auction',
    date: '2024-12-10',
    category: 'Fundraiser',
    status: 'Past',
    price: 75,
    priceRange: '$50-$100',
    description: 'Successful charity auction that raised funds for local community programs.',
    location: 'Community Center Auditorium',
    ticketAvailability: false,
    image: '/images/charity-auction.jpg',
    tags: ['charity', 'auction', 'fundraising', 'community', 'winter']
  },
  {
    id: 'spring-volunteer-drive',
    name: 'Spring Volunteer Drive',
    date: '2025-04-05',
    category: 'Community',
    status: 'Upcoming',
    price: 0,
    priceRange: 'Free',
    description: 'Community volunteer opportunity to help with local outreach programs and initiatives.',
    location: 'Multiple Community Locations',
    ticketAvailability: true,
    image: '/images/volunteer-drive.jpg',
    tags: ['volunteer', 'community', 'service', 'outreach', 'spring', 'free']
  },
  // Additional events for more comprehensive search testing
  {
    id: 'founders-day-history-talk',
    name: 'Founders Day History',
    date: '2025-05-10',
    category: 'Educational',
    status: 'Upcoming',
    price: 25,
    priceRange: '$20-$30',
    description: 'Learn about the history and founding of our organization with special guest speakers.',
    location: 'Main Library Conference Room',
    ticketAvailability: true,
    image: '/images/history-talk.jpg',
    tags: ['history', 'educational', 'founders', 'speakers', 'learning']
  },
  {
    id: 'founding-members-reunion',
    name: 'Founding Members',
    date: '2025-08-15',
    category: 'Social',
    status: 'Upcoming',
    price: 50,
    priceRange: '$40-$60',
    description: 'Special reunion event for founding members and their families.',
    location: 'Historic Society Building',
    ticketAvailability: true,
    image: '/images/founding-members.jpg',
    tags: ['founding', 'members', 'reunion', 'family', 'historic']
  }
];

export const getEventById = (id: string): MockEvent | undefined => {
  return mockEvents.find(event => event.id === id);
};

export const getEventsByCategory = (category: string): MockEvent[] => {
  return mockEvents.filter(event => 
    event.category.toLowerCase() === category.toLowerCase()
  );
};

export const getEventsByStatus = (status: string): MockEvent[] => {
  return mockEvents.filter(event => 
    event.status.toLowerCase() === status.toLowerCase()
  );
};

export const searchEvents = (query: string): MockEvent[] => {
  if (!query.trim()) return mockEvents;
  
  const searchTerm = query.toLowerCase();
  
  return mockEvents.filter(event => 
    event.name.toLowerCase().includes(searchTerm) ||
    event.description.toLowerCase().includes(searchTerm) ||
    event.category.toLowerCase().includes(searchTerm) ||
    event.location?.toLowerCase().includes(searchTerm) ||
    event.tags?.some(tag => tag.toLowerCase().includes(searchTerm))
  );
};

export const filterEvents = (filters: {
  category?: string;
  status?: string;
  dateRange?: string;
  priceRange?: string;
  ticketAvailability?: boolean;
}): MockEvent[] => {
  return mockEvents.filter(event => {
    if (filters.category && event.category.toLowerCase() !== filters.category.toLowerCase()) {
      return false;
    }
    
    if (filters.status && event.status.toLowerCase() !== filters.status.toLowerCase()) {
      return false;
    }
    
    if (filters.ticketAvailability !== undefined && event.ticketAvailability !== filters.ticketAvailability) {
      return false;
    }
    
    // Date range filtering (simplified)
    if (filters.dateRange) {
      const eventDate = new Date(event.date);
      const now = new Date();
      
      switch (filters.dateRange.toLowerCase()) {
        case 'next 6 months':
          const sixMonthsFromNow = new Date();
          sixMonthsFromNow.setMonth(now.getMonth() + 6);
          if (eventDate < now || eventDate > sixMonthsFromNow) return false;
          break;
        case 'this year':
          if (eventDate.getFullYear() !== now.getFullYear()) return false;
          break;
      }
    }
    
    return true;
  });
};

export const getEventCategories = (): string[] => {
  return [...new Set(mockEvents.map(event => event.category))];
};

export const getEventStatuses = (): string[] => {
  return [...new Set(mockEvents.map(event => event.status))];
};