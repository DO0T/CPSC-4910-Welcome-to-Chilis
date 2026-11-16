import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import LogoutButton from './logoutbutton.jsx';
import './driverdashboard.css';
import './driverpurchases.css';

const API_BASE_URL = import.meta.env.VITE_API_URL ||
  (import.meta.env.DEV ? 'http://localhost:5000' : 'http://52.23.134.146:5000');

function purchaseDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Date unavailable' : date.toLocaleString(undefined, {
    year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
  });
}

function PurchaseImage({ purchase }) {
  const [failed, setFailed] = useState(false);
  return purchase.imageUrl && !failed
    ? <img className="purchase-image" src={purchase.imageUrl} alt="" onError={() => setFailed(true)} />
    : <div className="purchase-image purchase-image-placeholder" aria-hidden="true">Reward</div>;
}

export default function DriverPurchases() {
  const navigate = useNavigate();
  const [purchases, setPurchases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const token = sessionStorage.getItem('authToken');
    if (!token) {
      navigate('/login', { replace: true });
      return undefined;
    }
    const controller = new AbortController();
    async function loadPurchases() {
      try {
        const response = await fetch(`${API_BASE_URL}/api/driver/catalog/purchases`, {
          headers: { Authorization: `Bearer ${token}` }, signal: controller.signal,
        });
        if (response.status === 401) {
          sessionStorage.removeItem('authToken');
          navigate('/login', { replace: true });
          return;
        }
        const body = await response.json();
        if (!response.ok) throw new Error(body.message || 'Unable to load purchase history.');
        setPurchases(body.purchases);
      } catch (caught) {
        if (caught.name !== 'AbortError') setError(caught.message || 'Unable to load purchase history.');
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    loadPurchases();
    return () => controller.abort();
  }, [navigate]);

  return <main className="dashboard-page driver-purchases">
    <div className="dashboard-content">
      <header className="dashboard-topbar">
        <div><p className="dashboard-eyebrow">Driver rewards</p><h1 className="dashboard-greeting">Purchase history</h1><p className="dashboard-section-description">Review your rewards and receipts from all your sponsors.</p></div>
        <nav className="dashboard-nav" aria-label="Purchase navigation"><Link to="/driver-dashboard">Dashboard</Link><Link to="/driver-catalog">Catalog</Link><LogoutButton /></nav>
      </header>
      <section className="dashboard-card" aria-labelledby="purchase-history-heading">
        <header className="dashboard-card-header"><h2 id="purchase-history-heading">Your purchases</h2><p className="dashboard-section-description">These purchases are simulated; no items are shipped.</p></header>
        {loading ? <p className="dashboard-message" role="status">Loading purchases…</p>
          : error ? <p className="dashboard-message" role="alert">{error}</p>
          : purchases.length === 0 ? <p className="dashboard-message">No purchases yet. <Link to="/driver-catalog">Explore rewards</Link> to get started.</p>
          : <ul className="purchase-list">{purchases.map((purchase) => <li className="purchase-row" key={purchase.id}>
            <div className="purchase-overview"><PurchaseImage purchase={purchase} /><div className="purchase-info"><h3>{purchase.itemTitle}</h3><p>{purchase.sponsorName} · {purchaseDate(purchase.purchasedAt)}</p><span className={`purchase-status ${purchase.status === 'CANCELLED' ? 'purchase-status-cancelled' : ''}`}>{purchase.status === 'COMPLETED' ? 'Completed' : purchase.status === 'CANCELLED' ? 'Cancelled' : purchase.status}</span></div><strong className="purchase-cost">{purchase.pointsSpent.toLocaleString()} pts</strong></div>
            <details className="purchase-receipt"><summary>View receipt</summary><div className="receipt-content"><h4>Purchase receipt</h4><dl><div><dt>Receipt number</dt><dd>#{purchase.id}</dd></div><div><dt>Item</dt><dd>{purchase.itemTitle}</dd></div><div><dt>Sponsor</dt><dd>{purchase.sponsorName}</dd></div><div><dt>Date</dt><dd>{purchaseDate(purchase.purchasedAt)}</dd></div><div><dt>Status</dt><dd>{purchase.status === 'COMPLETED' ? 'Completed' : purchase.status === 'CANCELLED' ? 'Cancelled' : purchase.status}</dd></div><div><dt>Points spent</dt><dd>{purchase.pointsSpent.toLocaleString()} pts</dd></div></dl><p>This is a simulated purchase. No real order was placed or shipped.</p></div></details>
          </li>)}</ul>}
      </section>
    </div>
  </main>;
}
