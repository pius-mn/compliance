import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Eye, EyeOff, Mail } from 'lucide-react';
import { User } from '../types';

interface LoginProps {
  onLogin: (data: { user: User; token?: string }) => void;
}

const Login: React.FC<LoginProps> = ({ onLogin }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [infoMsg, setInfoMsg] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const savedEmail = localStorage.getItem('rememberedEmail');
    if (savedEmail) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setEmail(savedEmail);
      setRememberMe(true);
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError('Please enter your email and password.');
      return;
    }
    setError('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Invalid credentials');
      }

      if (rememberMe) {
        localStorage.setItem('rememberedEmail', email);
      } else {
        localStorage.removeItem('rememberedEmail');
      }

      onLogin(data);
    } catch (err) {
      setError((err as { message?: string }).message || 'Invalid email or password.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-slate-50 p-4">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-sm p-8 bg-white rounded-2xl shadow-xl shadow-slate-200/50 border border-slate-100"
      >
        <div className="mb-8 text-center">
          <h2 className="text-2xl font-semibold text-slate-900">Welcome Back</h2>
          <p className="text-sm text-slate-500 mt-1">Sign in with your email to continue</p>
        </div>
        
        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <motion.p 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              className="text-sm text-center text-red-600 bg-red-50 p-2 rounded-md"
            >
              {error}
            </motion.p>
          )}

          {infoMsg && (
            <motion.p 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              className="text-sm text-center text-emerald-600 bg-emerald-50 p-2 rounded-md"
            >
              {infoMsg}
            </motion.p>
          )}

          <div className="relative">
            <label htmlFor="email" className="block text-sm font-medium text-slate-900 mb-1.5">Email address</label>
            <input
              id="email"
              name="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all outline-none text-slate-900 pr-10"
              required
              placeholder="you@safaricom.co.ke"
              autoComplete="email"
            />
            <Mail className="absolute right-3 top-9 w-4 h-4 text-slate-400 pointer-events-none" />
          </div>

          <div className="relative">
            <label htmlFor="password" className="block text-sm font-medium text-slate-900 mb-1.5">Password</label>
            <input
              id="password"
              name="password"
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all outline-none pr-10 text-slate-900"
              required
              placeholder="••••••••"
              autoComplete="current-password"
            />
            <button
              type="button"
              className="absolute right-3 top-9 text-slate-500 hover:text-slate-700"
              onClick={() => setShowPassword(!showPassword)}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>

          <div className="flex items-center justify-between">
            <label htmlFor="remember-me" className="flex items-center text-sm text-slate-600">
              <input
                id="remember-me"
                name="rememberMe"
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="w-4 h-4 mr-2 border border-slate-300 rounded text-slate-900 focus:ring-slate-900"
              />
              Remember me
            </label>
            <button
              type="button"
              className="text-sm text-slate-500 hover:text-slate-900 transition-colors"
              onClick={() => setInfoMsg("Password reset instructions will be sent to your email.")}
            >
              Forgot password?
            </button>
          </div>

          <button
            type="submit"
            className="w-full py-2.5 px-4 text-white bg-slate-900 rounded-xl font-medium hover:bg-slate-800 transition-colors focus:ring-2 focus:ring-slate-900 focus:ring-offset-2 disabled:opacity-70"
            disabled={isLoading}
          >
            {isLoading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </motion.div>
    </div>
  );
};

export default Login;
