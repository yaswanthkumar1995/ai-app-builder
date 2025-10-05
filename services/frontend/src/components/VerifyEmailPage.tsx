import React, { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { config } from '../config';

const VerifyEmailPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const [verificationStatus, setVerificationStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('');

  useEffect(() => {
    const token = searchParams.get('token');

    if (!token) {
      setVerificationStatus('error');
      setMessage('Invalid verification link. No token provided.');
      return;
    }

    // Call the verification API
    const verifyEmail = async () => {
      try {
        const response = await fetch(`${config.apiGatewayUrl}/api/auth/verify-email`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ token }),
        });

        let data: any = {};
        try {
          data = await response.json();
        } catch (jsonError) {
          console.error('Failed to parse verification response as JSON', jsonError);
        }

        if (response.ok) {
          setVerificationStatus('success');
          setMessage('Email verified successfully! You can now log in to your account.');
          toast.success('Email verified successfully!');
        } else {
          setVerificationStatus('error');
          setMessage(data.error || 'Failed to verify email. The link may be invalid or expired.');
          toast.error(data.error || 'Verification failed');
        }
      } catch (error) {
        setVerificationStatus('error');
        setMessage('Network error occurred. Please try again later.');
        toast.error('Network error occurred');
      }
    };

    verifyEmail();
  }, [searchParams]);

  return (
    <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center px-4">
      <div className="max-w-md w-full bg-gray-800 rounded-xl p-8 shadow-lg">
        {/* Logo */}
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-white">AI Code Platform</h1>
        </div>

        {/* Loading State */}
        {verificationStatus === 'loading' && (
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-400 mx-auto mb-4"></div>
            <h2 className="text-xl font-semibold text-white mb-2">Verifying Email</h2>
            <p className="text-gray-300">Please wait while we verify your email address...</p>
          </div>
        )}

        {/* Success State */}
        {verificationStatus === 'success' && (
          <div className="text-center">
            <div className="text-green-400 text-6xl mb-4">✓</div>
            <h2 className="text-xl font-semibold text-white mb-2">Email Verified!</h2>
            <p className="text-gray-300 mb-6">{message}</p>
            <Link
              to="/login"
              className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-medium transition-colors"
            >
              Go to Login
            </Link>
          </div>
        )}

        {/* Error State */}
        {verificationStatus === 'error' && (
          <div className="text-center">
            <div className="text-red-400 text-6xl mb-4">✕</div>
            <h2 className="text-xl font-semibold text-white mb-2">Verification Failed</h2>
            <p className="text-gray-300 mb-6">{message}</p>
            <div className="space-y-3">
              <Link
                to="/login"
                className="block bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-medium transition-colors"
              >
                Go to Login
              </Link>
              <Link
                to="/signup"
                className="block bg-gray-600 hover:bg-gray-700 text-white px-6 py-3 rounded-lg font-medium transition-colors"
              >
                Sign Up Again
              </Link>
            </div>
          </div>
        )}

        {/* Footer Links */}
        <div className="text-center mt-8 pt-6 border-t border-gray-700">
          <Link to="/" className="text-gray-400 hover:text-white text-sm transition-colors">
            Back to Home
          </Link>
        </div>
      </div>
    </div>
  );
};

export default VerifyEmailPage;
