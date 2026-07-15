const CAMPAIGN_STATES = new Set(['draft', 'scheduled', 'sending', 'sent', 'partially_failed', 'cancelled']);

function parseSchedule(value, now = new Date()) {
  const scheduledAt = new Date(value);
  if (!value || Number.isNaN(scheduledAt.getTime())) return { error: 'Enter a valid schedule date and time' };
  if (scheduledAt.getTime() <= now.getTime()) return { error: 'Schedule time must be in the future' };
  return { value: scheduledAt };
}

function canTransition(from, to) {
  const transitions = {
    draft: new Set(['scheduled', 'sending', 'cancelled']),
    scheduled: new Set(['draft', 'sending', 'cancelled']),
    sending: new Set(['sent', 'partially_failed']),
    sent: new Set(),
    partially_failed: new Set(),
    cancelled: new Set(['draft'])
  };
  return CAMPAIGN_STATES.has(from) && CAMPAIGN_STATES.has(to) && transitions[from].has(to);
}

module.exports = { canTransition, parseSchedule };
