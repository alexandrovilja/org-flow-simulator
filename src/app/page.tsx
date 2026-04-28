'use client'

import dynamic from 'next/dynamic'

const Simulator = dynamic(
  () => import('@/components/Simulator').then(m => m.Simulator),
  { ssr: false },
)

export default function Page() {
  return <Simulator />
}
