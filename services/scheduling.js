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

async function runDueCampaigns(db, deliver) {
  const [jobs] = await db.query(
    "SELECT id FROM email_jobs WHERE status = 'scheduled' AND scheduled_at <= NOW() ORDER BY scheduled_at LIMIT 10"
  );
  let processed = 0;
  for (const job of jobs) {
    const [claim] = await db.query(
      "UPDATE email_jobs SET status = 'sending', started_at = NOW() WHERE id = ? AND status = 'scheduled'",
      [job.id]
    );
    if (!claim.affectedRows) continue;
    try {
      await deliver(db, job.id);
    } catch (error) {
      await db.query("UPDATE email_jobs SET status = 'partially_failed', completed_at = NOW() WHERE id = ?", [job.id]);
      console.error(`Scheduled campaign ${job.id} failed:`, error);
    }
    processed++;
  }
  return processed;
}

module.exports.runDueCampaigns = runDueCampaigns;
