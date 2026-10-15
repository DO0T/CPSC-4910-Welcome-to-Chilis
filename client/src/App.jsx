import { Routes, Route } from "react-router-dom";
import Login from './Login.jsx';
import Home from './Home.jsx';
import SignUp from './signup.jsx';
import EditProfile from './editprofile.jsx';
import DriverDashboard from './driverdashboard.jsx';
import SponsorDashboard from './sponsordashboard.jsx';
import About from './about.jsx';
import ForgotPassword from "./ForgotPassword";
import ResetPassword from "./ResetPassword";

function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<SignUp />} />
      <Route path="/editprofile" element={<EditProfile />} />
      <Route path="/about" element={<About />} />
      <Route path="/driver-dashboard" element={<DriverDashboard />} />
      <Route path="/sponsor-dashboard" element={<SponsorDashboard />} />
      <Route path="/admin-dashboard" element={<h1 style={{color: 'white'}}>Admin Dashboard</h1>} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />
    </Routes>
  );
}

export default App;
