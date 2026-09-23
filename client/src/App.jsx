import { Routes, Route } from "react-router-dom";
import Login from './Login.jsx';
import Home from './Home.jsx';
import SignUp from './signup.jsx';
import EditProfile from './editprofile.jsx';

function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<SignUp />} />
      <Route path="/editprofile" element={<EditProfile />} />

      <Route path="/driver-dashboard" element={<h1 style={{color: 'white'}}>Driver Dashboard</h1>} />
      <Route path="/sponsor-dashboard" element={<h1 style={{color: 'white'}}>Sponsor Dashboard</h1>} />
      <Route path="/admin-dashboard" element={<h1 style={{color: 'white'}}>Admin Dashboard</h1>} />
    </Routes>
  );
}

export default App;