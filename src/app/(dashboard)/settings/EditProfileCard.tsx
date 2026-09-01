'use client';

import { ImageUp, Loader2, Trash2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import { OperatorAvatar } from '@/components/general/operator-avatar';
import { errorMessageOf } from '@/components/general/query-state';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PROFILE_PHOTO_TYPES } from '@/interfaces/files';
import { operatorLabel } from '@/helpers/session';
import { useCustomToast } from '@/hooks/useCustomToast';
import { useUpdateOperatorProfile } from '@/services/account.services';
import { useUploadFile } from '@/services/files.services';
import { useAuthStore } from '@/store/auth.store';

/** Mirrors the API's `Joi.string().max(100)` on `displayName`, so the field can't submit a 400. */
const DISPLAY_NAME_MAX = 100;

/**
 * The operator editing their own account: display name and profile photo.
 *
 * Both write to `PATCH admin/me/profile`, but as two independent actions rather than one form with a
 * single Save. That is a deliberate split, because the photo is not a form field — picking a file
 * triggers a three-call upload chain (ticket → Cloudinary → finalize) whose result is a file id, and
 * holding that id in local state until an unrelated Save button was pressed would mean either an
 * orphaned upload if the operator navigated away, or a "saved" photo that silently wasn't.
 *
 * So: the photo commits on pick, the name commits on Save.
 */
export function EditProfileCard() {
  const user = useAuthStore((state) => state.user);
  const auth = useAuthStore((state) => state.auth);
  const profile = useAuthStore((state) => state.profile);

  const { showToast } = useCustomToast();
  const update = useUpdateOperatorProfile();
  const upload = useUploadFile();

  const fileInput = useRef<HTMLInputElement>(null);
  const [displayName, setDisplayName] = useState(profile?.displayName ?? '');

  /**
   * Re-seed the field when the stored profile changes underneath it.
   *
   * It does change: the store is `null` on the first paint after sign-in and fills in when
   * `useSessionSync`'s read lands, so a field initialised once would stay empty next to a name the rest
   * of the console is already showing. Keyed on the stored value, so it does not fight the operator's
   * typing — only a genuinely different server value re-seeds.
   */
  useEffect(() => setDisplayName(profile?.displayName ?? ''), [profile?.displayName]);

  const label = operatorLabel(user, auth, profile);
  const trimmed = displayName.trim();
  const stored = profile?.displayName ?? '';
  const dirty = trimmed !== stored;
  const busy = update.isPending || upload.isPending;

  const saveName = () => {
    update.mutate(
      // Blank submits as `null` rather than `''`: the API folds whitespace to null anyway, and being
      // explicit here means the request says what it means.
      { displayName: trimmed || null },
      {
        onSuccess: (next) => {
          showToast({
            title: next.displayName ? 'Display name updated' : 'Display name cleared',
            description: next.displayName
              ? `You'll show up as ${next.displayName} across the console.`
              : 'Your username or email will be shown instead.',
            type: 'success',
          });
        },
        onError: (error) => {
          showToast({
            title: "Couldn't save your display name",
            description: errorMessageOf(error),
            type: 'error',
          });
        },
      },
    );
  };

  /** Upload the bytes, then attach the resulting file id. Two steps, because either can fail alone. */
  const pickPhoto = (file: File) => {
    upload.mutate(
      { file, category: 'PROFILE_PHOTO', visibility: 'PUBLIC', accept: PROFILE_PHOTO_TYPES },
      {
        onSuccess: ({ fileId }) =>
          update.mutate(
            { avatarFileId: fileId },
            {
              onSuccess: () => showToast({ title: 'Profile photo updated', type: 'success' }),
              onError: (error) =>
                showToast({
                  // The bytes are stored but nothing points at them, which is the honest thing to say.
                  // The orphan is harmless — an unreferenced PROFILE_PHOTO is swept by retention.
                  title: "Your photo uploaded but couldn't be attached",
                  description: errorMessageOf(error),
                  type: 'error',
                }),
            },
          ),
        onError: (error) =>
          showToast({
            title: "Couldn't upload that photo",
            description: errorMessageOf(error),
            type: 'error',
          }),
      },
    );
  };

  const removePhoto = () => {
    update.mutate(
      { avatarFileId: null },
      {
        onSuccess: () => showToast({ title: 'Profile photo removed', type: 'success' }),
        onError: (error) =>
          showToast({
            title: "Couldn't remove your photo",
            description: errorMessageOf(error),
            type: 'error',
          }),
      },
    );
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-[13.5px]">Your profile</CardTitle>
        <CardDescription className="text-[12px]">
          How you appear to other operators — in the staff roster, and on everything you action.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-5">
        <div className="flex flex-wrap items-center gap-4">
          <OperatorAvatar
            label={label}
            avatarUrl={profile?.avatarUrl}
            className="size-16 text-lg"
          />

          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              {/* The input is the control; the button is the affordance. A bare file input can't be
                  styled to match, and its own label text ("No file chosen") would contradict the
                  avatar sitting next to it. */}
              <input
                ref={fileInput}
                type="file"
                accept={PROFILE_PHOTO_TYPES.join(',')}
                className="sr-only"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  // Cleared before the upload starts, so picking the SAME file again still fires
                  // `change` — otherwise a retry after a failed upload silently does nothing.
                  event.target.value = '';
                  if (file) pickPhoto(file);
                }}
              />

              <Button
                variant="outline"
                size="sm"
                disabled={busy}
                onClick={() => fileInput.current?.click()}
              >
                {upload.isPending ? (
                  <Loader2 className="size-3.5 animate-spin" aria-hidden />
                ) : (
                  <ImageUp className="size-3.5" aria-hidden />
                )}
                {upload.isPending
                  ? 'Uploading…'
                  : profile?.avatarUrl
                    ? 'Change photo'
                    : 'Upload photo'}
              </Button>

              {profile?.avatarFileId ? (
                <Button variant="ghost" size="sm" disabled={busy} onClick={removePhoto}>
                  <Trash2 className="size-3.5" aria-hidden />
                  Remove
                </Button>
              ) : null}
            </div>

            {/* Types, but no size figure. The ceiling is an env var on the API
                (`FILES_MAX_UPLOAD_BYTES`) and arrives on each upload ticket, so a number printed here
                would be a guess that silently drifts. An oversized file is rejected before it uploads
                and the error quotes the real limit. */}
            <p className="text-muted-foreground text-[11.5px]">JPG, PNG or WebP.</p>
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="display-name">Display name</Label>
          <div className="flex flex-wrap gap-2">
            <Input
              id="display-name"
              className="sm:max-w-xs"
              placeholder={user?.username ?? auth?.email ?? 'How you should be shown'}
              maxLength={DISPLAY_NAME_MAX}
              value={displayName}
              disabled={busy}
              onChange={(event) => setDisplayName(event.target.value)}
              // Enter saves, so the field behaves like the single-field form it is.
              onKeyDown={(event) => {
                if (event.key === 'Enter' && dirty && !busy) saveName();
              }}
            />
            <Button size="sm" disabled={!dirty || busy} onClick={saveName}>
              {update.isPending ? 'Saving…' : 'Save'}
            </Button>
          </div>
          <p className="text-muted-foreground text-[11.5px] leading-relaxed">
            Leave this empty to fall back to your username, or your email if you have none.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
