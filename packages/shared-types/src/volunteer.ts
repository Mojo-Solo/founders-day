export interface Volunteer {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  homeGroup?: string;
  city?: string;
  state?: string;
  availability: string[];
  skills?: string[];
  preferredTasks?: string[];
  experience?: string;
  status: 'pending' | 'approved' | 'rejected' | 'inactive';
  assignedShifts?: Shift[];
  createdAt: string;
  updatedAt: string;
}

export interface Shift {
  id: string;
  name: string;
  description: string;
  date: string;
  startTime: string;
  endTime: string;
  location: string;
  requiredVolunteers: number;
  assignedVolunteers: number;
  volunteers?: Volunteer[];
  status: 'open' | 'full' | 'cancelled';
  createdAt: string;
  updatedAt: string;
}

export interface VolunteerFormData {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  homeGroup?: string;
  city?: string;
  state?: string;
  availability: string[];
  skills?: string[];
  preferredTasks?: string[];
  experience?: string;
}