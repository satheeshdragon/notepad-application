import React, { useState, FormEvent } from 'react';
import { auth } from './firebase';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  AuthError,
} from 'firebase/auth';

const LoginPage: React.FC = () => {
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [isLogin, setIsLogin] = useState<boolean>(true); // To toggle between Login and Sign Up
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      if (isLogin) {
        await signInWithEmailAndPassword(auth, email, password);
        // Firebase onAuthStateChanged will handle redirecting or updating UI in App.tsx
      } else {
        await createUserWithEmailAndPassword(auth, email, password);
        // Firebase onAuthStateChanged will handle redirecting or updating UI in App.tsx
      }
    } catch (err) {
      const authError = err as AuthError;
      setError(authError.message);
      console.error("Authentication error: ", authError);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="container vh-100 d-flex justify-content-center align-items-center">
      <div className="card p-4" style={{ minWidth: '350px', maxWidth: '450px' }}>
        <h3 className="card-title text-center mb-4">{isLogin ? 'Login' : 'Sign Up'}</h3>
        <form onSubmit={handleSubmit}>
          <div className="mb-3">
            <label htmlFor="emailInput" className="form-label">Email address</label>
            <input
              type="email"
              className="form-control"
              id="emailInput"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="name@example.com"
            />
          </div>
          <div className="mb-3">
            <label htmlFor="passwordInput" className="form-label">Password</label>
            <input
              type="password"
              className="form-control"
              id="passwordInput"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder="Password"
            />
          </div>
          {error && <div className="alert alert-danger p-2 mb-3">{error}</div>}
          <button type="submit" className="btn btn-primary w-100 mb-3" disabled={isLoading}>
            {isLoading ? (isLogin ? 'Logging in...' : 'Signing up...') : (isLogin ? 'Login' : 'Sign Up')}
          </button>
          <button
            type="button"
            className="btn btn-link w-100"
            onClick={() => {
              setIsLogin(!isLogin);
              setError(null); // Clear error when switching modes
            }}
            disabled={isLoading}
          >
            {isLogin ? 'Need an account? Sign Up' : 'Already have an account? Login'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default LoginPage;
