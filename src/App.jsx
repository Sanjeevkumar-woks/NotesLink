import "./App.css";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import { Provider } from "react-redux";
import ChatUI from "./components/ChatUI";
import CreateAccountForm from "./components/CreateAccountForm";
import LoginForm from "./components/LoginForm";
import AuthProvider from "../src/HOC/AuthProvider";
import ProtectedRoute from "../src/HOC/ProtectedRoute";
import PublicRoute from "../src/HOC/PublicRoute";
import appStore from "./utils/appStore1";

function App() {
  const appRouter = createBrowserRouter([
    {
      path: "/",
      element: (
        <PublicRoute>
          <LoginForm />
        </PublicRoute>
      ),
    },
    {
      path: "/signup",
      element: (
        <PublicRoute>
          <CreateAccountForm />
        </PublicRoute>
      ),
    },
    {
      path: "/aichat",
      element: (
        <ProtectedRoute>
          <ChatUI />
        </ProtectedRoute>
      ),
    },
  ]);

  return (
    <Provider store={appStore}>
      <AuthProvider>
        <RouterProvider router={appRouter} />
      </AuthProvider>
    </Provider>
  );
}

export default App;
