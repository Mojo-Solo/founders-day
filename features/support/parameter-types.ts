import { defineParameterType } from '@cucumber/cucumber';

// Define parameter type for dollar amounts like $75, $65.00
defineParameterType({
  name: 'amount',
  regexp: /\$\d+(?:\.\d{2})?/,
  transformer: (s: string) => parseFloat(s.replace('$', ''))
});

// Define parameter type for ticket types
defineParameterType({
  name: 'ticketType',
  regexp: /individual|couple|table/,
  transformer: (s: string) => s
});

// Define parameter type for event names
defineParameterType({
  name: 'eventName',
  regexp: /[A-Z][a-z]+(?: [A-Z][a-z]+)*/,
  transformer: (s: string) => s
});