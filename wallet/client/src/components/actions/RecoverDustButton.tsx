import React, { useState } from 'react';

interface RecoverDustButtonProps {
  count: number;
  disabled?: boolean;
  onSuccess?: () => void;
}

export default function RecoverDustButton({ count, disabled = false, onSuccess }: RecoverDustButtonProps) {
  const [loading, setLoading] = useState(false);

  const handleClick = async () => {
    if (disabled || loading) return;

    setLoading(true);
    try {
      // Simulate recovery process — replace with real API call later
      await new Promise(resolve => setTimeout(resolve, 1000));

      onSuccess?.(); // Notify parent RecoveryPage
    } catch (err) {
      console.error('Recover dust failed', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      className={`btn btn-primary btn-sm ${loading ? 'loading' : ''}`}
      disabled={disabled || loading}
      onClick={handleClick}
    >
      {loading ? 'Recovering...' : `Recover Dust (${count})`}
    </button>
  );
}
