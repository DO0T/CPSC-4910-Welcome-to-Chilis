import { Routes, Route } from "react-router-dom";
import Login from './Login.jsx'
import Home from './Home.jsx'


function App() {
  return (
    <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />
    </Routes>
  );
}

export default Home;