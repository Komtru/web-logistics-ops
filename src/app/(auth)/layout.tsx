import { KomtruMark } from '@/components/general/komtru-mark';

/**
 * Sign-in chrome: the same `shell-blend` wash the control room uses, with the
 * step card centred on it. Both OTP steps share this layout so moving between
 * them doesn't repaint the background.
 */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="shell-blend flex min-h-svh flex-col items-center justify-center px-4 py-10">
      <div className="w-full max-w-[26rem] space-y-6">
        <div className="flex flex-col items-center gap-2 text-center">
          <KomtruMark className="text-komtru-cyan" size={28} />
          <div>
            <h1 className="font-display text-lg font-semibold">Komtru Logistics Ops</h1>
            <p className="text-muted-foreground text-[11px] tracking-[0.08em] uppercase">
              Internal console
            </p>
          </div>
        </div>

        <div className="surface-veil p-6 sm:p-7">{children}</div>

        <p className="text-muted-foreground text-center text-[11.5px] leading-relaxed">
          Access is limited to Komtru staff. Sign-in attempts are logged.
        </p>
      </div>
    </div>
  );
}
