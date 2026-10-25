import { BRAND } from '../config/brand';
import { Link } from '../router';
import { Icon } from '../ui/Icon';
import { PageHeader } from '../ui/kit';

const ITEMS = [
  { to: '/community', icon: 'camera', label: 'Community', hint: 'Your pet photo feed' },
  { to: '/events', icon: 'calendar', label: 'Events', hint: 'Walk clubs, playdates, birthdays' },
  { to: '/boxes', icon: 'gift', label: 'Mystery boxes', hint: 'Themed box plans per pet' },
  { to: '/shop', icon: 'bag', label: 'Shop', hint: 'Partner brands' },
  { to: '/identify', icon: 'search', label: 'Identify breed', hint: 'Best guess from a photo' },
  { to: '/health-check', icon: 'camera', label: 'Photo health check', hint: 'Skin, ears, eyes, teeth and more' },
  { to: '/breeds', icon: 'paw', label: 'Breed guide', hint: 'Dog and cat breeds, plus find your match' },
  { to: '/sitters', icon: 'sitter', label: 'Find a sitter', hint: 'Requests, saved sitters and a care sheet' },
  { to: '/spending', icon: 'bag', label: 'Spending', hint: 'Monthly totals, by category and pet' },
  { to: '/care', icon: 'syringe', label: 'Care schedule', hint: 'Everything due across pets' },
  { to: '/notifications', icon: 'bell', label: 'Notifications', hint: 'Reminders and upcoming plans' },
  { to: '/account', icon: 'user', label: 'Account', hint: 'Household, export, import, delete' },
];

export function MorePage() {
  return (
    <div className="page">
      <PageHeader title="More" />
      <ul className="menu card">
        {ITEMS.map((i) => (
          <li key={i.to}>
            <Link to={i.to} className="menu-row">
              <span className="menu-icon"><Icon name={i.icon} /></span>
              <span className="grow"><strong>{i.label}</strong><span className="muted small block">{i.hint}</span></span>
              <Icon name="chevron" size={18} />
            </Link>
          </li>
        ))}
      </ul>
      <p className="muted small center">{BRAND.name} · {BRAND.tagline}</p>
    </div>
  );
}
