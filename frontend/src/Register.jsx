import { useState } from "react";

const Register = ({ onLogin }) => {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const handleRegister = async () => {
    setError(""); // Clear previous errors

    try {
      const response = await fetch("http://localhost:5000/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Registration failed.");
      }

      // ✅ Store token and log in automatically
      localStorage.setItem("token", data.token);
      console.log("🎉 Registered & Logged In! Token saved:", data.token);

      onLogin(); // ✅ Call parent function to switch state

      // 🔥 Force re-render so App.jsx detects login
      window.location.reload();
    } catch (error) {
      console.error("❌ Registration Error:", error);
      setError(error.message);
    }
  };


  return (
    <div className="p-4 overflow-hidden h-screen space-y-22">


      <h1 className="p-2 text-5xl font-extrabold tracking-wide text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-purple-500 to-pink-500 drop-shadow-lg">
        User managment app
      </h1>
      <div className="flex justify-center items-center text-center">
        <div>


          <h2 className="text-3xl font-extrabold tracking-wide text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-purple-500 to-pink-500 drop-shadow-lg mb-4">Register</h2>

          {error && <p className="text-red-500">{error}</p>}

          <input
            type="text"
            placeholder="Full Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="p-2 border rounded mb-2 w-full"
          />
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

          <button onClick={handleRegister} className="bg-gradient-to-r from-green-600 via-green-400 to-purple-400 drop-shadow-lg text-white p-2 rounded w-full">
            Register
          </button>

          <p className="mt-2 text-sm">
            Already have an account?{" "}
            <span className="text-blue-500 cursor-pointer underline" onClick={onLogin}>
              Login here
            </span>
          </p>
        </div>

      </div>

    </div>
  );
};

export default Register;
