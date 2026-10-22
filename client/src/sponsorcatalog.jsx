import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import LogoutButton from './logoutbutton.jsx';
import './driverdashboard.css';
import './sponsorcatalog.css';

const API_BASE_URL = import.meta.env.VITE_API_URL ||
  (import.meta.env.DEV ? 'http://localhost:5000' : 'http://52.23.134.146:5000');

function dollars(value) {
  const number = Number(value);
  return Number.isFinite(number) ? new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(number) : 'Price unavailable';
}

function ListingImage({ item }) {
  return item.imageUrl ? <img className="catalog-image" src={item.imageUrl} alt="" /> :
    <div className="catalog-image catalog-image-placeholder" aria-hidden="true">Reward</div>;
}

function SponsorCatalog() {
  const navigate = useNavigate();
  const [catalog, setCatalog] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState(null);
  const [searching, setSearching] = useState(false);
  const [selectedId, setSelectedId] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [busyId, setBusyId] = useState('');
  const [drafts, setDrafts] = useState({});

  async function api(path, options = {}) {
    const token = sessionStorage.getItem('authToken');
    if (!token) {
      navigate('/login', { replace: true });
      throw new Error('Please log in to continue.');
    }
    const response = await fetch(`${API_BASE_URL}/api/sponsor/catalog${path}`, {
      ...options,
      headers: { Authorization: `Bearer ${token}`, ...(options.body ? { 'Content-Type': 'application/json' } : {}) },
    });
    if (response.status === 401) {
      sessionStorage.removeItem('authToken');
      navigate('/login', { replace: true });
      throw new Error('Your session expired. Please log in again.');
    }
    if (response.status === 403) {
      navigate('/', { replace: true });
      throw new Error('Sponsor access required.');
    }
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || 'Catalog request failed.');
    return data;
  }

  async function reload() {
    setCatalog(await api('/'));
  }

  useEffect(() => {
    if (!sessionStorage.getItem('authToken')) {
      navigate('/login', { replace: true });
      return;
    }
    let cancelled = false;
    async function load() {
      try {
        const token = sessionStorage.getItem('authToken');
        const response = await fetch(`${API_BASE_URL}/api/sponsor/catalog`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (response.status === 401) {
          sessionStorage.removeItem('authToken');
          navigate('/login', { replace: true });
          return;
        }
        if (response.status === 403) {
          navigate('/', { replace: true });
          return;
        }
        const data = await response.json();
        if (!response.ok) throw new Error(data.message || 'Unable to load your catalog.');
        if (!cancelled) setCatalog(data);
      } catch (caught) {
        if (!cancelled) setError(caught.message || 'Unable to load your catalog.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [navigate]);

  async function search(event) {
    event.preventDefault();
    setError('');
    setNotice('');
    setSearching(true);
    setSelectedId('');
    setConfirmed(false);
    try {
      const data = await api(`/search?q=${encodeURIComponent(query.trim())}`);
      setResults(data.items);
    } catch (caught) {
      setError(caught.message);
      setResults(null);
    } finally {
      setSearching(false);
    }
  }

  function chooseItem(item) {
    setSelectedId(item.itemId);
    setConfirmed(false);
    setError('');
  }

  async function act(id, path, options, success) {
    setBusyId(id);
    setError('');
    setNotice('');
    try {
      await api(path, options);
      await reload();
      setNotice(success);
      return true;
    } catch (caught) {
      setError(caught.message);
      return false;
    } finally {
      setBusyId('');
    }
  }

  async function addItem(item) {
    const ok = await act(item.itemId, '', {
      method: 'POST', body: JSON.stringify({ itemId: item.itemId, familyFriendlyConfirmed: confirmed }),
    }, 'Item added to your catalog.');
    if (ok) { setSelectedId(''); setConfirmed(false); }
  }

  async function removeItem(item) {
    if (!window.confirm(`Remove “${item.title}” from your catalog?`)) return;
    await act(item.id, `/${item.id}`, { method: 'DELETE' }, 'Item removed from your catalog.');
  }

  if (loading || (!catalog && error)) {
    return <main className="dashboard-page sponsor-catalog"><div className="dashboard-content">
      <p className="dashboard-message" role={error ? 'alert' : 'status'}>{error || 'Loading your catalog…'}</p>
      {error && <Link to="/sponsor-dashboard">Back to dashboard</Link>}
    </div></main>;
  }

  const selectedItems = new Set(catalog.items.map((item) => item.itemId));
  const usingEbay = catalog.productSource === 'eBay';

  return <main className="dashboard-page sponsor-catalog">
    <div className="dashboard-content">
      <header className="dashboard-topbar">
        <div><p className="dashboard-eyebrow">Sponsor catalog</p><h1 className="dashboard-greeting">{catalog.companyName}</h1></div>
        <nav className="dashboard-nav" aria-label="Account actions">
          <Link className="catalog-nav-link" to="/sponsor-dashboard">Dashboard</Link>
          <LogoutButton />
        </nav>
      </header>

      <p className="catalog-demo-note" role="status">{usingEbay
        ? 'Search eBay listings for catalog rewards. Prices and availability are saved from search results, not rechecked with eBay. Sponsors approve suitability; adding an item does not purchase it.'
        : 'This catalog uses sample products from DummyJSON. Prices are treated as USD for this prototype; these are not purchasable listings.'}</p>
      {error && <p className="catalog-feedback catalog-error" role="alert">{error}</p>}
      {notice && <p className="catalog-feedback" role="status">{notice}</p>}

      <section className="dashboard-card" aria-labelledby="catalog-items-heading">
        <header className="dashboard-card-header catalog-section-header">
          <div><h2 id="catalog-items-heading">Your catalog</h2><p>Rewards selected for your company. Point costs use {dollars(catalog.pointValue)} per point.</p></div>
          <span className="catalog-count">{catalog.items.length} {catalog.items.length === 1 ? 'item' : 'items'}</span>
        </header>
        {catalog.items.length === 0 ? <p className="dashboard-message">No items yet. Search {usingEbay ? 'eBay listings' : 'sample products'} below to choose the first reward.</p> :
          <div className="catalog-list">
            {catalog.items.map((item) => <article className="catalog-item" key={item.id}>
              <ListingImage item={item} />
              <div className="catalog-item-body">
                <h3>{item.title}</h3>
                <p className="catalog-item-meta">{item.source === 'eBay' ? (item.available ? 'eBay listing' : 'eBay listing unavailable') : item.available ? 'In sample stock' : 'Out of sample stock'}{item.mediaRating ? ` · ${item.mediaRating} rated` : ''}</p>
                <p className="catalog-price"><strong>{item.pointCost == null ? 'Point cost unavailable' : `${item.pointCost.toLocaleString()} pts`}</strong> <span>from {dollars(item.effectivePrice)}</span></p>
                {item.priceOverride != null && <p className="catalog-item-meta">Saved source price: {dollars(item.sourcePrice)} · Sponsor override active</p>}
                <form className="catalog-override" onSubmit={(event) => {
                  event.preventDefault();
                  act(item.id, `/${item.id}`, { method: 'PATCH', body: JSON.stringify({ priceOverride: drafts[item.id] ?? item.priceOverride ?? '' }) }, 'Price override saved.');
                }}>
                  <label htmlFor={`override-${item.id}`}>Override USD price</label>
                  <div className="catalog-override-row">
                    <input id={`override-${item.id}`} type="number" min="0.01" step="0.01" placeholder={item.sourcePrice} value={drafts[item.id] ?? item.priceOverride ?? ''} onChange={(event) => setDrafts({ ...drafts, [item.id]: event.target.value })} />
                    <button type="submit" disabled={busyId === item.id}>Save price</button>
                    {item.priceOverride != null && <button type="button" disabled={busyId === item.id} onClick={() => act(item.id, `/${item.id}`, { method: 'PATCH', body: JSON.stringify({ priceOverride: null }) }, 'Using the saved source price again.').then((ok) => { if (ok) setDrafts((current) => ({ ...current, [item.id]: '' })); })}>Clear override</button>}
                  </div>
                </form>
                <div className="catalog-item-actions">
                  {item.source === 'DummyJSON' && <button type="button" disabled={busyId === item.id} onClick={() => act(item.id, `/${item.id}/refresh`, { method: 'POST' }, 'Product details refreshed.')}>Refresh details</button>}
                  <button type="button" disabled={busyId === item.id} onClick={() => removeItem(item)}>Remove</button>
                  {item.itemUrl && <a href={item.itemUrl} target="_blank" rel="noopener noreferrer">{item.source === 'eBay' ? 'View on eBay' : 'View sample data'}</a>}
                </div>
              </div>
            </article>)}
          </div>}
      </section>

      <section className="dashboard-card" aria-labelledby="catalog-search-heading">
        <header className="dashboard-card-header"><h2 id="catalog-search-heading">Find items</h2><p>Search {usingEbay ? 'eBay listings' : 'sample products'} and choose rewards for your drivers.</p></header>
        <div className="catalog-search-content">
          <form className="catalog-search-form" onSubmit={search}>
            <label htmlFor="catalog-query">Search {usingEbay ? 'eBay listings' : 'sample products'}</label>
            <div><input id="catalog-query" type="search" minLength="2" maxLength="100" required value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Try phone" /><button type="submit" disabled={searching || Boolean(busyId)}>{searching ? 'Searching…' : 'Search'}</button></div>
          </form>
          {results && (results.length ? <div className="catalog-results">
            {results.map((item) => <article className="catalog-result" key={item.itemId}>
              <ListingImage item={item} />
              <div><h3>{item.title}</h3><p>{dollars(item.price)}{item.mediaRating ? ` · ${item.mediaRating} rated` : ''}</p>
                {!item.available ? <span className="catalog-item-meta">Listing unavailable</span> : selectedItems.has(item.itemId) ? <span className="catalog-item-meta">Already in your catalog</span> :
                  <button type="button" disabled={Boolean(busyId)} onClick={() => chooseItem(item)}>Choose item</button>}
                {selectedId === item.itemId && !selectedItems.has(item.itemId) && <div className="catalog-confirm">
                  <label><input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} /> I confirm this item is family-friendly. This is my approval, not an automated rating check.</label>
                  <button type="button" disabled={!confirmed || busyId === item.itemId} onClick={() => addItem(item)}>{busyId === item.itemId ? 'Adding…' : 'Add to catalog'}</button>
                </div>}
              </div>
            </article>)}
          </div> : <p className="catalog-empty-search">No {usingEbay ? 'eBay listings' : 'sample products'} found. Try a different search.</p>)}
        </div>
      </section>
    </div>
  </main>;
}

export default SponsorCatalog;
