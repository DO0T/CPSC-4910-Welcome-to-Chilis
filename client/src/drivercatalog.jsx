import SmartList from './SmartList.jsx';
import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import LogoutButton from './logoutbutton.jsx';
import './driverdashboard.css';
import './drivercatalog.css';

const API_BASE_URL = import.meta.env.VITE_API_URL ||
  (import.meta.env.DEV ? 'http://localhost:5000' : 'http://52.23.134.146:5000');

function CatalogImage({ item }) {
  const [failed, setFailed] = useState(false);
  return item.imageUrl && !failed ? (
    <img className="driver-catalog-image" src={item.imageUrl} alt="" onError={() => setFailed(true)} />
  ) : (
    <div className="driver-catalog-image driver-catalog-image-placeholder" aria-hidden="true">Reward</div>
  );
}

function DriverCatalog() {
  const navigate = useNavigate();
  const [catalog, setCatalog] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedId, setSelectedId] = useState(null);
  const [purchasing, setPurchasing] = useState(false);
  const [checkoutItem, setCheckoutItem] = useState(null);
  const [purchaseError, setPurchaseError] = useState('');
  const [receipt, setReceipt] = useState(null);
  const dialogRef = useRef(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (checkoutItem && dialog && !dialog.open) dialog.showModal();
  }, [checkoutItem]);

  function closeCheckout() {
    if (purchasing) return;
    dialogRef.current?.close();
    setCheckoutItem(null);
    setPurchaseError('');
    setReceipt(null);
  }

  function openCheckout(item) {
    setPurchaseError('');
    setReceipt(null);
    setCheckoutItem(item);
  }

  async function purchase(item) {
    if (purchasing) return;
    setPurchasing(true);
    setPurchaseError('');
    try {
      const response = await fetch(`${API_BASE_URL}/api/driver/catalog/purchase`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${sessionStorage.getItem('authToken')}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemId: item.id, sponsorId: catalog.sponsorId, pointCost: item.pointCost }),
      });
      if (response.status === 401) {
        sessionStorage.removeItem('authToken');
        navigate('/login', { replace: true });
        return;
      }
      const body = await response.json();
      if (!response.ok) throw new Error(body.message || 'Unable to complete the simulated purchase.');
      setCatalog((current) => ({ ...current, balance: body.balance }));
      setReceipt({ balance: body.balance, cost: item.pointCost });
    } catch (caught) {
      setPurchaseError(caught.message || 'Unable to complete the purchase.');
    } finally {
      setPurchasing(false);
    }
  }

  function listingUrl(value) {
    try {
      const url = new URL(value);
      return ['http:', 'https:'].includes(url.protocol) ? url.href : null;
    } catch {
      return null;
    }
  }

  useEffect(() => {
    const token = sessionStorage.getItem('authToken');
    if (!token) {
      navigate('/login', { replace: true });
      return undefined;
    }

    const controller = new AbortController();
    async function loadCatalog() {
      try {
        const response = await fetch(`${API_BASE_URL}/api/driver/catalog`, {
          headers: { Authorization: `Bearer ${token}` },
          signal: controller.signal,
        });
        if (response.status === 401) {
          sessionStorage.removeItem('authToken');
          navigate('/login', { replace: true });
          return;
        }
        const body = await response.json();
        if (!response.ok) throw new Error(body.message || 'Unable to load the catalog.');
        setCatalog(body);
      } catch (caught) {
        if (caught.name !== 'AbortError') setError(caught.message || 'Unable to load the catalog.');
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    loadCatalog();
    return () => controller.abort();
  }, [navigate]);

  return (
    <main className="dashboard-page driver-catalog">
      <div className="dashboard-content">
        <header className="dashboard-topbar">
          <div>
            <p className="dashboard-eyebrow">Driver catalog</p>
            <h1 className="dashboard-greeting">{catalog ? `${catalog.companyName} rewards` : 'Rewards catalog'}</h1>
            <p className="dashboard-section-description">Browse rewards available through your sponsor.</p>
          </div>
          <nav className="dashboard-nav" aria-label="Catalog navigation">
            <Link className="driver-catalog-nav-link" to="/driver-dashboard">Dashboard</Link>
            <LogoutButton />
          </nav>
        </header>

        <section className="dashboard-card" aria-labelledby="driver-catalog-heading">
          <header className="dashboard-card-header">
            <h2 id="driver-catalog-heading">Available rewards</h2>
            <p className="dashboard-section-description">Items selected by your current sponsor.</p>
            {catalog && (
              <p className="dashboard-section-description">
                {Number.isFinite(catalog.pointValue) && catalog.pointValue > 0
                  ? `Points conversion: 1 point = $${catalog.pointValue.toFixed(2)} USD.`
                  : 'Points conversion rate unavailable.'}
              </p>
            )}
            {catalog && <div className="catalog-balance"><span>Your {catalog.companyName} balance</span><strong>{catalog.balance.toLocaleString()} <small>points</small></strong></div>}
          </header>
          {loading ? (
            <p className="dashboard-message" role="status">Loading rewards…</p>
          ) : error ? (
            <p className="dashboard-message" role="alert">{error} <Link to="/driver-dashboard">Back to dashboard</Link></p>
          ) : catalog.items.length === 0 ? (
            <p className="dashboard-message">This sponsor has no available rewards yet. Check back later or choose another sponsor on your dashboard.</p>
          ) : (
            <SmartList items={catalog.items} label="rewards" options={[{key:'title',label:'Name',value:x=>x.title},{key:'points',label:'Points',type:'number',value:x=>x.pointCost}]}>{visibleItems => (<ul className="driver-catalog-list">
              {visibleItems.map((item) => (
                <li className="driver-catalog-item" key={item.id}>
                  <button type="button" className="driver-catalog-item-button"
                    aria-expanded={selectedId === item.id}
                    aria-controls={`reward-details-${item.id}`}
                    onClick={() => setSelectedId(selectedId === item.id ? null : item.id)}>
                  <CatalogImage item={item} />
                  <div>
                    <h3>{item.title}</h3>
                    <span className="driver-catalog-points">
                      {item.pointCost == null ? 'Point cost unavailable' : `${item.pointCost.toLocaleString()} pts`}
                    </span>
                    <span className="driver-catalog-details-label">{selectedId === item.id ? 'Hide details' : 'View details'}</span>
                  </div>
                  </button>
                  <div id={`reward-details-${item.id}`} className="driver-catalog-details" hidden={selectedId !== item.id}>
                    <p>Available from {catalog.companyName}</p>
                    {item.mediaRating && <p>Media rating: {item.mediaRating}</p>}
                    {listingUrl(item.itemUrl) && <a href={listingUrl(item.itemUrl)} target="_blank" rel="noopener noreferrer">View original listing</a>}
                  </div>
                  <div className="driver-catalog-actions">
                    <button className="driver-catalog-purchase" type="button" disabled={item.pointCost == null || catalog.balance < item.pointCost} onClick={() => openCheckout(item)} aria-label={`Buy ${item.title} with points`}>
                      Buy with points
                    </button>
                    {item.pointCost != null && catalog.balance < item.pointCost && <p>Not enough points with this sponsor.</p>}
                  </div>
                </li>
              ))}
            </ul>)}</SmartList>
          )}
        </section>
        {!loading && !error && catalog?.items.length > 0 && (
          <p className="driver-catalog-note">Listings come from your sponsor’s saved catalog. Availability may change.</p>
        )}
        <dialog className="catalog-checkout" ref={dialogRef} aria-labelledby="checkout-title" onCancel={(event) => { event.preventDefault(); closeCheckout(); }} onClose={() => { if (!purchasing) { setCheckoutItem(null); setPurchaseError(''); setReceipt(null); } }}>
          {checkoutItem && catalog && (
            <div className="checkout-content">
              <div className="checkout-heading">
                <div><p className="checkout-eyebrow">{receipt ? 'Purchase complete' : 'Rewards checkout'}</p><h2 id="checkout-title">{receipt ? 'Enjoy your reward' : 'Review your reward'}</h2></div>
                <button className="checkout-close" type="button" onClick={closeCheckout} disabled={purchasing} aria-label="Close checkout">×</button>
              </div>
              <div className="checkout-item">
                <CatalogImage item={checkoutItem} />
                <div><p className="checkout-sponsor">{catalog.companyName}</p><h3>{checkoutItem.title}</h3><p>Quantity: 1</p></div>
              </div>
              <div className="checkout-summary">
                {!receipt && <div><span>Available points</span><strong>{catalog.balance.toLocaleString()}</strong></div>}
                <div><span>{receipt ? 'Points spent' : 'Reward cost'}</span><strong>−{checkoutItem.pointCost.toLocaleString()} pts</strong></div>
                <div className="checkout-total"><span>{receipt ? 'Remaining balance' : 'Balance after purchase'}</span><strong>{(receipt ? receipt.balance : catalog.balance - checkoutItem.pointCost).toLocaleString()} pts</strong></div>
              </div>
              <p className="checkout-disclosure">This is a simulated purchase. Points are deducted, but no real order is placed or shipped.</p>
              {purchaseError && <p className="checkout-error" role="alert">{purchaseError}</p>}
              {receipt ? <button className="checkout-primary" type="button" onClick={closeCheckout}>Continue shopping</button> : <div className="checkout-actions"><button className="checkout-secondary" type="button" onClick={closeCheckout} disabled={purchasing}>Keep shopping</button><button className="checkout-primary" type="button" onClick={() => purchase(checkoutItem)} disabled={purchasing}>{purchasing ? 'Completing purchase…' : 'Complete purchase'}</button></div>}
            </div>
          )}
        </dialog>
      </div>
    </main>
  );
}

export default DriverCatalog;
