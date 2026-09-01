import { useMutation } from '@tanstack/react-query';

import type { CreateUploadTicketPayload, FinalizedFile, UploadTicket } from '@/interfaces/files';
// `{ status: 'success', data }` — the same envelope the identity endpoints use, which M20's also
// answer in. Distinct from `IResponse`, whose `status` is a boolean.
import type { AuthEnvelope } from '@/interfaces/auth';
import type { RequestError } from '@/interfaces/IAxios';
import { http } from '@/services/base';

/**
 * M20 uploads, as one hook.
 *
 * Three round trips, and they have to be three: the API issues a signed ticket, the browser sends the
 * bytes **straight to Cloudinary**, then the API confirms they landed. No file byte passes through the
 * Komtru backend at any point — which is also why `/files` mounts at the default 400kb body limit.
 *
 * The middle call is the one exception in this app to "only `services/base.ts` speaks HTTP". It has to
 * be: `http` is pinned to `baseURL: '/api/'` and attaches a Komtru `Bearer` token, and Cloudinary is a
 * different origin that would reject the header. So it uses bare `fetch` — deliberately, and only here.
 */
export const fileKeys = {
  all: ['files'] as const,
  upload: () => [...fileKeys.all, 'upload'] as const,
};

/** Human-readable ceiling for the copy under a file picker. */
export function describeMaxBytes(bytes: number): string {
  return `${Math.round(bytes / (1024 * 1024))}MB`;
}

async function createTicket(payload: CreateUploadTicketPayload): Promise<UploadTicket> {
  const response = await http.post<AuthEnvelope<UploadTicket>>({
    url: 'files/upload-url',
    body: payload,
  });

  return response.data;
}

/**
 * Sends the bytes to Cloudinary.
 *
 * `params` are appended verbatim and `file` last, because Cloudinary rebuilds the string-to-sign from
 * the parameters it recognises and silently drops the rest — one renamed or invented field makes every
 * upload a 401 whose message names the string it built rather than the field at fault.
 */
async function putBytes(ticket: UploadTicket, file: File): Promise<void> {
  const form = new FormData();

  Object.entries(ticket.params).forEach(([key, value]) => form.append(key, value));
  form.append('file', file);

  const response = await fetch(ticket.uploadUrl, { method: 'POST', body: form });

  if (!response.ok) {
    /**
     * Cloudinary's own error text is not shown to the operator.
     *
     * It describes a signature or an allow-list — our contract with our storage provider, which the
     * person picking a photo can neither read nor act on. It is worth having in the console for us,
     * though, since the alternative when this breaks is a silent failure with no lead.
     */
    console.error('files: Cloudinary rejected an upload', await response.text().catch(() => ''));

    throw {
      status: false,
      message: 'The image could not be uploaded. Try again in a moment.',
    } satisfies RequestError;
  }
}

/**
 * Confirms the upload, which is what makes the file referenceable.
 *
 * The API asks Cloudinary rather than trusting this call, so finalizing a ticket that was never spent
 * fails with a 409 instead of handing out a file id that resolves to nothing. It also reconciles the
 * real byte count here — which is where the size ceiling is actually enforced.
 */
async function finalize(fileId: string): Promise<FinalizedFile> {
  const response = await http.post<AuthEnvelope<FinalizedFile>>({
    url: `files/${fileId}/finalize`,
    body: {},
  });

  return response.data;
}

/**
 * Uploads one file and resolves to its id, ready to attach.
 *
 * Rejects before the network when the file is too large or the wrong type. Both are also enforced
 * server-side — Cloudinary refuses the format at the door and `finalize` tombstones an oversized
 * upload — so this is purely to save an operator a slow round trip that was always going to fail.
 */
export function useUploadFile() {
  return useMutation<
    FinalizedFile,
    RequestError,
    {
      file: File;
      category: CreateUploadTicketPayload['category'];
      visibility: CreateUploadTicketPayload['visibility'];
      accept: readonly string[];
    }
  >({
    mutationKey: fileKeys.upload(),
    mutationFn: async ({ file, category, visibility, accept }) => {
      if (!accept.includes(file.type)) {
        throw {
          status: false,
          message: `That file type isn't accepted. Use ${accept
            .map((type) => type.replace('image/', '').toUpperCase())
            .join(', ')}.`,
        } satisfies RequestError;
      }

      const ticket = await createTicket({ category, visibility, contentType: file.type });

      if (file.size > ticket.maxBytes) {
        throw {
          status: false,
          message: `That file is ${describeMaxBytes(file.size)}. The limit is ${describeMaxBytes(ticket.maxBytes)}.`,
        } satisfies RequestError;
      }

      await putBytes(ticket, file);

      return finalize(ticket.fileId);
    },
  });
}
