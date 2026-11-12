import { Routes, Route, Link } from "react-router-dom";
import Login from './Login.jsx';
import Home from './Home.jsx';
import SignUp from './signup.jsx';
import EditProfile from './editprofile.jsx';
import DriverDashboard from './driverdashboard.jsx';
import DriverCatalog from './drivercatalog.jsx';
import SponsorDashboard from './sponsordashboard.jsx';
import SponsorCatalog from './sponsorcatalog.jsx';
import SponsorDrivers from './sponsordrivers.jsx';
import SponsorOrganization from './sponsororganization.jsx';
import AdminDashboard from './admindashboard.jsx';
import ImpersonationBanner from './ImpersonationBanner.jsx';
import About from './about.jsx';
import ForgotPassword from "./ForgotPassword";
import ResetPassword from "./ResetPassword";
import AlertSystem from './AlertSystem.jsx';
import AdminNotifications from './AdminNotifications.jsx';
import Messages from './Messages.jsx';
import Support from './Support.jsx';
import PointDisputes from './PointDisputes.jsx';

function App() {
  return (
  <>
  <ImpersonationBanner />
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<SignUp />} />
      <Route path="/editprofile" element={<EditProfile />} />
      <Route path="/about" element={<About />} />
      <Route path="/driver-dashboard" element={<DriverDashboard />} />
      <Route path="/driver-catalog" element={<DriverCatalog />} />
      <Route path="/sponsor-dashboard" element={<SponsorDashboard />} />
      <Route path="/sponsor-catalog" element={<SponsorCatalog />} />
      <Route path="/sponsor-drivers" element={<SponsorDrivers />} />
      <Route path="/sponsor-organization" element={<SponsorOrganization />} />
      <Route path="/admin-dashboard" element={<AdminDashboard />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="/admin-notifications" element={<AdminNotifications />} />
      <Route path="/messages" element={<Messages />} />
      <Route path="/support" element={<Support />} />
      <Route path="/point-disputes" element={<PointDisputes />} />
    </Routes>
    <AlertSystem />
    <footer className="site-footer">
      <div className="site-footer-inner">
        <span>© 2026 Welcome to Chili&apos;s. All rights reserved.</span>
        <nav aria-label="Footer navigation"><span>Terms &amp; Conditions</span><Link to="/about">About</Link></nav>
      </div>
    </footer>
    </>
  );
}

export default App;
