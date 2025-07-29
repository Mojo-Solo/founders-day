#\!/bin/bash

# 🚀 RUN ALL BDD TESTS WITH ONE COMMAND
echo "🧪 RUNNING ALL BDD TESTS..."
echo "================================"

# Run smoke tests without servers
START_SERVERS=false CUCUMBER_PROFILE=smoke npm run test:cucumber:smoke

# Show summary
echo ""
echo "📊 TEST COMPLETE\!"
echo "================================"
echo "To run specific tests:"
echo "  • Profile only: npm run test:cucumber features/profile-management.feature"
echo "  • Registration only: npm run test:cucumber features/registration/individual-registration.feature"
echo "  • With HTML report: npm run test:cucumber:report"
echo ""
# Status is shown in the cucumber output above
