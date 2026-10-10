import { unlock } from './actions';

/** Not linked from anywhere: whoever has the password gets the URL with it. */
export default async function Unlock({ searchParams }: PageProps<'/unlock'>) {
  const { error } = await searchParams;

  return (
    <main className="mx-auto w-full max-w-5xl px-8 py-16">
      <form action={unlock} className="flex max-w-xs flex-col gap-3">
        <label htmlFor="password" className="text-sm">
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          required
          autoFocus
          className="rounded-md border bg-transparent px-3 py-1.5 text-sm"
          style={{ borderColor: 'var(--border)' }}
        />
        {error && <p className="text-xs text-muted">Wrong password.</p>}
        <button
          type="submit"
          className="self-start rounded-md px-3 py-1.5 text-sm font-medium"
          style={{ background: 'var(--accent)', color: '#ffffff' }}
        >
          Unlock
        </button>
      </form>
    </main>
  );
}
