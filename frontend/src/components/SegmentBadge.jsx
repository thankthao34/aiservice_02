const mapper = {
  cheap_hunter: { cls: 'cheap', text: 'Budget Hunter' },
  normal_user: { cls: 'normal', text: 'Smart Shopper' },
  premium_user: { cls: 'premium', text: 'Premium Elite' }
};

export default function SegmentBadge({ segment = 'normal_user', score = 0 }) {
  const data = mapper[segment] || mapper.normal_user;
  return (
    <div className={`segment-badge ${data.cls}`}>
      <span>{data.text}</span>
      <strong>{Math.round(score * 100)}% confidence</strong>
    </div>
  );
}
