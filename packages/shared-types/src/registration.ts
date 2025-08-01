export interface Registration {
  id: string;
  confirmationNumber?: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  homeGroup?: string;
  city?: string;
  state?: string;
  zip?: string;
  
  // Ticket information
  ticketType: string;
  eventTickets: number;
  banquetTickets: number;
  hotelRooms: number;
  
  // Financial
  amount: number;
  totalAmount: number;
  paymentStatus: 'pending' | 'completed' | 'failed' | 'refunded';
  paymentMethod: string;
  paymentId?: string;
  
  // Status
  status: 'pending' | 'confirmed' | 'cancelled' | 'refunded';
  checkedIn: boolean;
  
  // Additional information
  dietaryRestrictions?: string;
  accessibilityNeeds?: string;
  specialNeeds?: string;
  sobrietyDate?: string;
  emergencyContact?: string;
  emergencyPhone?: string;
  additionalNotes?: string;
  
  // System fields
  qrCode?: string;
  registrationDate: string;
  registeredAt: string;
  createdAt: string;
  updatedAt: string;
  
  // Additional attendees
  additionalAttendees?: Array<{
    firstName: string;
    lastName: string;
  }>;
  
  // Relations
  user?: {
    id: string;
    email: string;
  };
}

export interface RegistrationFormData {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  homeGroup?: string;
  city?: string;
  state?: string;
  zip?: string;
  ticketType: string;
  eventTickets: number;
  banquetTickets: number;
  hotelRooms: number;
  dietaryRestrictions?: string;
  accessibilityNeeds?: string;
  specialNeeds?: string;
  sobrietyDate?: string;
  emergencyContact?: string;
  emergencyPhone?: string;
  additionalNotes?: string;
  additionalAttendees?: Array<{
    firstName: string;
    lastName: string;
  }>;
}

export interface RegistrationStats {
  total: number;
  confirmed: number;
  pending: number;
  cancelled: number;
  revenue: {
    total: number;
    tickets: number;
    banquet: number;
    hotel: number;
  };
}

export interface RegistrationResponse {
  message: string;
  registration: Registration;
  error?: string;
}