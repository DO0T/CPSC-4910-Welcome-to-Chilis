import { Routes, Route } from "react-router-dom";
import Login from './Login.jsx'
import Home from './Home.jsx'
import SignUp from './signup.jsx'
import EditProfile from './editprofile.jsx'


function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<SignUp />} />
      <Route path="/editprofile" element={<EditProfile />} />
    </Routes>
  );
}

export default App;