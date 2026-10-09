import React from 'react';
import { Button } from '../ui/primitives/button';
import { useToast } from '../../hooks/useToast';

/**
 * Copies the code a statistician types to open this game. Says so when it worked, and, when the browser
 * won't let it copy (an insecure page, a denied permission), shows the code so it can be read out instead.
 */
export function CopyMatchCodeButton({ code, label, size = 'sm' }: { code: string; label: string; size?: 'sm' | 'default' }) {
  const toast = useToast();
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      toast.success('Match code copied. The statistician types it on the match key screen.');
    } catch {
      toast.error(`Couldn’t copy. The match code is ${code}`);
    }
  };
  return (
    <Button variant="secondary" size={size} aria-label={`Copy match code for ${label}`} onClick={() => void copy()}>
      Copy code
    </Button>
  );
}
