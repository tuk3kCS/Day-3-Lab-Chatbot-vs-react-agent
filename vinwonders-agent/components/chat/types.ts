import type { Destination } from '@/lib/mockData';

export type { Destination };

export type SearchResult = { results: Destination[] };

export type EmergencyResult = {
  status: string;
  ticketId: string;
  type: string;
  message: string;
  contact?: {
    name: string;
    location?: string;
    contact_number?: string;
  };
};

export type TransportTicketResult = {
  status: 'success' | 'error';
  ticketId: string;
  from: string;
  to: string;
  route: string;
  departureTime: string;
  quantity: number;
  passengerType: string;
  pricePerTicket: number;
  totalPrice: number;
  boardingPoint: string;
  message: string;
};
