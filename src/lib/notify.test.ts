import { describe, expect, it } from 'vitest';
import { notifySale } from './notify';

describe('notifySale', () => {
  it('skips gracefully without config (no throw, no send)', async () => {
    await expect(notifySale({}, 's', 'b')).resolves.toEqual({
      sent: false,
      reason: 'email-not-configured',
    });
  });
});
