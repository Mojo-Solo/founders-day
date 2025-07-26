import { defineParameterType } from '@cucumber/cucumber';

// Define custom parameter types for better readability in step definitions

defineParameterType({
  name: 'role',
  regexp: /admin|volunteer|attendee|sponsor/,
  transformer: (role: string) => role
});

defineParameterType({
  name: 'ticketType',
  regexp: /individual|group|vip|sponsor/,
  transformer: (type: string) => type
});

defineParameterType({
  name: 'paymentMethod',
  regexp: /card|cash|check|online/,
  transformer: (method: string) => method
});

defineParameterType({
  name: 'eventName',
  regexp: /"([^"]*)"/,
  transformer: (name: string) => name
});

defineParameterType({
  name: 'amount',
  regexp: /\$?(\d+(?:\.\d{2})?)/,
  transformer: (amount: string) => parseFloat(amount.replace('$', ''))
});

defineParameterType({
  name: 'email',
  regexp: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/,
  transformer: (email: string) => email.toLowerCase()
});