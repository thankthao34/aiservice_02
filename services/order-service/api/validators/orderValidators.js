function validateCreatePayload(payload) {
  const errors = [];
  if (!payload) errors.push('Missing payload');
  if (!payload.user_id) errors.push('Missing user_id');
  if (!Array.isArray(payload.items) || !payload.items.length) errors.push('Missing items');
  if (!payload.shipping || !payload.shipping.receiver_name || !payload.shipping.phone || !payload.shipping.line1 || !payload.shipping.city) {
    errors.push('Missing shipping information');
  }
  if (errors.length) return { ok: false, errors };
  return { ok: true };
}

function validateStatus(status) {
  const ORDER_STATUSES = ['pending', 'paid', 'shipping', 'completed', 'cancelled'];
  if (!ORDER_STATUSES.includes(String(status || '').toLowerCase())) {
    return { ok: false, error: 'Invalid status' };
  }
  return { ok: true };
}

module.exports = { validateCreatePayload, validateStatus };
