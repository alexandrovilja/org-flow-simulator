import Link from 'next/link'

export default function NotFound() {
  return (
    <div style={{
      height: '100vh',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      fontFamily: 'system-ui, sans-serif',
      color: '#16161a',
    }}>
      <h1 style={{ fontSize: 48, fontWeight: 700, margin: 0 }}>404</h1>
      <p style={{ color: '#8a8a92', marginTop: 8 }}>Page not found</p>
      {/* Use Next.js Link for internal navigation so client-side routing works */}
      <Link href="/" style={{ marginTop: 16, color: 'oklch(58% 0.13 240)', textDecoration: 'none', fontSize: 14 }}>
        ← Back to simulator
      </Link>
    </div>
  )
}
