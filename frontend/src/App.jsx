import { useState, useEffect } from "react";
import Login from "./Login";
import Register from "./Register";
import UserTable from "./UserTable";

const App = () => {
  const [isLoggedIn, setIsLoggedIn] = useState(!!localStorage.getItem("token"));
  const [showRegister, setShowRegister] = useState(false);

  useEffect(() => {
    // ✅ Always check if token is present on component mount
    setIsLoggedIn(!!localStorage.getItem("token"));
  }, []);

  const handleLogin = () => {
    setIsLoggedIn(true);
    setShowRegister(false);
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    setIsLoggedIn(false);
    setShowRegister(false);
  };

  return (
    <div className="container mx-auto p-4">
      {isLoggedIn ? (
        <UserTable onLogout={handleLogout} />
      ) : showRegister ? (
        <Register onLogin={handleLogin} />
      ) : (
        <Login onLogin={handleLogin} onShowRegister={() => setShowRegister(true)} />
      )}
    </div>
  );
};

export default App;
