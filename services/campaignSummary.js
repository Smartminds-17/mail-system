function campaignSummary({ total, sent, failed, skipped }) {
  const parts = [`${total} recipient${total === 1 ? '' : 's'} processed`, `${sent} accepted for sending`];
  if (skipped) parts.push(`${skipped} invalid ${skipped === 1 ? 'address' : 'addresses'} skipped`);
  if (failed) parts.push(`${failed} provider ${failed === 1 ? 'failure' : 'failures'}`);
  return `${parts.join(', ')}. Accepted messages can still bounce later.`;
}

module.exports = { campaignSummary };
