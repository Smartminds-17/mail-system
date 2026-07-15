function escapeHtml(value) {
  return String(value).replace(/[&<>'"]/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
  })[character]);
}

function personalize(template, recipient) {
  return template
    .replace(/\{\{Name\}\}/g, escapeHtml(recipient.name))
    .replace(/\{\{Email\}\}/g, escapeHtml(recipient.email || ''));
}

module.exports = { escapeHtml, personalize };
