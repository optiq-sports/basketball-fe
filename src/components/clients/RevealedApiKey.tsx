import React, { useState } from 'react';
import { Button } from '../ui/primitives/button';

/**
 * Shows a newly created API key exactly once, with a copy button. The backend never returns the
 * secret again, so closing this dialog without copying means creating a new key.
 */
const RevealedApiKey: React.FC<{ name: string; apiKey: string; onDone: () => void }> = ({ name, apiKey, onDone }) => {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(apiKey);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };
  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-gray-700">
        <strong>{name}</strong> is ready. This is the only time the key is shown. If you lose it, revoke it and create a new one.
      </p>
      <code className="block break-all rounded-lg bg-gray-100 p-3 text-xs text-gray-900" data-testid="revealed-key">
        {apiKey}
      </code>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="secondary" onClick={() => void copy()}>{copied ? 'Copied' : 'Copy key'}</Button>
        <Button type="button" onClick={onDone}>I’ve saved it</Button>
      </div>
    </div>
  );
};

export default RevealedApiKey;
