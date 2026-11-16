import React, { useState } from 'react';
import { Muted, Sheet, UButton, UInput, H2 } from '@/components/ui';
import { friendlyApiError } from '@/services/authApi';
import { useAuthStore } from '@/stores/authStore';

interface Props {
  visible: boolean;
  onClose: () => void;
  /** Called after the account is gone. */
  onDeleted: () => void;
}

/**
 * The last step of deleting an account on the server. An account with a password asks for it; one that only uses Google or
 * Apple asks for the word DELETE. (Asking in the app, not in a system alert, so it works the same on every phone.)
 */
export function DeleteAccountSheet({ visible, onClose, onDeleted }: Props) {
  const hasPassword = useAuthStore((s) => s.user?.hasPassword ?? true);
  const deleteAccount = useAuthStore((s) => s.deleteAccount);
  const [value, setValue] = useState('');
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  const ready = hasPassword ? value.length > 0 : value.trim() === 'DELETE';

  const confirm = async () => {
    setBusy(true);
    setProblem(null);
    try {
      await deleteAccount(hasPassword ? value : undefined);
      setValue('');
      onDeleted();
    } catch (error) {
      setProblem(friendlyApiError(error));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet visible={visible} onClose={onClose} title="Delete account">
      <H2>Delete your account</H2>
      <Muted>
        {hasPassword
          ? 'This permanently deletes your account and everything you made. Type your password to confirm.'
          : 'This permanently deletes your account and everything you made. Type DELETE to confirm.'}
      </Muted>
      <UInput
        label={hasPassword ? 'Password' : 'Type DELETE'}
        placeholder={hasPassword ? 'Password' : 'DELETE'}
        value={value}
        onChangeText={setValue}
        secureTextEntry={hasPassword}
        autoCapitalize={hasPassword ? 'none' : 'characters'}
        autoCorrect={false}
      />
      {problem ? <Muted>{problem}</Muted> : null}
      <UButton variant="accent" label="Delete forever" disabled={!ready || busy} onPress={() => void confirm()} />
    </Sheet>
  );
}
