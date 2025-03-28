import { useState } from "react";

const Login = ({ onLogin, onShowRegister }) => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState(""); // ✅ State for error message

  const handleLogin = async () => {
    setErrorMessage(""); // Reset error message before attempting login

    try {
      const response = await fetch("http://localhost:5000/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Login failed.");
      }

      localStorage.setItem("token", data.token);
      onLogin(); // Call parent function to update state
    } catch (error) {
      console.error("❌ Login Error:", error);
      setErrorMessage(error.message); // ✅ Display error message
    }
  };

  return (
    <div className="p-4 overflow-hidden h-screen space-y-22">

      <h1 className="p-2 text-5xl font-extrabold tracking-wide text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-purple-500 to-pink-500 drop-shadow-lg">
        User managment app
      </h1>

      <div className="flex justify-center items-center text-center">

        {/* ✅ Show error message if exists */}
        <div>
          <h2 className="text-3xl font-extrabold tracking-wide text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-purple-500 to-pink-500 drop-shadow-lg mb-4">Login</h2>
          {errorMessage && <p className="text-red-500 mb-2">{errorMessage}</p>}

          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="p-2 border rounded mb-2 w-full"
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="p-2 border rounded mb-2 w-full"
          />
          <button onClick={handleLogin} className="bg-gradient-to-r from-blue-400 via-purple-500 to-pink-500 drop-shadow-lg text-white p-2 rounded w-full">
            Login
          </button>

          <p className="mt-2 text-sm">
            Don't have an account?{" "}
            <span className="text-blue-500 cursor-pointer underline" onClick={onShowRegister}>Register here</span>
          </p>
        </div>


      </div>

    </div>
  );
};

export default Login;
