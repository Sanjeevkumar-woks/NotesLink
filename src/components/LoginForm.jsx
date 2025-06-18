import { useState, useEffect, useRef } from "react";
import {
  Mail,
  Lock,
  Eye,
  EyeOff,
  LockKeyhole,
  CircleUserRound,
  Sun,
  Moon,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "../utils/firebase";
import { checkValidData } from "../utils/validate";
import Header from "./Header";
// import { addUser,removeUser } from "../utils/userSlice";
// import { useDispatch } from "react-redux";

export default function LoginForm() {
  const [showPassword, setShowPassword] = useState(false);
  const [theme, setTheme] = useState("system");
  const email = useRef(null);
  const password = useRef(null);
  // eslint-disable-next-line no-unused-vars
  const [errorMessage, setErrorMessage] = useState(null);
  const navigate = useNavigate();
  // const dispatch = useDispatch()

  const handleSignUp = () => {
    navigate("/signup");
  };

  const handleLogin = (e) => {
    e.preventDefault();
    const enteredEmail = email.current.value;
    const enteredPassword = password.current.value;
    const validationMessage = checkValidData("",enteredEmail, enteredPassword);
    console.log("Attempting login with:", { enteredEmail, enteredPassword });
    if (validationMessage) {
      setErrorMessage(validationMessage);
      return;
    }

    signInWithEmailAndPassword(auth, enteredEmail, enteredPassword)
      .then((userCredential) => {
        // Signed in
        const user = userCredential.user;
        console.log(user);
        // Navigate to the desired page after successful login
        navigate("/aichat"); // Replace with your desired route
      })
      .catch((error) => {
        const errorCode = error.code;
        const errorMsg = error.message;
        setErrorMessage(`${errorCode}: ${errorMsg}`);
      });
  };

  // Apply theme on mount
  useEffect(() => {
    const savedTheme = localStorage.getItem("theme") || "system";
    setTheme(savedTheme);

    if (savedTheme === "dark") {
      document.documentElement.classList.add("dark");
    } else if (savedTheme === "light") {
      document.documentElement.classList.remove("dark");
    } else {
      // Follow system preference
      if (window.matchMedia("(prefers-color-scheme: dark)").matches) {
        document.documentElement.classList.add("dark");
      } else {
        document.documentElement.classList.remove("dark");
      }
    }
  }, []);

  // Toggle between light and dark
  const toggleTheme = () => {
    let newTheme = theme === "light" ? "dark" : "light";
    setTheme(newTheme);
    localStorage.setItem("theme", newTheme);

    if (newTheme === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  };



  return (
    <div className="min-h-screen flex items-center justify-center bg-white dark:bg-gray-950 transition-colors duration-300">
      {/* Theme toggle */}
      <button
        onClick={toggleTheme}
        className="absolute top-5 right-5 p-2 rounded-full bg-gray-200 dark:bg-gray-800 text-gray-700 dark:text-gray-200"
        title={`Current theme: ${theme}`}
      >
        {theme === "dark" ? (
          <Sun className="w-5 h-5" />
        ) : theme === "light" ? (
          <Moon className="w-5 h-5" />
        ) : (
          <Sun className="w-5 h-5 opacity-70" />
        )}
      </button>

      {/* Form container */}
      <div className="bg-gray-100 dark:bg-gray-900 p-6 rounded-xl w-full max-w-sm shadow-lg transition-colors duration-300">
        <form onSubmit={handleLogin}>
          <div className="flex flex-col items-center mb-4">
            <div className="bg-gradient-to-r from-pink-500 to-purple-500 p-2 rounded-full">
              <LockKeyhole className="text-white w-5 h-5" />
            </div>
            <h2 className="text-gray-800 dark:text-white text-xl font-semibold mt-3">
              Welcome Back
            </h2>
            <p className="text-gray-500 dark:text-gray-400 text-xs">
              Sign in to your account
            </p>
          </div>

          <div className="space-y-3">
            <div className="relative">
              <input
                type="email"
                ref={email}
                placeholder="Email address"
                className="w-full bg-gray-200 dark:bg-gray-800 text-gray-800 dark:text-white py-2.5 px-3 pl-10 rounded-md text-sm outline-none focus:ring-2 focus:ring-purple-500"
              />
              <Mail className="absolute left-3 top-2.5 text-gray-500 dark:text-gray-400 w-4 h-4" />
            </div>

            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                ref={password}
                placeholder="Password"
                className="w-full bg-gray-200 dark:bg-gray-800 text-gray-800 dark:text-white py-2.5 px-3 pl-10 pr-10 rounded-md text-sm outline-none focus:ring-2 focus:ring-purple-500"
              />
              <Lock className="absolute left-3 top-2.5 text-gray-500 dark:text-gray-400 w-4 h-4" />
              <button
                type="button"
                className="absolute right-3 top-2.5 text-gray-500 dark:text-gray-400"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? (
                  <EyeOff className="w-4 h-4" />
                ) : (
                  <Eye className="w-4 h-4" />
                )}
              </button>
            </div>

            <div className="flex items-center justify-between text-xs text-gray-600 dark:text-gray-400">
              <label className="flex items-center space-x-1">
                <input
                  type="checkbox"
                  className="accent-purple-500 w-3.5 h-3.5"
                />
                <span>Remember me</span>
              </label>
              <button className="hover:underline">Forgot password?</button>
            </div>

            <button
              type="submit"
              className="w-full bg-gradient-to-r from-pink-500 to-purple-500 text-white py-2.5 rounded-md font-semibold text-sm hover:opacity-90"
            >
              Sign In
            </button>

            <div className="flex items-center space-x-2 text-gray-500 dark:text-gray-400 text-xs">
              <div className="flex-1 h-px bg-gray-300 dark:bg-gray-700"></div>
              <span>Or continue with</span>
              <div className="flex-1 h-px bg-gray-300 dark:bg-gray-700"></div>
            </div>

            <button className="w-full flex items-center justify-center gap-2 bg-gray-200 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 text-gray-800 dark:text-white py-2.5 rounded-md text-sm hover:bg-gray-300 dark:hover:bg-gray-700">
              <CircleUserRound className="w-4 h-4" />
              Continue with Google
            </button>

            <p className="text-center text-xs text-gray-600 dark:text-gray-400">
              Don’t have an account?{" "}
              <a
                className="text-purple-600 dark:text-purple-400 hover:underline"
                href="#"
                onClick={handleSignUp}
              >
                Sign up
              </a>
            </p>
          </div>
        </form>
      </div>
    </div>
  );
}
