import { BRAND } from '../config/brand';
import { PageHeader, Card, Badge } from '../ui/kit';
import { Icon } from '../ui/Icon';
import { Link } from '../router';

export function ShopPage() {
  return (
    <div className="page">
      <PageHeader title="Shop" subtitle="Partner brands" backTo="/more" />
      <p className="notice small"><Icon name="info" size={18} /> {BRAND.name} is independent. These partner brands are optional. Links open the brand's own website; we do not sell or price their products here.</p>
      <h2 className="list-title">Partner brands</h2>
      <ul className="partner-list">
        {BRAND.partners.map((p) => (
          <li key={p.id}>
            <Card as="article" className="partner">
              <div className={`partner-mark partner-${p.category}`} aria-hidden="true"><Icon name={p.category === 'toys' ? 'heart' : 'bag'} size={26} /></div>
              <div className="grow">
                <h3>{p.name}</h3>
                <p className="muted small">{p.description}</p>
                <div className="badges"><Badge>{p.category === 'toys' ? 'Toys' : 'Food and treats'}</Badge><Badge>{p.species.map((s) => (s === 'dog' ? 'Dogs' : s === 'cat' ? 'Cats' : 'Other pets')).join(' and ')}</Badge></div>
              </div>
              <a className="btn btn-secondary" href={p.url} target="_blank" rel="noopener noreferrer" aria-label={`Visit ${p.name} website (opens in a new tab)`}>
                <span>Visit</span><Icon name="external" size={18} />
              </a>
            </Card>
          </li>
        ))}
      </ul>
      <Card>
        <h2>Mystery boxes</h2>
        <p className="muted small">Build a themed box plan for each pet. Ordering is coming soon.</p>
        <Link to="/boxes/build" className="btn btn-primary"><Icon name="gift" size={20} /><span>Build a box</span></Link>
      </Card>
    </div>
  );
}
