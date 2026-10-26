import { Routes, Route } from "react-router-dom";
import Login from './Login.jsx';
import Home from './Home.jsx';
import SignUp from './signup.jsx';
import EditProfile from './editprofile.jsx';
import DriverDashboard from './driverdashboard.jsx';
import SponsorDashboard from './sponsordashboard.jsx';
import SponsorCatalog from './sponsorcatalog.jsx';
import AdminDashboard from './admindashboard.jsx';
import ImpersonationBanner from './ImpersonationBanner.jsx';
import About from './about.jsx';
import ForgotPassword from "./ForgotPassword";
import ResetPassword from "./ResetPassword";
import AlertSystem from './AlertSystem.jsx';
import AdminNotifications from './AdminNotifications.jsx';

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
      <Route path="/sponsor-dashboard" element={<SponsorDashboard />} />
      <Route path="/sponsor-catalog" element={<SponsorCatalog />} />
      <Route path="/admin-dashboard" element={<AdminDashboard />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="/admin-notifications" element={<AdminNotifications />} />
    </Routes>
    <AlertSystem />
    </>
  );
}

export default App;
