import waiter from './assets/waiter-silhouette.png';

// The mark is decorative next to the written brand name.
export default function BrandMark() {
  return <span className="brand-mark" aria-hidden="true"><img src={waiter} alt="" /></span>;
}
